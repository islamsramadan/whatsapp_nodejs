const mongoose = require('mongoose');

const historySchema = new mongoose.Schema(
  {
    chat: {
      type: mongoose.Schema.ObjectId,
      ref: 'Chat',
      required: [true, 'required!'],
    },

    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'required!'],
    },

    actionType: {
      type: String,
      enum: [
        'transfer',
        'botTransfer',
        'takeOwnership',
        'archive',
        'start',
        'receive',
      ],
      required: [true, 'required!'],
    },

    transfer: {
      from: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: function () {
          if (this.actionType === 'transfer') {
            return [true, 'required!'];
          } else {
            return false;
          }
        },
      },
      to: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: function () {
          if (this.actionType === 'transfer') {
            return [true, 'required!'];
          } else {
            return false;
          }
        },
      },
    },

    botTransfer: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: function () {
        if (this.actionType === 'botTransfer') {
          return [true, 'required!'];
        } else {
          return false;
        }
      },
    },

    takeOwnership: {
      from: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: function () {
          if (this.actionType === 'takeOwnership') {
            return [true, 'required!'];
          } else {
            return false;
          }
        },
      },
      to: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: function () {
          if (this.actionType === 'takeOwnership') {
            return [true, 'required!'];
          } else {
            return false;
          }
        },
      },
    },

    archive: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: function () {
        if (this.actionType === 'archive') {
          return [true, 'required!'];
        } else {
          return false;
        }
      },
    },

    start: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: function () {
        if (this.actionType === 'start') {
          return [true, 'required!'];
        } else {
          return false;
        }
      },
    },

    receive: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: function () {
        if (this.actionType === 'receive') {
          return [true, 'required!'];
        } else {
          return false;
        }
      },
    },
  },
  { timestamps: true }
);

const ChatHistory = mongoose.model('ChatHistory', historySchema);
module.exports = ChatHistory;
