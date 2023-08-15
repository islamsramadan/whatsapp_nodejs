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
    enum: [
      'template',
      'text',
      'reaction',
      'image',
      'video',
      'audio',
      'document',
      'location',
      'sticker',
    ],
    required: [true, 'Message must have a type!'],
  },

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

  reaction: {
    emoji: {
      type: String,
      required: function () {
        if (this.type === 'reaction') {
          return [true, 'Reaction message must have a reaction!'];
        } else {
          return false;
        }
      },
    },
    reactedMessage: {
      type: mongoose.Schema.ObjectId,
      ref: 'Message',
      required: function () {
        if (this.type === 'reaction') {
          return [true, 'Reaction message must have a reacted message!'];
        } else {
          return false;
        }
      },
    },
  },

  image: {
    file: {
      type: String,
      required: function () {
        if (this.type === 'image') {
          return [true, 'Image message must have an image!'];
        } else {
          return false;
        }
      },
    },
    caption: {
      type: String,
    },
  },

  video: {
    file: {
      type: String,
      required: function () {
        if (this.type === 'video') {
          return [true, 'Video message must have a video!'];
        } else {
          return false;
        }
      },
    },
    caption: {
      type: String,
    },
  },

  audio: {
    file: {
      type: String,
      required: function () {
        if (this.type === 'audio') {
          return [true, 'Audio message must have an audio!'];
        } else {
          return false;
        }
      },
    },
    voice: {
      type: Boolean,
      required: function () {
        if (this.type === 'audio') {
          return [true, 'Audio message must have a boolean value for voice!'];
        } else {
          return false;
        }
      },
    },
  },

  document: {
    file: {
      type: String,
      required: function () {
        if (this.type === 'document') {
          return [true, 'Document message must have a document!'];
        } else {
          return false;
        }
      },
    },
    filename: {
      type: String,
      required: function () {
        if (this.type === 'document') {
          return [true, 'Document message must have a name!'];
        } else {
          return false;
        }
      },
    },
    caption: {
      type: String,
    },
  },

  location: {
    address: {
      type: String,
      required: function () {
        if (this.type === 'location') {
          return [true, 'Location message must have an address!'];
        } else {
          return false;
        }
      },
    },
    latitude: {
      type: Number,
      required: function () {
        if (this.type === 'location') {
          return [true, 'Location message must have a latitude!'];
        } else {
          return false;
        }
      },
    },
    longitude: {
      type: Number,
      required: function () {
        if (this.type === 'location') {
          return [true, 'Location message must have a longitude!'];
        } else {
          return false;
        }
      },
    },
    name: {
      type: String,
      required: function () {
        if (this.type === 'location') {
          return [true, 'Location message must have a name!'];
        } else {
          return false;
        }
      },
    },
  },

  sticker: {
    file: {
      type: String,
      required: function () {
        if (this.type === 'sticker') {
          return [true, 'Sticker message must have a sticker!'];
        } else {
          return false;
        }
      },
    },
    animated: {
      type: Boolean,
      required: function () {
        if (this.type === 'sticker') {
          return [
            true,
            'Sticker message must have a boolean value for animation!',
          ];
        } else {
          return false;
        }
      },
    },
  },

  contacts: [
    {
      phones: [
        {
          phone: String,
          type: String,
        },
      ],
      emails: [
        {
          type: String,
          email: String,
        },
      ],
      name: String,
    },
  ],

  reply: {
    type: mongoose.Schema.ObjectId,
    ref: 'Message',
  },

  status: {
    type: String,
    enum: ['pending', 'sent', 'delivered', 'seen', 'failed'],
    default: 'pending',
  },

  sent: {
    type: String,
  },

  delivered: {
    type: String,
  },

  seen: {
    type: String,
  },
});

const Message = mongoose.model('Message', messageSchema);
module.exports = Message;
