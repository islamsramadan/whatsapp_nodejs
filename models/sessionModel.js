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

    // start: {
    //   type: Date,
    //   required: [true, 'Session start date is required!'],
    // },

    end: {
      type: Date,
    },

    timer: {
      type: Date,
    },
  },
  { timestamps: true }
);

const Session = mongoose.model('Session', sessionSchema);

module.exports = Session;
