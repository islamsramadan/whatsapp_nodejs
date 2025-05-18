const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['tickets', 'messages'],
      required: true,
    },

    read: {
      type: Boolean,
      default: false,
    },

    endUser: {
      type: mongoose.Schema.ObjectId,
      ref: 'EndUser',
      required: true,
    },

    ticket: {
      type: mongoose.Schema.ObjectId,
      ref: 'Ticket',
      required: function () {
        this.type === 'tickets';
      },
    },

    ref: {
      type: String,
    },

    event: {
      type: String,
      enum: ['newTicket', 'solvedTicket', 'newComment', 'reopenTicket'],
      required: true,
    },

    message: {
      type: String,
    },

    sent: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Pre-save middleware to add client token before saving
notificationSchema.pre('save', async function (next) {
  let message = '';

  // Populate the ticket field with the order
  if (this.type === 'tickets' && !this.isModified('message')) {
    await this.populate('ticket', 'order ref');

    this.ref = this.ticket.ref;
  }

  if (!this.message) {
    if (this.event === 'newTicket') {
      message = `New Ticket no. ${this.ticket.order}`;
    }

    if (this.event === 'solvedTicket') {
      message = `Ticket no. ${this.ticket.order} has been solved and closed`;
    }

    if (this.event === 'newComment') {
      message = `New comment on ticket no. ${this.ticket.order}`;
    }

    if (this.event === 'reopenTicket') {
      message = `Ticket no. ${this.ticket.order} has been reopened`;
    }

    this.message = message;
  }

  next();
});

const EndUserNotification = mongoose.model(
  'EndUserNotification',
  notificationSchema
);
module.exports = EndUserNotification;
