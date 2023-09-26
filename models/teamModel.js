const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema(
  {
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

    creator: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'Team creator is required!'],
    },

    serviceHours: {
      type: mongoose.Schema.ObjectId,
      ref: 'Sevices',
      // required: [true, 'Team service hours are required!'],
    },

    answersSets: [
      {
        type: mongoose.Schema.ObjectId,
        ref: 'AnswersSet',
        // required: [true, 'Team answers sets are required!'],
      },
    ],
  },
  { timestamps: true }
);

const Team = mongoose.model('Team', teamSchema);
module.exports = Team;
