const fs = require('fs');
const path = require('path');
const Claim = require('../models/Claim');
const Item = require('../models/Item');
const User = require('../models/User');
const {
  sendMeetupScheduledEmail,
  sendMeetupReminderEmail,
  sendHandoverCongratulationEmail
} = require('../utils/handoverMailer');

const tokenize = (str = '') =>
  String(str)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1);

const evaluateAnswers = (questions = [], submittedAnswers = []) => {
  if (!Array.isArray(questions) || questions.length === 0) {
    const score = submittedAnswers.length > 0 ? 50 : 0;
    return {
      score,
      evaluated: submittedAnswers.map((a) => ({
        question: a.question || 'Proof Question',
        answer: a.answer || '',
        expectedAnswer: '',
        matched: false
      }))
    };
  }

  let matchedCount = 0;
  const evaluated = questions.map((q, idx) => {
    const sub =
      submittedAnswers.find(
        (s) => String(s.question || '').trim() === String(q.question || '').trim()
      ) ||
      submittedAnswers[idx] ||
      {};
    const given = String(sub.answer || '').trim();
    const expected = String(q.expectedAnswer || '').trim();

    const givenTokens = new Set(tokenize(given));
    const expectedTokens = tokenize(expected);

    let isMatched = false;
    if (given && expected) {
      if (given.toLowerCase() === expected.toLowerCase()) {
        isMatched = true;
      } else if (expectedTokens.length > 0) {
        const hits = expectedTokens.filter((t) => givenTokens.has(t)).length;
        isMatched = hits / expectedTokens.length >= 0.5;
      }
    }

    if (isMatched) matchedCount += 1;

    return {
      question: q.question,
      answer: given,
      expectedAnswer: expected,
      matched: isMatched
    };
  });

  const score = Math.round((matchedCount / questions.length) * 100);
  return { score, evaluated };
};

const saveCompressedDataUrl = (dataUrl) => {
  const match = String(dataUrl || '').match(/^data:image\/(webp|jpeg|jpg|png);base64,(.+)$/i);
  if (!match) return '';

  const ext = match[1].toLowerCase() === 'jpeg' ? 'jpg' : match[1].toLowerCase();
  const buffer = Buffer.from(match[2], 'base64');

  if (buffer.length > 600 * 1024) {
    throw new Error('Compressed image exceeds 600KB limit');
  }

  const uploadsDir = path.join(__dirname, '..', 'public', 'uploads', 'chat');
  fs.mkdirSync(uploadsDir, { recursive: true });

  const filename = `chat-${Date.now()}-${Math.round(Math.random() * 1e6)}.${ext}`;
  fs.writeFileSync(path.join(uploadsDir, filename), buffer);
  return `/uploads/chat/${filename}`;
};

const markMessagesDeliveredAndSeen = async (claims, viewerId) => {
  const uid = String(viewerId);
  const now = new Date();

  for (const claim of claims) {
    let changed = false;
    for (const msg of claim.messages || []) {
      if (String(msg.sender) !== uid) {
        if (!msg.deliveredAt) {
          msg.deliveredAt = now;
          changed = true;
        }
        if (msg.deliveryStatus !== 'seen') {
          msg.deliveryStatus = 'seen';
          msg.seenAt = now;
          changed = true;
        }
      }
    }

    if (changed) {
      await claim.save();
    }
  }
};

