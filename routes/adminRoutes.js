const express = require('express');
const router = express.Router();
const {
  getLeaderboard,
  getDashboardStats,
  moderateItem,
  getAllClaimsAdmin
} = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.get('/leaderboard', getLeaderboard);
router.get('/stats', getDashboardStats);
router.get('/claims', protect, authorize('admin', 'security'), getAllClaimsAdmin);
router.put('/items/:id/moderate', protect, authorize('admin', 'security'), moderateItem);

module.exports = router;