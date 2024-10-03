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

    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
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

    event: {
      type: String,
      enum: [
        'newTicket',
        'solvedTicket',
        'newComment',
        'ticketTransfer',
        'reopenTicket',
        'newChat',
        'newMessages',
        'chatTransfer',
      ],
      required: true,
    },

    message: {
      type: String,
    },
  },
  { timestamps: true }
);

// Pre-save middleware to add client token before saving
notificationSchema.pre('save', async function (next) {
  let message = '';

  // Populate the ticket field with the order
  if (this.type === 'tickets' && !this.isModified('message')) {
    await this.populate('ticket', 'order');
  }

  // Populate the chat field with the client number
  if (this.type === 'messages' && !this.isModified('message')) {
    await this.populate('chat', 'client');
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

    if (this.event === 'ticketTransfer') {
      message = `Ticket no. ${this.ticket.order} has been transferred`;
    }

    if (this.event === 'reopenTicket') {
      message = `Ticket no. ${this.ticket.order} has been reopened`;
    }

    if (this.event === 'newChat') {
      message = `New Chat no. ${this.chat.client}`;
    }

    if (this.event === 'newMessages') {
      message = `New messages on chat no. ${this.chat.client}`;
    }

    if (this.event === 'chatTransfer') {
      message = `Chat no. ${this.chat.client} has been transferred`;
    }

    this.message = message;
  }

  next();
});

const Notification = mongoose.model('Notification', notificationSchema);
module.exports = Notification;
