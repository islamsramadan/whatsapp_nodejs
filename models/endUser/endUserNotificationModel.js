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

    chat: {
      type: mongoose.Schema.ObjectId,
      ref: 'Chat',
      required: function () {
        this.type === 'messages';
      },
    },

    session: {
      type: mongoose.Schema.ObjectId,
      ref: 'Session',
    },

    event: {
      type: String,
      enum: [
        'newTicket',
        'solvedTicket',
        'newComment',
        'reopenTicket',
        'newMessages',
      ],
      required: true,
    },

    message: {
      type: String,
    },

    numbers: {
      type: Number,
      min: 0,
      default: 1,
    },

    sortingDate: {
      type: Date,
    },
  },
  { timestamps: true }
);

// Pre-save middleware to add client token before saving
notificationSchema.pre('save', async function (next) {
  if (!this.sortingDate) this.sortingDate = this.createdAt;

  let message = '';

  // Populate the ticket field with the order
  if (this.type === 'tickets' && !this.isModified('message')) {
    await this.populate('ticket', 'order');
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

    if (this.event === 'newMessages') {
      message = `New messages from customer services`;
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
