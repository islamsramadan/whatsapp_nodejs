const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema(
  {
    number: {
      type: String,
      required: [true, 'Client must have a number!'],
      unique: [true, 'This client number already exist!'],
      match: [/\d{10,}/, 'Invalid client whatsapp number!'],
    },
    whatsappName: {
      type: String,
    },
    externalName: {
      type: String,
    },
    name: {
      type: String,
    },
    updater: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

const Contact = mongoose.model('Contact', contactSchema);
module.exports = Contact;
