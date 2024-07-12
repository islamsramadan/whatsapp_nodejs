const mongoose = require('mongoose');

const logSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['user', 'chat'],
      required: [true, 'Log type is required!'],
    },

    chat: {
      type: mongoose.Schema.ObjectId,
      ref: 'Chat',
      //   required: [true, 'Chat is required!'],
    },

    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'User is required!'],
    },

    event: {
      type: String,
    },
  },
  { timestamps: true }
);

const Log = mongoose.model('Log', logSchema);

module.exports = Log;
