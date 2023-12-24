const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Team name is required!'],
      unique: true,
    },

    users: {
      type: [
        {
          type: mongoose.Schema.ObjectId,
          ref: 'User',
        },
      ],
      validate: {
        validator: function (array) {
          // Use a Set to remove duplicate ObjectId elements and compare its size to the original array
          const uniqueValues = new Set(array.map((objId) => objId.toString())); // Convert ObjectId to strings for comparison
          return uniqueValues.size === array.length;
        },
        message: "Team users couldn't have duplicate users IDs!",
      },
    },

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
      ref: 'Service',
      required: [true, 'Team service hours are required!'],
    },

    answersSets: [
      {
        type: mongoose.Schema.ObjectId,
        ref: 'AnswersSet',
      },
    ],

    conversation: {
      type: mongoose.Schema.ObjectId,
      ref: 'Conversation',
      required: [true, 'Team conversation is required!'],
    },

    default: {
      type: Boolean,
      default: false,
    },

    bot: {
      type: Boolean,
      default: false,
    },

    photo: {
      type: String,
      // default: 'team_photo',
    },
  },
  { timestamps: true }
);

const Team = mongoose.model('Team', teamSchema);
module.exports = Team;
