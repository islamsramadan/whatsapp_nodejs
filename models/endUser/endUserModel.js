const mongoose = require('mongoose');

const endUserSchema = new mongoose.Schema(
  {
    nationalID: {
      type: String,
      required: [true, 'National ID is required!'],
      unique: [true, 'Unique national ID is required!'],
    },

    name: {
      type: String,
      required: [true, 'EndUser name is required!'],
    },

    phone: {
      type: String,
      required: [true, 'Phone number is required!'],
      unique: [true, 'Unique phone number is required!'],
      match: [/^966\d{9}$/, 'Invalid whatsapp number!'],
    },

    token: {
      type: String,
      select: false,
    },
  },
  { timestamps: true }
);

const EndUser = mongoose.model('EndUser', endUserSchema);
module.exports = EndUser;
