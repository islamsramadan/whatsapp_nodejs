const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Department name is required!'],
      unique: true,
    },

    default: {
      type: Boolean,
      default: false,
    },

    parent: {
      type: mongoose.Schema.ObjectId,
      ref: 'Department',
    },

    supervisor: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'Department supervisor is required!'],
    },

    employees: [
      {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
      },
    ],

    children: [
      {
        type: mongoose.Schema.ObjectId,
        ref: 'Department',
      },
    ],

    //   servicesHours: {
    //     type: mongoose.Schema.ObjectId,
    //     ref: 'Sevices',
    //   },
    //   answersSets: [
    //     {
    //       type: mongoose.Schema.ObjectId,
    //       ref: 'AnswersSet',
    //     },
    //   ],
  },
  { timestamps: true }
);

const Department = mongoose.model('Department', departmentSchema);
module.exports = Department;
