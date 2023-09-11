const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Team name is required!'],
    unique: true,
  },

  users: [
    {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
    },
  ],

  supervisor: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: [true, 'Team supervisor is required!'],
  },

  serviceHours: {
    type: mongoose.Schema.ObjectId,
    ref: 'Sevices',
  },

  //   answersSets: [
  //     {
  //       type: mongoose.Schema.ObjectId,
  //       ref: 'AnswersSet',
  //     },
  //   ],

  createdAt: {
    type: Date,
    default: Date.now(),
  },
});

const Team = mongoose.model('Team', teamSchema);
module.exports = Team;
