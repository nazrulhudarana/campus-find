const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    senderName: {
      type: String,
      trim: true,
      default: 'User'
    },
    messageType: {
      type: String,
      enum: ['text', 'image', 'location', 'live_location', 'reminder', 'system'],
      default: 'text'
    },
    text: {
      type: String,
      trim: true,
      default: ''
    },
    imageUrl: {
      type: String,
      trim: true,
      default: ''
    },
    location: {
      lat: { type: Number },
      lng: { type: Number },
      label: { type: String, trim: true },
      isLive: { type: Boolean, default: false },
      liveActive: { type: Boolean, default: false },
      updatedAt: { type: Date }
    },
    deliveryStatus: {
      type: String,
      enum: ['sent', 'delivered', 'seen'],
      default: 'sent'
    },
    deliveredAt: {
      type: Date,
      default: null
    },
    seenAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

const answerSchema = new mongoose.Schema(
  {
    question: { type: String, required: true, trim: true },
    answer: { type: String, required: true, trim: true },
    expectedAnswer: { type: String, trim: true, default: '' },
    matched: { type: Boolean, default: false }
  },
  { _id: false }
);

const handoverProofSchema = new mongoose.Schema(
  {
    photoUrl: { type: String, trim: true, default: '' },
    capturedViaCamera: { type: Boolean, default: false },
    confirmedRealPerson: { type: Boolean, default: false },
    recipientName: { type: String, trim: true, default: '' },
    recipientStudentId: { type: String, trim: true, default: '' },
    notes: { type: String, trim: true, default: '' },
    completedAt: { type: Date, default: null }
  },
  { _id: false }
);

const claimSchema = new mongoose.Schema(
  {
    item: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Item',
      required: true
    },
    founder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    claimant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    proofAnswers: {
      type: [answerSchema],
      default: []
    },
    answerMatchScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    status: {
      type: String,
      enum: ['pending', 'conversation', 'approved', 'rejected', 'resolved'],
      default: 'pending'
    },
    rejectionReason: {
      type: String,
      trim: true,
      default: ''
    },
    meetupPlan: {
      address: { type: String, trim: true, default: '' },
      meetupTime: { type: Date, default: null },
      reminderSent: { type: Boolean, default: false },
      reminderEmailSent: { type: Boolean, default: false },
      updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
    },
    handoverProof: {
      type: handoverProofSchema,
      default: () => ({})
    },
    chatLocked: {
      type: Boolean,
      default: false
    },
    messages: {
      type: [messageSchema],
      default: []
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Claim', claimSchema);