const mongoose = require('mongoose');

const fieldSchema = new mongoose.Schema(
  {
    type: {
      type: mongoose.Schema.ObjectId,
      ref: 'FieldType',
      required: [true, 'Field type is required!'],
    },

    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },

    name: {
      type: String,
      required: [true, 'Field name is required!'],
    },

    description: {
      type: String,
    },

    required: {
      type: Boolean,
      default: true,
    },

    solveRequired: {
      type: Boolean,
      default: true,
    },

    tag: {
      type: Boolean,
      default: false,
    },

    creator: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'Feild creator is required!'],
    },

    endUserView: {
      type: String,
      required: true,
    },

    endUserPermission: {
      type: String,
      enum: ['hidden', 'view', 'edit'],
      default: 'view',
    },

    values: [{ type: String }],

    defaultValue: {
      type: String,
      // validate: {
      //   validator: function (value) {
      //     if (value && !this.values.includes(value)) {
      //       return false;
      //     }
      //     return true;
      //   },
      //   message: 'Values must include default value!',
      // },
    },

    forms: [
      {
        type: mongoose.Schema.ObjectId,
        ref: 'Form',
      },
    ],
  },
  { timestamps: true }
);

const Field = mongoose.model('Field', fieldSchema);

module.exports = Field;
