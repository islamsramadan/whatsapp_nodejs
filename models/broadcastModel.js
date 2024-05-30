const mongoose = require('mongoose');

const broadcastSchema = new mongoose.Schema(
  {
    template: {
      type: String,
      required: [true, 'Template is required!'],
    },

    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'User is required!'],
    },

    results: [
      {
        client: { type: String },
        message: { type: mongoose.Schema.ObjectId, ref: 'Message' },
        status: { type: String },
      },
    ],
  },
  { timestamps: true }
);

const Broadcast = mongoose.model('Broadcast', broadcastSchema);

module.exports = Broadcast;
