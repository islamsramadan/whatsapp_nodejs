const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['whatsapp', 'endUser'],
      default: 'whatsapp',
    },

    client: {
      type: String,
      // required: function () {
      //   if (!this.type || this.type === 'whatsapp') {
      //     return [true, 'Chat must have a client!'];
      //   } else {
      //     return false;
      //   }
      // },
      unique: [true, 'Unique client is required!'],
      sparse: true, // Allows the field to be unique only when it is not null
      match: [/\d{10,}/, 'Invalid client whatsapp number!'],
    },

    endUser: {
      type: mongoose.Schema.ObjectId,
      ref: 'EndUser',
      required: function () {
        if (this.type === 'endUser') {
          return [true, 'Chat must have an end user!'];
        } else {
          return false;
        }
      },
      unique: [true, 'Unique end user is required!'],
      sparse: true, // Allows the field to be unique only when it is not null
    },

    contactName: {
      type: mongoose.Schema.ObjectId,
      ref: 'Contact',
    },

    users: [
      {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
      },
    ],

    currentUser: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
    },

    team: {
      type: mongoose.Schema.ObjectId,
      ref: 'Team',
    },

    status: {
      type: String,
      enum: ['open', 'archived'],
      default: 'open',
    },

    lastMessage: {
      type: mongoose.Schema.ObjectId,
      ref: 'Message',
    },

    lastSession: {
      type: mongoose.Schema.ObjectId,
      ref: 'Session',
    },

    notification: {
      type: Boolean,
      default: false,
    },

    session: {
      type: Date,
    },
  },
  { timestamps: true }
);

const Chat = mongoose.model('Chat', chatSchema);
module.exports = Chat;
