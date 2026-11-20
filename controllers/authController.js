const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const OtpCode = require('../models/OtpCode');
const { sendOtpEmail, sendWelcomeManualEmail } = require('../services/emailService');

const SEU_EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@seu\.edu\.bd$/i;
const PHONE_REGEX = /^\+?[0-9]{10,15}$/;
const OTP_TTL_MS = 5 * 60 * 1000;

const generateToken = (id, rememberMe = false) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: rememberMe ? '30d' : process.env.JWT_EXPIRES_IN || '1d'
  });
};

const generateSixDigitOtp = () => {
  return String(Math.floor(100000 + Math.random() * 900000));
};

const startSignupOtp = async (req, res) => {
  try {
    const { name, studentId, email, department, phone, password, telegramHandle, telegramChatId } = req.body;

    if (!name || !studentId || !email || !department || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, Student ID, @seu.edu.bd Email, Department, WhatsApp Phone Number, and Password are required'
      });
    }

    const cleanEmail = email.toLowerCase().trim();
    if (!SEU_EMAIL_REGEX.test(cleanEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Please use your valid @seu.edu.bd university email address'
      });
    }

    const cleanPhone = String(phone).replace(/[\s()-]/g, '').trim();
    if (!PHONE_REGEX.test(cleanPhone)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid WhatsApp phone number (10–15 digits)'
      });
    }

    if (String(password).length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters'
      });
    }

    const existingUser = await User.findOne({
      $or: [{ email: cleanEmail }, { studentId: studentId.trim() }]
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Account with this @seu.edu.bd email or Student ID already exists'
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const otp = generateSixDigitOtp();
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

    await OtpCode.deleteMany({ email: cleanEmail, purpose: 'signup' });
    await OtpCode.create({
      email: cleanEmail,
      code: otp,
      purpose: 'signup',
      expiresAt,
      payload: {
        name: name.trim(),
        studentId: studentId.trim(),
        email: cleanEmail,
        department: String(department).trim(),
        phone: cleanPhone,
        password: hashedPassword,
        telegramHandle: (telegramHandle || '').trim().replace(/^@/, ''),
        telegramChatId: (telegramChatId || '').trim()
      }
    });

    const mailInfo = await sendOtpEmail({
      to: cleanEmail,
      otp,
      purpose: 'signup',
      name: name.trim()
    });

    res.json({
      success: true,
      email: cleanEmail,
      expiresAt: expiresAt.toISOString(),
      message: `6-digit OTP sent to ${cleanEmail}`,
      devOtp: mailInfo.devFallback ? otp : undefined
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const verifySignupOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Email and 6-digit OTP are required'
      });
    }

    const cleanEmail = email.toLowerCase().trim();
    const record = await OtpCode.findOne({
      email: cleanEmail,
      purpose: 'signup'
    }).sort({ createdAt: -1 });

    if (!record || !record.payload) {
      return res.status(400).json({
        success: false,
        message: 'No pending OTP request found. Please sign up again.'
      });
    }

    if (new Date() > new Date(record.expiresAt)) {
      await OtpCode.deleteMany({ email: cleanEmail, purpose: 'signup' });
      return res.status(400).json({
        success: false,
        message: 'OTP has expired. Please request a new OTP.'
      });
    }

    if (record.code !== String(otp).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Invalid 6-digit OTP code'
      });
    }

    const existingUser = await User.findOne({
      $or: [{ email: cleanEmail }, { studentId: record.payload.studentId }]
    });
    if (existingUser) {
      await OtpCode.deleteMany({ email: cleanEmail, purpose: 'signup' });
      return res.status(409).json({
        success: false,
        message: 'Account already exists. Please login.'
      });
    }

    const user = await User.create(record.payload);
    await OtpCode.deleteMany({ email: cleanEmail, purpose: 'signup' });

    try {
      await sendWelcomeManualEmail({
        to: user.email,
        name: user.name,
        studentId: user.studentId,
        department: user.department,
        phone: user.phone
      });
    } catch (_) {}

    const token = generateToken(user._id, true);

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        studentId: user.studentId,
        email: user.email,
        department: user.department,
        phone: user.phone,
        role: user.role,
        telegramHandle: user.telegramHandle,
        telegramChatId: user.telegramChatId,
        heroPoints: user.heroPoints
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const loginUser = async (req, res) => {
  try {
    const { identifier, password, rememberMe = false } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: '@seu.edu.bd email or Student ID and password are required'
      });
    }

    const cleanId = identifier.trim();
    if (cleanId.includes('@') && !SEU_EMAIL_REGEX.test(cleanId.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: 'Only @seu.edu.bd emails are allowed'
      });
    }

    const user = await User.findOne({
      $or: [{ email: cleanId.toLowerCase() }, { studentId: cleanId }]
    });

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (user.isBlocked) {
      return res.status(403).json({ success: false, message: 'Account is blocked by admin' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = generateToken(user._id, Boolean(rememberMe));

    res.json({
      success: true,
      token,
      rememberMe: Boolean(rememberMe),
      user: {
        id: user._id,
        name: user.name,
        studentId: user.studentId,
        email: user.email,
        department: user.department,
        phone: user.phone,
        role: user.role,
        telegramHandle: user.telegramHandle,
        telegramChatId: user.telegramChatId,
        heroPoints: user.heroPoints
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const verifyLoginOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Email and 6-digit OTP are required'
      });
    }

    const cleanEmail = email.toLowerCase().trim();
    const record = await OtpCode.findOne({
      email: cleanEmail,
      purpose: 'login'
    }).sort({ createdAt: -1 });

    if (!record || !record.payload || !record.payload.userId) {
      return res.status(400).json({
        success: false,
        message: 'OTP session not found. Please login again.'
      });
    }

    if (new Date() > new Date(record.expiresAt)) {
      await OtpCode.deleteMany({ email: cleanEmail, purpose: 'login' });
      return res.status(400).json({
        success: false,
        message: 'Login OTP has expired. Please login again.'
      });
    }

    if (record.code !== String(otp).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Invalid 6-digit OTP code'
      });
    }

    const user = await User.findById(record.payload.userId).select('-password');
    await OtpCode.deleteMany({ email: cleanEmail, purpose: 'login' });

    if (!user || user.isBlocked) {
      return res.status(403).json({ success: false, message: 'Account unavailable' });
    }

    const token = generateToken(user._id, false);

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        studentId: user.studentId,
        email: user.email,
        department: user.department,
        phone: user.phone,
        role: user.role,
        telegramHandle: user.telegramHandle,
        telegramChatId: user.telegramChatId,
        heroPoints: user.heroPoints
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const resendOtp = async (req, res) => {
  try {
    const { email, purpose = 'signup' } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const prev = await OtpCode.findOne({ email: cleanEmail, purpose }).sort({ createdAt: -1 });

    if (!prev || !prev.payload) {
      return res.status(400).json({
        success: false,
        message: 'Session expired. Please submit the form again.'
      });
    }

    const otp = generateSixDigitOtp();
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

    await OtpCode.deleteMany({ email: cleanEmail, purpose });
    await OtpCode.create({
      email: cleanEmail,
      code: otp,
      purpose,
      expiresAt,
      payload: prev.payload
    });

    const userDoc = await User.findOne({ email: cleanEmail }).select('name').lean();
    const displayName = (prev.payload && prev.payload.name) || (userDoc && userDoc.name) || '';

    const mailInfo = await sendOtpEmail({
      to: cleanEmail,
      otp,
      purpose,
      name: displayName
    });

    res.json({
      success: true,
      expiresAt: expiresAt.toISOString(),
      message: `New 6-digit OTP sent to ${cleanEmail}`,
      devOtp: mailInfo.devFallback ? otp : undefined
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const forgotPasswordOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: '@seu.edu.bd email is required' });
    }

    const cleanEmail = email.toLowerCase().trim();
    if (!SEU_EMAIL_REGEX.test(cleanEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Only @seu.edu.bd email addresses are allowed'
      });
    }

    const user = await User.findOne({ email: cleanEmail });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No account found with this @seu.edu.bd email'
      });
    }

    const otp = generateSixDigitOtp();
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

    await OtpCode.deleteMany({ email: cleanEmail, purpose: 'reset' });
    await OtpCode.create({
      email: cleanEmail,
      code: otp,
      purpose: 'reset',
      expiresAt,
      payload: { userId: user._id }
    });

    const mailInfo = await sendOtpEmail({
      to: cleanEmail,
      otp,
      purpose: 'reset',
      name: user.name
    });

    res.json({
      success: true,
      message: `Password reset OTP sent to ${cleanEmail}`,
      devOtp: mailInfo.devFallback ? otp : undefined
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const resetPasswordWithOtp = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Email, 6-digit OTP, and new password are required'
      });
    }

    if (String(newPassword).length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters'
      });
    }

    const cleanEmail = email.toLowerCase().trim();
    const record = await OtpCode.findOne({
      email: cleanEmail,
      purpose: 'reset'
    }).sort({ createdAt: -1 });

    if (!record || !record.payload || !record.payload.userId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or missing reset request. Please request OTP again.'
      });
    }

    if (new Date() > new Date(record.expiresAt)) {
      await OtpCode.deleteMany({ email: cleanEmail, purpose: 'reset' });
      return res.status(400).json({
        success: false,
        message: 'Reset OTP has expired. Please request a new code.'
      });
    }

    if (record.code !== String(otp).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Invalid 6-digit OTP code'
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(String(newPassword), salt);

    await User.findByIdAndUpdate(record.payload.userId, {
      $set: { password: hashedPassword }
    });
    await OtpCode.deleteMany({ email: cleanEmail, purpose: 'reset' });

    res.json({
      success: true,
      message: 'Password updated successfully! You can now log in.'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getMe = async (req, res) => {
  res.json({ success: true, user: req.user });
};

const updateProfile = async (req, res) => {
  try {
    const { name, department, phone, telegramHandle, telegramChatId } = req.body;
    const updates = {};

    if (name !== undefined) updates.name = name.trim();
    if (department !== undefined) updates.department = String(department).trim();
    if (phone !== undefined) {
      const cleanPhone = String(phone).replace(/[\s()-]/g, '').trim();
      if (!PHONE_REGEX.test(cleanPhone)) {
        return res.status(400).json({
          success: false,
          message: 'Please enter a valid phone number'
        });
      }
      updates.phone = cleanPhone;
    }
    if (telegramHandle !== undefined) {
      updates.telegramHandle = telegramHandle.trim().replace(/^@/, '');
    }
    if (telegramChatId !== undefined) {
      updates.telegramChatId = String(telegramChatId).trim();
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-password');

    res.json({ success: true, user: updatedUser });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  startSignupOtp,
  verifySignupOtp,
  loginUser,
  verifyLoginOtp,
  resendOtp,
  forgotPasswordOtp,
  resetPasswordWithOtp,
  getMe,
  updateProfile
};