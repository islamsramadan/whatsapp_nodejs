const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    whatsappID: {
      type: String,
      required: [true, 'Message must have a whatsapp message id!'],
      unique: true,
    },

    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      // required: [true, 'Message must have a user!'],
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

    // to: {
    //   type: String,
    //   required: [true, 'Message must have a receiver!'],
    //   match: [/\d{10,}/, 'Invalid receiver whatsapp number!'],
    // },

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
        'unsupported',
      ],
      required: [true, 'Message must have a type!'],
    },

    template: {
      name: {
        type: String,
        required: function () {
          if (this.type === 'template') {
            return [true, 'Template message must have a template name!'];
          } else {
            return false;
          }
        },
      },
      language: {
        type: String,
        enum: ['ar', 'en', 'en_US'],
        required: function () {
          if (this.type === 'template') {
            return [true, 'Template message must have a template language!'];
          } else {
            return false;
          }
        },
      },
      category: {
        type: String,
        enum: ['MARKETING', 'UTILITY', 'AUTHENTICATION'],
        required: function () {
          if (this.type === 'template') {
            return [true, 'Template message must have a template category!'];
          } else {
            return false;
          }
        },
      },
      components: [
        {
          type: {
            type: String,
            enum: ['HEADER', 'BODY', 'FOOTER', 'BUTTONS'],
            required: [true, 'Template component type is required!'],
          },
          format: {
            type: String,
            enum: ['TEXT'],
            required: function () {
              if (this.type === 'template') {
                this.template.components.map((comp) => {
                  if (comp.type === 'HEADER') {
                    return [
                      true,
                      'Template header component must have a format type!',
                    ];
                  } else {
                    return false;
                  }
                });
              } else {
                return false;
              }
            },
          },
          text: {
            type: String,
          },
          buttons: [
            {
              type: {
                type: String,
                enum: ['QUICK_REPLY'],
              },
              text: {
                type: String,
              },
            },
          ],
        },
      ],
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

    // contacts: [
    //   {
    //     phones: [
    //       {
    //         phone: String,
    //         type: String,
    //       },
    //     ],
    //     emails: [
    //       {
    //         type: String,
    //         email: String,
    //       },
    //     ],
    //     name: String,
    //   },
    // ],

    reply: {
      type: mongoose.Schema.ObjectId,
      ref: 'Message',
    },

    clientReaction: {
      emoji: {
        type: String,
      },
      time: {
        type: String,
      },
    },

    userReaction: {
      emoji: {
        type: String,
      },
      time: {
        type: String,
      },
      user: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
      },
    },

    forwarded: {
      type: Boolean,
    },

    status: {
      type: String,
      enum: ['received', 'pending', 'sent', 'delivered', 'seen', 'failed'],
      default: 'pending',
    },

    received: {
      type: String,
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
  },
  { timestamps: true }
);

const Message = mongoose.model('Message', messageSchema);
module.exports = Message;
