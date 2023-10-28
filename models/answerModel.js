const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Answer name is required!'],
      // unique: true,
    },

    body: {
      type: String,
      required: [true, 'Answer body is required!'],
    },

    creator: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'Answer must have a creator!'],
    },

    answersSet: {
      type: mongoose.Schema.ObjectId,
      ref: 'AnswersSet',
      required: [true, 'Answer must have an answer set!'],
    },
  },
  { timestamps: true }
);

answerSchema.index({ name: 1, answersSet: 1 }, { unique: true });

const Answer = mongoose.model('Answer', answerSchema);
module.exports = Answer;
