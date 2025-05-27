const mongoose = require('mongoose');

const fieldTypeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },

    value: {
      type: String,
      required: true,
    },

    description: {
      type: String,
    },

    logo: {}, // ==========> To be determined

    creator: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

const FieldType = mongoose.model('FieldType', fieldTypeSchema);

module.exports = FieldType;
