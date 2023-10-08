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
      required: [true, 'Chat must have an active user!'],
    },

    lastMessage: {
      type: mongoose.Schema.ObjectId,
      ref: 'Message',
    },

    session: {
      type: Date,
    },
  },
  { timestamps: true }
);

const Chat = mongoose.model('Chat', chatSchema);
module.exports = Chat;
