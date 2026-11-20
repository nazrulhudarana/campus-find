const Item = require('../models/Item');
const User = require('../models/User');
const ClaimRequest = require('../models/ClaimRequest');

const getLeaderboard = async (req, res) => {
  try {
    const heroes = await User.find({ isBlocked: false })
      .select('name studentId department heroPoints role')
      .sort({ heroPoints: -1 })
      .limit(15);

    res.json({ success: true, heroes });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getDashboardStats = async (req, res) => {
  try {
    const [total, matched, pending, resolved] = await Promise.all([
      Item.countDocuments({ isModerated: false }),
      Item.countDocuments({ isModerated: false, status: 'matched' }),
      Item.countDocuments({ isModerated: false, status: { $in: ['reported', 'at_security_desk'] } }),
      Item.countDocuments({ isModerated: false, status: 'returned' })
    ]);

    res.json({
      success: true,
      stats: { total, matched, pending, resolved }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const moderateItem = async (req, res) => {
  try {
    const { isModerated } = req.body;
    const item = await Item.findByIdAndUpdate(
      req.params.id,
      { $set: { isModerated: Boolean(isModerated) } },
      { new: true }
    );

    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    res.json({ success: true, item });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getAllClaimsAdmin = async (req, res) => {
  try {
    const claims = await ClaimRequest.find()
      .populate('item', 'title type locationName status')
      .populate('claimant', 'name studentId department')
      .sort({ createdAt: -1 });

    res.json({ success: true, claims });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getLeaderboard, getDashboardStats, moderateItem, getAllClaimsAdmin };