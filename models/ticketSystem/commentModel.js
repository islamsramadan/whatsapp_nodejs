const mongoose = require('mongoose');

const attachmentSchema = new mongoose.Schema({
  file: {
    type: String,
    required: function () {
      return !this.text;
    },
  },
  filename: {
    type: String,
  },
});

const commentSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['note', 'public', 'user'],
      default: 'public',
    },

    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: function () {
        return this.type !== 'user';
      },
    },

    ticket: {
      type: mongoose.Schema.ObjectId,
      ref: 'Ticket',
      required: [true, 'Comment ticket is required!'],
    },

    text: {
      type: String,
      required: function () {
        if (
          !this.attachments ||
          this.attachments.length === 0 ||
          !this.attachments[0].file
        ) {
          return [true, 'Comment body is required!'];
        } else {
          return false;
        }
      },
    },

    attachments: {
      type: [attachmentSchema],
      validate: {
        validator: function (attachments) {
          // Check if there is at least one attachment
          if (!this.text && (!attachments || attachments.length === 0)) {
            return false;
          }
          // Check if each attachment contains the required fields
          for (let attachment of attachments) {
            if (!attachment.file) {
              return false;
            }
          }
          return true;
        },
        message: 'Attachments must contain at least one file!',
      },
    },
  },
  { timestamps: true }
);

const Comment = mongoose.model('Comment', commentSchema);

module.exports = Comment;
