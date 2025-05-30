const mongoose = require('mongoose');

const ticketStatusSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Status name is required!'],
      unique: true,
    },

    endUserDisplayName: {
      type: String,
      required: [true, 'End user display name is required!'],
    },

    description: {
      type: String,
    },

    category: {
      type: String,
      enum: ['new', 'open', 'pending', 'solved'],
      default: ['open'],
    },

    default: {
      type: Boolean,
      default: false,
    },

    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },

    creator: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'Status creator is required!'],
    },

    updater: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

const TicketStatus = mongoose.model('TicketStatus', ticketStatusSchema);

module.exports = TicketStatus;
