const mongoose = require('mongoose');

const emailSchema = new mongoose.Schema(
  {
    subject: {
      type: String,
    },

    from: {},

    replyTo: {},

    to: {},

    cc: {},

    bcc: {},

    date: {},

    messageId: {
      type: String,
      required: [true, 'Email message ID is required!'],
      unique: true,
    },

    html: {},

    text: {},

    textAsHtml: {},

    attachments: [{}],

    inReplyTo: {},

    references: {},
  },
  { timestamps: true }
);

emailSchema.index({ messageId: 1 }, { unique: true });

const Email = mongoose.model('Email', emailSchema);

module.exports = Email;
