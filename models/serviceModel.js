const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Template name is required!'],
      unique: true,
    },

    timezone: String,

    durations: [
      {
        day: {
          type: String,
          enum: [
            'Sunday',
            'Monday',
            'Tuesday',
            'Wednesday',
            'Thursday',
            'Friday',
            'Saturday',
          ],
          required: [true, 'Day is required!'],
        },
        from: {
          hours: {
            type: Number,
            required: [true, 'Day Starting hours are required!'],
          },
          minutes: {
            type: Number,
            required: [true, 'Day Starting minutes are required!'],
          },
        },
        to: {
          hours: {
            type: Number,
            required: [true, 'Day ending hours are required!'],
          },
          minutes: {
            type: Number,
            required: [true, 'Day ending minutes are required!'],
          },
        },
      },
    ],

    responseTime: {
      hours: {
        type: Number,
        required: [true, 'Response time hours are required!'],
      },
      minutes: {
        type: Number,
        required: [true, 'Response time minutes are required!'],
      },
    },

    creator: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'Service creator is required!'],
    },
  },
  { timestamps: true }
);

const Service = mongoose.model('Service', serviceSchema);

module.exports = Service;
