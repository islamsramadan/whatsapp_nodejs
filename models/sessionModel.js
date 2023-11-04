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
    },
    status: {
      type: String,
      enum: ['open', 'onTime', 'tooLate', 'danger'],
    },
    start: {
      type: Date,
      required: [true, 'Session start date is required!'],
    },
    end: {
      type: Date,
    },
  },
  { timestamps: true }
);

const Session = mongoose.model('Session', sessionSchema);

module.exports = Session;
