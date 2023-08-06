const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Answer name is required!'],
    unique: true,
  },

  body: {
    type: String,
    required: [true, 'Answer body is required!'],
  },

  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: [true, 'Answer must have a creator!'],
  },

  answersSet: {
    type: mongoose.Schema.ObjectId,
    ref: 'AnswersSet',
    required: [true, 'Answer must have an answer set!'],
  },
  createdAt: {
    type: Date,
    default: Date.now(),
  },
});

const Answer = mongoose.model('Answer', answerSchema);
module.exports = Answer;
