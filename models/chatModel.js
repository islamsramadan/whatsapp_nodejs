const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  client: {
    type: String,
    required: [true, 'Chat must have a client!'],
    // minLength: [10, 'Client Id should have minimum 10 digits'],
    // maxLength: [10, 'Client Id should have maximum 10 digits'],
    // match: [/\d{10}/, 'Client Id should only have digits'],
  },

  //   messages: [
  //     {
  //       type: mongoose.Schema.ObjectId,
  //       ref: 'Message',
  //     },
  //   ],

  users: [
    {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
    },
  ],

  activeUser: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: [true, 'Chat must have an active user!'],
  },

  createdAt: {
    type: Date,
    default: Date.now(),
  },
});

const Chat = mongoose.model('Chat', chatSchema);
module.exports = Chat;
