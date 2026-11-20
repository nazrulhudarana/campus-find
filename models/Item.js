const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema(
  {
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    type: {
      type: String,
      enum: ['lost', 'found'],
      required: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    category: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      required: true,
      trim: true
    },
    eventDate: {
      type: Date,
      required: true
    },
    locationName: {
      type: String,
      required: true,
      trim: true
    },
    coordinates: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true }
    },
    photos: [
      {
        type: String
      }
    ],
    proofQuestion: {
      type: String,
      trim: true,
      default: ''
    },
    proofQuestions: [
      {
        question: { type: String, trim: true, required: true },
        expectedAnswer: { type: String, trim: true, default: '' }
      }
    ],
    status: {
      type: String,
      enum: [
        'reported',
        'matched',
        'claimed',
        'verified',
        'at_security_desk',
        'returned',
        'archived'
      ],
      default: 'reported'
    },
    dropAtSecurity: {
      type: Boolean,
      default: false
    },
    securityPin: {
      type: String,
      default: null
    },
    securityDroppedAt: {
      type: Date,
      default: null
    },
    matchedItems: [
      {
        item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item' },
        score: { type: Number, default: 0 }
      }
    ],
    isModerated: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Item', itemSchema);