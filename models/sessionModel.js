const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema(
  {
    chat: {
      type: mongoose.Schema.ObjectId,
      ref: 'Chat',
      required: [true, 'Session chat is required!'],
    },

    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'Session user is required!'],
    },

    team: {
      type: mongoose.Schema.ObjectId,
      ref: 'Team',
      required: [true, 'Session team is required!'],
    },

    status: {
      type: String,
      enum: ['open', 'onTime', 'tooLate', 'danger', 'finished'],
    },

    end: {
      type: Date,
    },

    timer: {
      type: Date,
    },

    type: {
      type: String,
      enum: ['bot', 'normal'],
      default: 'normal',
    },

    lastBotMessage: {
      type: mongoose.Schema.ObjectId,
      ref: 'Message',
    },

    referenceNo: {
      type: String,
    },
    refRequired: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

const Session = mongoose.model('Session', sessionSchema);

module.exports = Session;
