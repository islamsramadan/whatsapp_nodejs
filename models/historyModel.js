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
        'userTransfer',
        'teamTransfer',
        'botTransfer',
        'takeOwnership',
        'archive',
        'start',
        'receive',
      ],
      required: [true, 'required!'],
    },

    transfer: {
      type: {
        type: String,
        enum: ['user', 'team', 'bot'],
        required: function () {
          if (this.actionType === 'transfer') {
            return [true, 'required!'];
          } else {
            return false;
          }
        },
      },
      from: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: function () {
          if (this.actionType === 'transfer' && this.transfer.type !== 'bot') {
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
      fromTeam: {
        type: mongoose.Schema.ObjectId,
        ref: 'Team',
        required: function () {
          if (this.actionType === 'transfer' && this.transfer.type === 'team') {
            return [true, 'required!'];
          } else {
            return false;
          }
        },
      },
      toTeam: {
        type: mongoose.Schema.ObjectId,
        ref: 'Team',
        required: function () {
          if (
            this.actionType === 'transfer' &&
            (this.transfer.type === 'team' || this.transfer.type === 'bot')
          ) {
            return [true, 'required!'];
          } else {
            return false;
          }
        },
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
