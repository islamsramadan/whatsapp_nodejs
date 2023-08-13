const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  whatsappID: {
    type: String,
    required: [true, 'Message must have a whatsapp message id!'],
  },

  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: [true, 'Message must have a user!'],
  },

  chat: {
    type: mongoose.Schema.ObjectId,
    ref: 'Chat',
    required: [true, 'Message must belong to a chat!'],
  },

  from: {
    type: String,
    required: [true, 'Message must have a sender!'],
    match: [/\d{10,}/, 'Invalid sender whatsapp number!'],
  },

  to: {
    type: String,
    required: [true, 'Message must have a receiver!'],
    match: [/\d{10,}/, 'Invalid receiver whatsapp number!'],
  },

  type: {
    type: String,
    enum: ['template', 'text', 'image', 'document'],
    required: [true, 'Message must have a type!'],
  },

  // template: [
  //   {

  //   }
  // ],

  text: {
    type: String,
    required: function () {
      if (this.type === 'text') {
        return [true, 'Text message must have a text!'];
      } else {
        return false;
      }
    },
  },

  image: {
    type: String,
    required: function () {
      if (this.type === 'image') {
        return [true, 'Image message must have an image!'];
      } else {
        return false;
      }
    },
  },

  document: {
    type: String,
    required: function () {
      if (this.type === 'document') {
        return [true, 'Document message must have a document!'];
      } else {
        return false;
      }
    },
  },
  // document: {
  //   type: String,
  //   required: function () {
  //     if (this.type === 'document') {
  //       return [true, 'Document message must have a document!'];
  //     } else {
  //       return false;
  //     }
  //   },
  // },

  sent: {
    type: Date,
    default: Date.now(),
  },

  delivered: {
    type: Date,
  },

  seen: {
    type: Date,
  },
});

const Message = mongoose.model('Message', messageSchema);
module.exports = Message;