const createClaim = async (req, res) => {
  try {
    const { itemId, answers = [], note = '' } = req.body || {};
    if (!itemId) {
      return res.status(400).json({ success: false, message: 'Item ID is required' });
    }

    const item = await Item.findById(itemId);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    if (String(item.reporter) === String(req.user._id)) {
      return res.status(400).json({
        success: false,
        message: 'You cannot claim your own reported item.'
      });
    }

    const existingClaim = await Claim.findOne({
      item: item._id,
      claimant: req.user._id
    }).sort({ createdAt: -1 });

    if (existingClaim) {
      return res.status(400).json({
        success: false,
        message: 'You have already claimed this post. You cannot claim it again.',
        existingClaimId: existingClaim._id
      });
    }

    const questions =
      Array.isArray(item.proofQuestions) && item.proofQuestions.length > 0
        ? item.proofQuestions
        : item.proofQuestion
        ? [{ question: item.proofQuestion, expectedAnswer: '' }]
        : [{ question: 'Describe a unique mark or detail on this item.', expectedAnswer: '' }];

    const safeAnswers = Array.isArray(answers) ? answers : [];
    const { score, evaluated } = evaluateAnswers(questions, safeAnswers);

    const normalizedEvaluated = evaluated.map((ev) => ({
      ...ev,
      answer: String(ev.answer || '').trim() || 'Not provided'
    }));

    const initialMessages = [];
    if (String(note || '').trim()) {
      initialMessages.push({
        sender: req.user._id,
        senderName: req.user.name || 'Claimant',
        messageType: 'text',
        text: String(note).trim(),
        deliveryStatus: 'sent'
      });
    }

    const claim = await Claim.create({
      item: item._id,
      founder: item.reporter,
      claimant: req.user._id,
      proofAnswers: normalizedEvaluated,
      answerMatchScore: score,
      status: 'pending',
      chatLocked: false,
      messages: initialMessages
    });

    if (item.status === 'reported' || item.status === 'matched') {
      item.status = 'claimed';
      await item.save();
    }

    const populated = await Claim.findById(claim._id)
      .populate('item', 'title type locationName photos status')
      .populate('claimant', 'name studentId department email phone')
      .populate('founder', 'name studentId department email phone');

    return res.status(201).json({ success: true, claim: populated });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

const getMyClaims = async (req, res) => {
  try {
    const uid = req.user._id;
    const claims = await Claim.find({
      $or: [{ founder: uid }, { claimant: uid }]
    })
      .populate('item', 'title type locationName photos status')
      .populate('claimant', 'name studentId department email phone')
      .populate('founder', 'name studentId department email phone')
      .sort({ updatedAt: -1 });

    await markMessagesDeliveredAndSeen(claims, uid);

    res.json({ success: true, claims });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const addClaimMessage = async (req, res) => {
  try {
    const {
      text = '',
      messageType = 'text',
      compressedImage = '',
      location = null
    } = req.body || {};

    const claim = await Claim.findById(req.params.id);
    if (!claim) {
      return res.status(404).json({ success: false, message: 'Claim not found' });
    }

    if (claim.chatLocked || claim.status === 'resolved') {
      return res.status(400).json({
        success: false,
        message: 'This handover is completed. Chat is locked and only history can be viewed.'
      });
    }

    const uid = String(req.user._id);
    const isParticipant = uid === String(claim.founder) || uid === String(claim.claimant);
    if (!isParticipant && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not part of this claim conversation' });
    }

    let imageUrl = '';
    if (compressedImage) {
      imageUrl = saveCompressedDataUrl(compressedImage);
    }

    const cleanText = String(text || '').trim();
    const isExplicitLocation =
      (messageType === 'location' || messageType === 'live_location') &&
      location &&
      Number.isFinite(Number(location.lat)) &&
      Number.isFinite(Number(location.lng));

    if (!cleanText && !imageUrl && !isExplicitLocation) {
      return res.status(400).json({
        success: false,
        message: 'Message text, compressed image, or shared location is required'
      });
    }

    if (isExplicitLocation && location.isLive && location.liveActive === false) {
      claim.messages.forEach((m) => {
        if (String(m.sender) === uid && m.messageType === 'live_location' && m.location?.liveActive) {
          m.location.liveActive = false;
          m.location.updatedAt = new Date();
        }
      });
      await claim.save();
      return res.json({ success: true, claim });
    }

    if (isExplicitLocation && location.isLive && location.liveActive) {
      const existingLive = [...claim.messages]
        .reverse()
        .find(
          (m) =>
            String(m.sender) === uid &&
            m.messageType === 'live_location' &&
            m.location?.liveActive
        );

      if (existingLive) {
        existingLive.location.lat = Number(location.lat);
        existingLive.location.lng = Number(location.lng);
        existingLive.location.label = String(location.label || 'Live Location').trim();
        existingLive.location.updatedAt = new Date();
        existingLive.deliveryStatus = 'delivered';
        existingLive.deliveredAt = new Date();
        await claim.save();
        return res.json({ success: true, claim });
      }
    }

    const resolvedType = imageUrl
      ? 'image'
      : isExplicitLocation
      ? location.isLive
        ? 'live_location'
        : 'location'
      : 'text';

    claim.messages.push({
      sender: req.user._id,
      senderName: req.user.name || 'User',
      messageType: resolvedType,
      text: cleanText,
      imageUrl,
      location: isExplicitLocation
        ? {
            lat: Number(location.lat),
            lng: Number(location.lng),
            label: String(
              location.label || (location.isLive ? 'Live Location' : 'Current Location')
            ).trim(),
            isLive: Boolean(location.isLive),
            liveActive: Boolean(location.isLive && location.liveActive !== false),
            updatedAt: new Date()
          }
        : undefined,
      deliveryStatus: 'delivered',
      deliveredAt: new Date()
    });

    if (claim.status === 'pending') {
      claim.status = 'conversation';
    }

    await claim.save();
    res.json({ success: true, claim });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const setMeetupSchedule = async (req, res) => {
  try {
    const { address, meetupTime } = req.body || {};
    const claim = await Claim.findById(req.params.id);
    if (!claim) {
      return res.status(404).json({ success: false, message: 'Claim not found' });
    }

    if (claim.chatLocked || claim.status === 'resolved') {
      return res.status(400).json({ success: false, message: 'Handover is already completed' });
    }

    const uid = String(req.user._id);
    const isParticipant = uid === String(claim.founder) || uid === String(claim.claimant);
    if (!isParticipant && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const cleanAddress = String(address || '').trim();
    const parsedTime = meetupTime ? new Date(meetupTime) : null;
    if (!cleanAddress || !parsedTime || Number.isNaN(parsedTime.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Both meetup address and valid date/time are required'
      });
    }

    claim.meetupPlan = {
      address: cleanAddress,
      meetupTime: parsedTime,
      reminderSent: false,
      reminderEmailSent: false,
      updatedBy: req.user._id
    };

    claim.messages.push({
      sender: req.user._id,
      senderName: 'Handover Schedule',
      messageType: 'system',
      text: `Meetup set at "${cleanAddress}" on ${parsedTime.toLocaleString([], {
        dateStyle: 'medium',
        timeStyle: 'short'
      })}. Confirmation email sent & a reminder email will arrive 15 minutes before.`,
      deliveryStatus: 'delivered',
      deliveredAt: new Date()
    });

    await claim.save();

    const populated = await Claim.findById(claim._id)
      .populate('item', 'title type locationName photos status')
      .populate('claimant', 'name studentId department email phone')
      .populate('founder', 'name studentId department email phone');

    let mailResult = { sent: false, reason: 'SMTP not configured' };
    try {
      mailResult = await sendMeetupScheduledEmail({
        claim: populated,
        item: populated?.item,
        founder: populated?.founder,
        claimant: populated?.claimant
      });
    } catch (mailErr) {
      mailResult = { sent: false, reason: mailErr.message };
    }

    res.json({ success: true, claim: populated, mailResult });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const updateClaimStatus = async (req, res) => {
  try {
    const { status, reason = '' } = req.body || {};
    if (!['conversation', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid claim status' });
    }

    const claim = await Claim.findById(req.params.id);
    if (!claim) {
      return res.status(404).json({ success: false, message: 'Claim not found' });
    }

    const isFounder = String(claim.founder) === String(req.user._id);
    if (!isFounder && req.user.role !== 'admin') {
      return res
        .status(403)
        .json({ success: false, message: 'Only the founder can approve or reject a claim' });
    }

    if (status === 'approved') {
      if (claim.status === 'approved') {
        return res.status(400).json({
          success: false,
          message: 'This claim is already approved.'
        });
      }

      const alreadyApprovedForItem = await Claim.findOne({
        _id: { $ne: claim._id },
        item: claim.item,
        status: { $in: ['approved', 'resolved'] }
      });

      if (alreadyApprovedForItem) {
        return res.status(400).json({
          success: false,
          message: 'Another claim for this item has already been approved.'
        });
      }
    }

    const cleanReason = String(reason || '').trim();
    if (status === 'rejected' && cleanReason.length < 3) {
      return res.status(400).json({
        success: false,
        message: 'A clear rejection reason is required before rejecting a claim.'
      });
    }

    claim.status = status;
    if (status === 'rejected') {
      claim.rejectionReason = cleanReason;
    }

    claim.messages.push({
      sender: req.user._id,
      senderName: 'System',
      messageType: 'system',
      text:
        status === 'approved'
          ? 'Claim approved! Set a meetup address and time below to proceed to handover.'
          : status === 'rejected'
          ? `Claim rejected. Reason: ${cleanReason}`
          : `Claim status updated to ${status}.`,
      deliveryStatus: 'delivered',
      deliveredAt: new Date()
    });
    await claim.save();

    const item = await Item.findById(claim.item);
    if (item && status === 'approved') {
      item.status = 'verified';
      await item.save();
    }

    res.json({ success: true, claim });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const completeHandover = async (req, res) => {
  try {
    const {
      compressedPhoto = '',
      capturedViaCamera = false,
      confirmedRealPerson = false,
      notes = ''
    } = req.body || {};

    const claim = await Claim.findById(req.params.id)
      .populate('item', 'title type locationName photos status')
      .populate('claimant', 'name studentId department email phone')
      .populate('founder', 'name studentId department email phone');

    if (!claim) {
      return res.status(404).json({ success: false, message: 'Claim not found' });
    }

    const isFounder = String(claim.founder?._id || claim.founder) === String(req.user._id);
    if (!isFounder && req.user.role !== 'admin') {
      return res
        .status(403)
        .json({ success: false, message: 'Only the founder can finalize handover proof' });
    }

    if (!compressedPhoto || !capturedViaCamera) {
      return res.status(400).json({
        success: false,
        message: 'Live camera photo capture is mandatory before completing handover.'
      });
    }

    if (!confirmedRealPerson) {
      return res.status(400).json({
        success: false,
        message: 'Please confirm that you are handing over to the real person from the chat.'
      });
    }

    const photoUrl = saveCompressedDataUrl(compressedPhoto);
    const completedAt = new Date();

    claim.handoverProof = {
      photoUrl,
      capturedViaCamera: true,
      confirmedRealPerson: true,
      recipientName: claim.claimant?.name || 'Verified Claimant',
      recipientStudentId: claim.claimant?.studentId || '',
      notes: String(notes || '').trim(),
      completedAt
    };
    claim.status = 'resolved';
    claim.chatLocked = true;

    claim.messages.push({
      sender: req.user._id,
      senderName: 'Handover Completed',
      messageType: 'system',
      text: `Item handed over to ${claim.claimant?.name || 'claimant'} with live camera proof & identity confirmation. Chat is now read-only.`,
      deliveryStatus: 'seen',
      deliveredAt: completedAt,
      seenAt: completedAt
    });

    await claim.save();

    const item = await Item.findById(claim.item?._id || claim.item);
    if (item) {
      item.status = 'returned';
      await item.save();
    }

    await User.findByIdAndUpdate(claim.founder?._id || claim.founder, { $inc: { heroPoints: 25 } });

    let mailResult = { sent: false, reason: 'SMTP not configured' };
    try {
      mailResult = await sendHandoverCongratulationEmail({
        claim,
        item: claim.item,
        founder: claim.founder,
        claimant: claim.claimant
      });
    } catch (mailErr) {
      mailResult = { sent: false, reason: mailErr.message };
    }

    res.json({ success: true, claim, mailResult });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const processDueMeetupReminders = async () => {
  const now = new Date();
  const nowMs = now.getTime();
  const fifteenMinMs = 15 * 60 * 1000;

  const dueClaims = await Claim.find({
    status: 'approved',
    chatLocked: { $ne: true },
    'meetupPlan.meetupTime': { $ne: null },
    'meetupPlan.reminderEmailSent': { $ne: true }
  })
    .populate('item', 'title type locationName photos status')
    .populate('claimant', 'name studentId department email phone')
    .populate('founder', 'name studentId department email phone');

  for (const claim of dueClaims) {
    const targetMs = new Date(claim.meetupPlan.meetupTime).getTime();
    if (Number.isNaN(targetMs)) continue;

    const diffMs = targetMs - nowMs;
    if (diffMs > 0 && diffMs <= fifteenMinMs) {
      try {
        await sendMeetupReminderEmail({
          claim,
          item: claim.item,
          founder: claim.founder,
          claimant: claim.claimant
        });
      } catch (mailErr) {
        console.error('15-min reminder mail error:', mailErr.message);
      }

      claim.meetupPlan.reminderEmailSent = true;
      claim.meetupPlan.reminderSent = true;
      claim.messages.push({
        sender: claim.founder?._id || claim.founder,
        senderName: '15-Min Reminder',
        messageType: 'reminder',
        text: `15-minute reminder email sent for meetup at "${claim.meetupPlan.address || 'Campus Spot'}" (${new Date(
          claim.meetupPlan.meetupTime
        ).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}).`,
        deliveryStatus: 'delivered',
        deliveredAt: now
      });

      await claim.save();
    }
  }
};

let reminderIntervalHandle = null;
const startMeetupReminderJob = () => {
  if (reminderIntervalHandle) return;
  processDueMeetupReminders().catch(() => {});
  reminderIntervalHandle = setInterval(() => {
    processDueMeetupReminders().catch(() => {});
  }, 60 * 1000);
};

module.exports = {
  createClaim,
  getMyClaims,
  addClaimMessage,
  setMeetupSchedule,
  updateClaimStatus,
  completeHandover,
  startMeetupReminderJob
};