const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema(
  {
    client: {
      type: String,
      required: [true, 'Chat must have a client!'],
      match: [/\d{10,}/, 'Invalid client whatsapp number!'],
    },

    users: [
      {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
      },
    ],

    currentUser: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      // required: [true, 'Chat must have an active user!'],
    },

    team: {
      type: mongoose.Schema.ObjectId,
      ref: 'Team',
      // required: [true, 'Chat must have a team!'],
    },

    status: {
      type: String,
      enum: ['open', 'archived'],
      default: 'open',
    },

    lastMessage: {
      type: mongoose.Schema.ObjectId,
      ref: 'Message',
    },

    notification: {
      type: Boolean,
      default: false,
    },

    session: {
      type: Date,
    },
  },
  { timestamps: true }
);

const Chat = mongoose.model('Chat', chatSchema);
module.exports = Chat;
