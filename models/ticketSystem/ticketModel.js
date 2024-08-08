const mongoose = require('mongoose');
const validator = require('validator');

const questionSchema = new mongoose.Schema({
  field: {
    type: mongoose.Schema.ObjectId,
    ref: 'Field',
    required: true,
    // unique: true,
  },
  answer: [
    {
      type: String,
    },
  ],
  // order: {
  //   type: Number,
  //   required: true,
  // },
});

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

const ticketSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['manual', 'automatic'],
      default: 'manual',
    },

    order: {
      type: Number,
      required: true,
      unique: true,
    },

    category: {
      type: mongoose.Schema.ObjectId,
      ref: 'TicketCategory',
      required: function () {
        if (this.type === 'manual') {
          return [true, 'Ticket category is required!'];
        } else {
          return false;
        }
      },
    },

    creator: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: function () {
        if (this.type === 'manual') {
          return [true, 'Ticket creator is required!'];
        } else {
          return false;
        }
      },
    },

    assignee: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'Ticket must be assigned to user!'],
    },

    team: {
      type: mongoose.Schema.ObjectId,
      ref: 'Team',
      required: [true, 'Ticket team is required!'],
    },

    client: {
      name: {
        type: String,
      },
      email: {
        type: String,
        required: function () {
          if (!this.client.number) {
            return [true, 'Client email is required!'];
          } else {
            return false;
          }
        },
        validate: [validator.isEmail, 'Invalid email!'],
      },
      number: {
        type: String,
        required: function () {
          if (!this.client.email) {
            return [true, 'Client number is required!'];
          } else {
            return false;
          }
        },
        match: [/\d{10,}/, 'Invalid client whatsapp number!'],
      },
    },

    priority: {
      type: String,
      enum: ['Low', 'Normal', 'High', 'Urgent'],
      default: 'Normal',
    },

    tags: {
      type: [String],
    },

    status: {
      type: mongoose.Schema.ObjectId,
      ref: 'TicketStatus',
      required: [true, 'Ticket status is required!'],
    },

    form: {
      type: mongoose.Schema.ObjectId,
      ref: 'Form',
      required: function () {
        if (this.type === 'manual') {
          return [true, 'Ticket form is required!'];
        } else {
          return false;
        }
      },
    },

    questions: {
      type: [questionSchema],
    },

    attachments: {
      type: [attachmentSchema],
      validate: {
        validator: function (attachments) {
          // Check if each attachment contains the required fields
          for (let attachment of attachments) {
            if (!attachment.file) {
              return false;
            }
          }
          return true;
        },
        message: 'Attachment must contain file!',
      },
    },
  },
  { timestamps: true }
);

const Ticket = mongoose.model('Ticket', ticketSchema);
module.exports = Ticket;
