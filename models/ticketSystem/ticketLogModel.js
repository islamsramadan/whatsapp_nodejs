const mongoose = require('mongoose');

const ticketLogSchema = new mongoose.Schema(
  {
    ticket: {
      type: mongoose.Schema.ObjectId,
      ref: 'Ticket',
      required: [true, 'Ticket is required!'],
    },

    type: {
      type: String,
      eunm: ['public', 'note'],
      default: 'public',
    },

    log: {
      type: String,
      enum: [
        'create',
        'assign',
        'transfer',
        'close',
        'comment',
        'form',
        'status',
        'priority',
        'client',
        'takeOwnership',
        'clientComment',
      ],
      required: [true, 'Ticket log type is required!'],
    },

    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: function () {
        return this.log !== 'clientComment';
      },
    },

    assignee: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
    },

    transfer: {
      from: {
        user: { type: mongoose.Schema.ObjectId, ref: 'User' },
        team: { type: mongoose.Schema.ObjectId, ref: 'Team' },
      },
      to: {
        user: { type: mongoose.Schema.ObjectId, ref: 'User' },
        team: { type: mongoose.Schema.ObjectId, ref: 'Team' },
      },
    },

    status: {
      type: mongoose.Schema.ObjectId,
      ref: 'TicketStatus',
    },

    priority: {
      type: String,
    },

    client: {
      name: { type: String },
      email: { type: String },
      number: { type: String },
    },
  },
  { timestamps: true }
);

const TicketLog = mongoose.model('TicketLog', ticketLogSchema);
module.exports = TicketLog;
