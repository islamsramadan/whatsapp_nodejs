const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Conversation name is required!'],
      unique: true,
    },

    description: {
      type: String,
    },

    bodyOn: {
      type: String,
      required: [true, 'Conversation body for working hours is required!'],
    },

    bodyOff: {
      type: String,
      required: [true, 'Conversation body for not working hours is required!'],
    },

    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'Conversation creator is required!'],
    },

    teams: [
      {
        type: mongoose.Schema.ObjectId,
        ref: 'Team',
      },
    ],
  },
  { timestamps: true }
);

const Conversation = mongoose.model('Conversation', conversationSchema);

module.exports = Conversation;
