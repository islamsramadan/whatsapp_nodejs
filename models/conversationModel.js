const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Conversation name is required!'],
    unique: true,
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

  createdAt: {
    type: Date,
    default: Date.now(),
  },
});

const Conversation = mongoose.model('Conversation', conversationSchema);

module.exports = Conversation;
