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

    session: {
      type: mongoose.Schema.ObjectId,
      ref: 'Session',
      // required: [true, 'Message must belong to a session!'], Remove it for the multi template end point
    },

    timer: {
      type: Date,
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
        'docLink',
        'location',
        'sticker',
        'contacts',
        'interactive',
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
        // enum: ['ar', 'en', 'en_US', 'en_GB'],
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
            enum: ['TEXT', 'DOCUMENT', 'IMAGE', 'VIDEO'],
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
          document: {
            link: { type: String },
            filename: { type: String },
          },
          image: {
            link: { type: String },
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
      type: {
        type: String,
        enum: ['file', 'link'],
        default: 'file',
      },
      file: {
        type: String,
        required: function () {
          if (this.type === 'document' && this.document.type === 'file') {
            return [true, 'Document message must have a document!'];
          } else {
            return false;
          }
        },
      },
      link: {
        type: String,
        required: function () {
          if (this.type === 'document' && this.document.type === 'link') {
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
        // required: function () {
        //   if (this.type === 'location') {
        //     return [true, 'Location message must have an address!'];
        //   } else {
        //     return false;
        //   }
        // },
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
        // required: function () {
        //   if (this.type === 'location') {
        //     return [true, 'Location message must have a name!'];
        //   } else {
        //     return false;
        //   }
        // },
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
            wa_id: String,
            type: { type: String },
          },
        ],
        emails: [
          {
            email: String,
            type: { type: String },
          },
        ],
        name: String,
        org: {
          company: String,
          department: String,
          title: String,
        },
      },
    ],

    interactive: {
      type: {
        type: String,
        enum: ['list', 'button', 'list_reply', 'button_reply'],
        required: function () {
          if (this.type === 'interactive') {
            return [true, 'Interactive type is required!'];
          } else {
            return false;
          }
        },
      },
      header: {
        type: {
          type: String,
          enum: ['text', 'image', 'video', 'document'],
        },
        text: String,
        // image: String,
        // video: String,
        // document: String,
      },
      body: {
        text: String, // max 1024 characteres
      },
      footer: {
        text: String, // max 60 characteres
      },
      action: {
        button: {
          type: String, // max 20 characters
        },
        sections: [
          {
            title: String,
            rows: [
              {
                id: String,
                title: String,
                description: String,
              },
            ],
          },
        ],
        buttons: [
          {
            type: {
              type: String,
              enum: ['reply'],
            },
            reply: {
              id: String,
              title: String,
            },
          },
        ],
      },
      list_reply: {
        id: String,
        title: String,
        description: String,
      },
      button_reply: {
        id: String,
        title: String,
      },
    },

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
      enum: [
        'received',
        'pending',
        'sent',
        'delivered',
        'seen',
        'read',
        'failed',
      ],
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
