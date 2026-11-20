const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    studentId: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    department: {
      type: String,
      required: true,
      trim: true
    },
    password: {
      type: String,
      required: true,
      minlength: 6
    },
    role: {
      type: String,
      enum: ['student', 'security', 'admin'],
      default: 'student'
    },
    phone: {
      type: String,
      required: true,
      trim: true
    },
    telegramHandle: {
      type: String,
      trim: true,
      default: ''
    },
    telegramChatId: {
      type: String,
      trim: true,
      default: ''
    },
    heroPoints: {
      type: Number,
      default: 0
    },
    isBlocked: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);