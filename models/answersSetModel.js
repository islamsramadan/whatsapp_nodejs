const mongoose = require('mongoose');

const answersSetSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Answers' set name is required!"],
    unique: true,
  },

  answers: [
    {
      type: mongoose.Schema.ObjectId,
      ref: 'Answer',
    },
  ],

  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: [true, 'Answer set must have a creator!'],
  },

  type: {
    type: String,
    enum: ['public', 'private'],
    default: 'private',
  },
  createdAt: {
    type: Date,
    default: Date.now(),
  },
});

const AnswersSet = mongoose.model('AnswersSet', answersSetSchema);
module.exports = AnswersSet;
