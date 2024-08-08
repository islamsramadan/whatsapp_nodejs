const mongoose = require('mongoose');

const ticketCategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Ticket category name is required!'],
      unique: true,
    },

    description: {
      type: String,
    },

    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },

    creator: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'Ticket category creator is required!'],
    },

    tickets: [
      {
        type: mongoose.Schema.ObjectId,
        ref: 'Ticket',
      },
    ],
  },
  { timestamps: true }
);

ticketCategorySchema.index({ name: 1 }, { unique: true });

const TicketCategory = mongoose.model('TicketCategory', ticketCategorySchema);
module.exports = TicketCategory;
