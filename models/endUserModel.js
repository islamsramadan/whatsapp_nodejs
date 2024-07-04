const mongoose = require('mongoose');

const endUserSchema = new mongoose.Schema(
  {
    clientID: {
      type: String,
      required: [true, 'EndUser ID is required!'],
      unique: [true, 'Unique client ID is required!'],
    },

    name: {
      type: String,
      required: [true, 'EndUser name is required!'],
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
