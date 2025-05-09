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
        'ticketTransfer',
        'reopenTicket',
        'newChat',
        'newMessages',
        'chatTransfer',
        'archiveChat',
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
      message = `New Chat ${this.chat._id}`;
    }

    if (this.event === 'newMessages') {
      message = `New messages on chat with ID ${this.chat._id}`;
    }

    if (this.event === 'chatTransfer') {
      message = `Chat with ID ${this.chat._id} has been transferred`;
    }

    if (this.event === 'archiveChat') {
      message = `Chat with ID ${this.chat._id} has been archived`;
    }

    this.message = message;
  }

  next();
});

const Notification = mongoose.model('Notification', notificationSchema);
module.exports = Notification;
