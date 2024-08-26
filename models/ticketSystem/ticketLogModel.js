const mongoose = require('mongoose');

const ticketLogSchema = new mongoose.Schema(
  {
    type: {
      type: String,
    },
  },
  { timestamps: true }
);

const TicketLog = mongoose.model('TicketLog', ticketLogSchema);
module.exports = TicketLog;
