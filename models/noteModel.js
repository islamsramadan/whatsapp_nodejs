const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema(
  {
    chat: {
      type: mongoose.Schema.ObjectId,
      ref: 'Chat',
      required: [true, 'Note chat is required!'],
    },
    title: {
      type: String,
    },
    body: {
      type: String,
      required: [true, 'Note body is required!'],
    },
    creator: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'Note creator is required!'],
    },
    updater: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
    },
    tag: [
      {
        type: String,
        enum: [
          'Urgent',
          'Resolved',
          'Pending',
          'Important',
          'Technical Support',
          'Feedback',
          'Action Required',
          'Information Provided',
          'Needs Clarification',
          'Weekly Review',
          'Payment Failed',
          'Refund Request',
          'Login Issue',
        ],
      },
    ],
    time: String,
  },
  { timestamps: true }
);

const convertDate = (timestamp) => {
  const date = new Date(timestamp);

  const hours =
    (date.getHours() + '').length > 1 ? date.getHours() : `0${date.getHours()}`;

  const minutes =
    (date.getMinutes() + '').length > 1
      ? date.getMinutes()
      : `0${date.getMinutes()}`;

  const seconds =
    (date.getSeconds() + '').length > 1
      ? date.getSeconds()
      : `0${date.getSeconds()}`;

  const dateString = date.toDateString();

  const dateFormat = `${hours}:${minutes}:${seconds}, ${dateString}`;

  return dateFormat;
};

noteSchema.pre('save', async function (next) {
  this.time = convertDate(this.createdAt);
  next();
});

const Note = mongoose.model('Note', noteSchema);

module.exports = Note;
