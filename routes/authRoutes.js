const express = require('express');
const router = express.Router();
const {
  startSignupOtp,
  verifySignupOtp,
  loginUser,
  verifyLoginOtp,
  resendOtp,
  forgotPasswordOtp,
  resetPasswordWithOtp,
  getMe,
  updateProfile
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/signup-otp', startSignupOtp);
router.post('/send-otp', startSignupOtp);
router.post('/verify-signup-otp', verifySignupOtp);
router.post('/login', loginUser);
router.post('/verify-login-otp', verifyLoginOtp);
router.post('/resend-otp', resendOtp);
router.post('/forgot-password-otp', forgotPasswordOtp);
router.post('/forgot-password', forgotPasswordOtp);
router.post('/reset-password', resetPasswordWithOtp);
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);

module.exports = router;