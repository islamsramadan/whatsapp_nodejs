const mongoose = require('mongoose');

const ticketLogSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: [
        'create',
        'assign',
        'transfer',
        'close',
        'comment',
        'status',
        'priority',
        'client',
      ],
      required: [true, 'Ticket log type is required!'],
    },

    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: true,
    },

    assignee: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
    },

    transfer: {
      from: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
      },
      to: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
      },
    },

    status: {
      type: mongoose.Schema.ObjectId,
      ref: 'TicketStatus',
    },

    priority: {
      type: String,
    },
  },
  { timestamps: true }
);

const TicketLog = mongoose.model('TicketLog', ticketLogSchema);
module.exports = TicketLog;
