const Item = require('../models/Item');
const User = require('../models/User');
const Claim = require('../models/Claim');

const computeMatchScore = (a, b) => {
  let score = 0;
  if (a.category && b.category && a.category.toLowerCase() === b.category.toLowerCase()) {
    score += 40;
  }
  if (
    a.locationName &&
    b.locationName &&
    a.locationName.toLowerCase().includes(b.locationName.toLowerCase().slice(0, 8))
  ) {
    score += 25;
  }
  const wordsA = new Set(
    String(`${a.title} ${a.description}`)
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length > 2)
  );
  const wordsB = new Set(
    String(`${b.title} ${b.description}`)
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length > 2)
  );
  let overlap = 0;
  wordsA.forEach((w) => {
    if (wordsB.has(w)) overlap += 1;
  });
  score += Math.min(35, overlap * 10);
  return score;
};

const createItem = async (req, res) => {
  try {
    const body = req.body || {};

    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required to submit a report'
      });
    }

    const title = String(body.title || '').trim();
    const description = String(body.description || '').trim();
    const category = String(body.category || 'General').trim();
    const type = body.type === 'found' ? 'found' : 'lost';

    if (!title) {
      return res.status(400).json({ success: false, message: 'Item title is required' });
    }
    if (!description) {
      return res.status(400).json({ success: false, message: 'Item description is required' });
    }

    let parsedQuestions = [];
    if (Array.isArray(body.proofQuestions)) {
      parsedQuestions = body.proofQuestions;
    } else if (typeof body.proofQuestions === 'string' && body.proofQuestions.trim()) {
      try {
        const arr = JSON.parse(body.proofQuestions);
        if (Array.isArray(arr)) parsedQuestions = arr;
      } catch (_) {}
    }

    const cleanQuestions = parsedQuestions
      .map((q) => ({
        question: String(q?.question || '').trim(),
        expectedAnswer: String(q?.expectedAnswer || '').trim()
      }))
      .filter((q) => q.question.length > 0);

    const primaryQuestion =
      String(body.proofQuestion || '').trim() ||
      (cleanQuestions[0] ? cleanQuestions[0].question : '');

    if (type === 'found' && !primaryQuestion) {
      return res.status(400).json({
        success: false,
        message: 'At least one proof question is required for found items to verify claimants'
      });
    }

    const rawLat =
      body['coordinates.lat'] ??
      body.coordinates?.lat ??
      body.lat ??
      23.7689;
    const rawLng =
      body['coordinates.lng'] ??
      body.coordinates?.lng ??
      body.lng ??
      90.4067;

    const lat = Number.isFinite(Number(rawLat)) ? Number(rawLat) : 23.7689;
    const lng = Number.isFinite(Number(rawLng)) ? Number(rawLng) : 90.4067;

    const locParts = [
      body.locationName || body.locationLabel || body.building || 'SEU Campus',
      body.room
    ].filter(Boolean);
    const locationName = locParts.join(' — ').trim() || 'SEU Campus';

    const rawDate = body.eventDate || body.incidentDate;
    const parsedDate = rawDate ? new Date(rawDate) : new Date();
    const eventDate = Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;

    const photos = Array.isArray(req.files)
      ? req.files.map((file) => `/uploads/${file.filename}`)
      : [];

    const dropAtSecurity =
      body.dropAtSecurity === true ||
      String(body.dropAtSecurity || '').toLowerCase() === 'true';

    let rawPin = String(body.securityPin || '').trim();
    if (dropAtSecurity && !/^[0-9]{4}$/.test(rawPin)) {
      rawPin = String(Math.floor(1000 + Math.random() * 9000));
    }
    const securityPin = /^[0-9]{4}$/.test(rawPin) ? rawPin : null;
    const hasSecurityDrop = Boolean(dropAtSecurity || securityPin);

    const item = new Item({
      reporter: req.user._id,
      type,
      title,
      category,
      description,
      eventDate,
      locationName,
      coordinates: { lat, lng },
      photos,
      proofQuestion: primaryQuestion,
      proofQuestions: cleanQuestions,
      status: hasSecurityDrop && type === 'found' ? 'at_security_desk' : 'reported',
      dropAtSecurity: hasSecurityDrop,
      securityPin,
      securityDroppedAt: hasSecurityDrop ? new Date() : null
    });

    await item.save();

    let formattedMatches = [];
    try {
      const oppositeType = item.type === 'lost' ? 'found' : 'lost';
      const candidates = await Item.find({
        _id: { $ne: item._id },
        type: oppositeType,
        status: { $nin: ['returned', 'archived'] }
      }).limit(30);

      const matches = candidates
        .map((cand) => ({ item: cand, score: computeMatchScore(item, cand) }))
        .filter((m) => m.score >= 30)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

      if (matches.length > 0) {
        item.matchedItems = matches.map((m) => ({ item: m.item._id, score: m.score }));
        if (item.status !== 'at_security_desk') {
          item.status = 'matched';
        }
        await item.save();
        formattedMatches = matches.map((m) => ({
          id: m.item._id,
          title: m.item.title,
          type: m.item.type,
          locationName: m.item.locationName,
          score: m.score
        }));
      }
    } catch (_) {}

    return res.status(201).json({
      success: true,
      item,
      matches: formattedMatches
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

const getItems = async (req, res) => {
  try {
    const { type, category, q, status } = req.query;
    const filter = {};

    if (type && ['lost', 'found'].includes(type)) {
      filter.type = type;
    }
    if (category && category !== 'all') {
      filter.category = category;
    }
    if (status && status !== 'all') {
      filter.status = status;
    }
    if (q && String(q).trim()) {
      const regex = new RegExp(String(q).trim(), 'i');
      filter.$or = [
        { title: regex },
        { description: regex },
        { locationName: regex },
        { category: regex }
      ];
    }

    const rawItems = await Item.find(filter)
      .populate('reporter', 'name studentId department')
      .sort({ createdAt: -1 })
      .lean();

    const itemIds = rawItems.map((it) => it._id);
    const claims = itemIds.length
      ? await Claim.find({ item: { $in: itemIds } })
          .populate('claimant', 'name studentId')
          .select('item status claimant')
          .lean()
      : [];

    const statsMap = new Map();
    for (const c of claims) {
      const key = String(c.item);
      if (!statsMap.has(key)) {
        statsMap.set(key, {
          claimCount: 0,
          rejectedCount: 0,
          approvedCount: 0,
          approvedRecipientName: ''
        });
      }
      const entry = statsMap.get(key);
      entry.claimCount += 1;
      if (c.status === 'rejected') entry.rejectedCount += 1;
      if (c.status === 'approved' || c.status === 'resolved') {
        entry.approvedCount += 1;
        if (!entry.approvedRecipientName && c.claimant?.name) {
          entry.approvedRecipientName = c.claimant.name;
        }
      }
    }

    const items = rawItems.map((it) => {
      const st = statsMap.get(String(it._id)) || {
        claimCount: 0,
        rejectedCount: 0,
        approvedCount: 0,
        approvedRecipientName: ''
      };
      const hasApprovedClaim =
        st.approvedCount > 0 || it.status === 'verified' || it.status === 'returned';
      return {
        ...it,
        claimCount: st.claimCount,
        rejectedCount: st.rejectedCount,
        approvedCount: st.approvedCount,
        hasApprovedClaim,
        approvedRecipientName: st.approvedRecipientName || 'Verified Claimant',
        displayStatus: hasApprovedClaim ? 'approved' : it.status
      };
    });

    res.json({ success: true, items });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getItemById = async (req, res) => {
  try {
    const item = await Item.findById(req.params.id).populate('reporter', 'name studentId department');
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }
    res.json({ success: true, item });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getItemQrCode = async (req, res) => {
  try {
    const item = await Item.findById(req.params.id).select('title type locationName status');
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }
    const payload = JSON.stringify({
      id: item._id,
      type: item.type,
      title: item.title
    });
    res.json({ success: true, item, payload });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const verifySecurityPinAndReturn = async (req, res) => {
  try {
    const { pin } = req.body || {};
    const item = await Item.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    if (!item.securityPin || String(item.securityPin) !== String(pin || '').trim()) {
      return res.status(400).json({ success: false, message: 'Invalid 4-digit security PIN' });
    }

    item.status = 'returned';
    await item.save();

    if (item.reporter) {
      await User.findByIdAndUpdate(item.reporter, { $inc: { heroPoints: 25 } });
    }

    res.json({ success: true, message: 'PIN verified and item marked as returned', item });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const updateItem = async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    const isOwner = String(item.reporter) === String(req.user._id);
    const isStaff = ['admin', 'security'].includes(req.user.role);
    if (!isOwner && !isStaff) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this item' });
    }

    const allowedUpdates = [
      'title',
      'category',
      'description',
      'locationName',
      'status',
      'proofQuestion',
      'proofQuestions'
    ];
    allowedUpdates.forEach((field) => {
      if (req.body[field] !== undefined) {
        item[field] = req.body[field];
      }
    });

    await item.save();
    res.json({ success: true, item });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const deleteItem = async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    const isOwner = String(item.reporter) === String(req.user._id);
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this item' });
    }

    await item.deleteOne();
    res.json({ success: true, message: 'Item deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  createItem,
  getItems,
  getItemById,
  getItemQrCode,
  verifySecurityPinAndReturn,
  updateItem,
  deleteItem
};