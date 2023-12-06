const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema(
  {
    client: {
      type: String,
      required: [true, 'Chat must have a client!'],
      match: [/\d{10,}/, 'Invalid client whatsapp number!'],
    },

    contactName: {
      type: String,
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
    },

    team: {
      type: mongoose.Schema.ObjectId,
      ref: 'Team',
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

    lastSession: {
      type: mongoose.Schema.ObjectId,
      ref: 'Session',
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
