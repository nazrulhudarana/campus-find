const mongoose = require('mongoose');

const otpCodeSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true
    },
    code: {
      type: String,
      required: true
    },
    purpose: {
      type: String,
      enum: ['signup', 'login', 'reset'],
      required: true
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('OtpCode', otpCodeSchema);