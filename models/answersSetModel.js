const mongoose = require('mongoose');

const answersSetSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      // required: [true, 'Answers set name is required!'],
      required: function () {
        if (this.type === 'public') {
          return [true, 'Answers set name is required!'];
        } else {
          return false;
        }
      },
      unique: true,
    },

    answers: [
      {
        type: mongoose.Schema.ObjectId,
        ref: 'Answer',
      },
    ],

    creator: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'Answers set must have a creator!'],
    },

    type: {
      type: String,
      enum: ['public', 'private'],
      default: 'public',
    },
  },
  { timestamps: true }
);

const AnswersSet = mongoose.model('AnswersSet', answersSetSchema);
module.exports = AnswersSet;
