const mongoose = require('mongoose');

const fieldSchema = new mongoose.Schema({
  field: {
    type: mongoose.Schema.ObjectId,
    ref: 'Field',
    required: true,
  },
  order: {
    type: Number,
    required: true,
    min: 1,
  },
});

const formSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
    },

    description: {
      type: String,
    },

    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },

    creator: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: true,
    },

    updater: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
    },

    default: {
      type: Boolean,
      default: false,
    },

    order: {
      type: Number,
      required: true,
    },

    fields: {
      type: [fieldSchema],
      validate: {
        validator: function (fields) {
          if (!fields || fields.length === 0) {
            return false;
          }

          const fieldSet = new Set();
          const orderSet = new Set();

          for (let item of fields) {
            if (!item.field || !item.order) {
              return false;
            }

            if (
              fieldSet.has(item.field.toString()) ||
              orderSet.has(item.order)
            ) {
              return false;
            }

            fieldSet.add(item.field.toString());
            orderSet.add(item.order);
          }

          return true;
        },
        message: 'Form fields must be unique and contain required fields!',
      },
    },
  },
  { timestamps: true }
);

formSchema.index({ name: 1 }, { unique: true });

const Form = mongoose.model('Form', formSchema);

module.exports = Form;
