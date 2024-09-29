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
        'newChat',
        'newMessages',
        'chatTransfer',
      ],
      required: true,
    },
  },
  { timestamps: true }
);

const Notification = mongoose.model('Notification', notificationSchema);
module.exports = Notification;
