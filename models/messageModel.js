const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: [true, 'Message must have a user!'],
  },

  chat: {
    type: mongoose.Schema.ObjectId,
    ref: 'Chat',
    required: [true, 'Message must belong to a chat!'],
  },

  type: {
    type: String,
    enum: ['template', 'text', 'image'],
    required: [true, 'Message must have a type!'],
  },

  body: {
    type: String,
    required: [true, 'Message must have a body!'],
  },

  image: {
    type: String,
  },

  createdAt: {
    type: Date,
    default: Date.now(),
  },
});

const Message = mongoose.model('Message', messageSchema);
module.exports = Message;
