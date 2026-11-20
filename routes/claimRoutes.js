const express = require('express');
const router = express.Router();
const {
  createClaim,
  getMyClaims,
  addClaimMessage,
  setMeetupSchedule,
  updateClaimStatus,
  completeHandover
} = require('../controllers/claimController');
const { protect } = require('../middleware/authMiddleware');

router.post('/', protect, createClaim);
router.get('/my', protect, getMyClaims);
router.post('/:id/messages', protect, addClaimMessage);
router.patch('/:id/meetup', protect, setMeetupSchedule);
router.patch('/:id/status', protect, updateClaimStatus);
router.post('/:id/handover', protect, completeHandover);

module.exports = router;