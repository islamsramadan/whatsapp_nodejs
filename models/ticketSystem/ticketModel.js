const mongoose = require('mongoose');
const validator = require('validator');

const questionSchema = new mongoose.Schema({
  field: {
    type: mongoose.Schema.ObjectId,
    ref: 'Field',
    required: true,
  },
  answer: [
    {
      type: String,
    },
  ],
});

const ticketSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['manual', 'endUser', 'automatic'],
      default: 'manual',
    },

    order: {
      type: Number,
      required: true,
      unique: true,
      min: 1,
    },

    category: {
      type: mongoose.Schema.ObjectId,
      ref: 'TicketCategory',
      required: [true, 'Ticket category is required!'],
    },

    creator: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: function () {
        if (this.type === 'manual') {
          return [true, 'Ticket creator is required!'];
        } else {
          return false;
        }
      },
    },

    endUser: {
      type: mongoose.Schema.ObjectId,
      ref: 'EndUser',
      required: function () {
        if (this.type === 'endUser') {
          return [true, 'Ticket end user is required!'];
        } else {
          return false;
        }
      },
    },

    assignee: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'Ticket must be assigned to user!'],
    },

    team: {
      type: mongoose.Schema.ObjectId,
      ref: 'Team',
      required: [true, 'Ticket team is required!'],
    },

    users: [
      {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
      },
    ],

    client: {
      name: {
        type: String,
      },
      email: {
        type: String,
        // required: function () {
        //   if (!this.client.number) {
        //     return [true, 'Client email is required!'];
        //   } else {
        //     return false;
        //   }
        // },
        validate: [validator.isEmail, 'Invalid email!'],
      },
      number: {
        type: String,
        // required: function () {
        //   if (!this.client.email) {
        //     return [true, 'Client number is required!'];
        //   } else {
        //     return false;
        //   }
        // },
        match: [/\d{10,}/, 'Invalid client whatsapp number!'],
      },
    },

    priority: {
      type: String,
      enum: ['Low', 'Normal', 'High', 'Urgent'],
      default: 'Normal',
    },

    tags: {
      type: [String],
    },

    status: {
      type: mongoose.Schema.ObjectId,
      ref: 'TicketStatus',
      required: [true, 'Ticket status is required!'],
    },

    refNo: {
      type: String,
      required: true,
    },

    requestNature: {
      type: String,
      enum: ['Request', 'Complaint', 'Inquiry'],
      required: true,
    },

    requestType: {
      type: String,
      enum: [
        'RD0',
        'Edit RD0',
        'Missing Data',
        'Design Review',
        'RD6',
        'RD7',
        'Finance',
        'Inspection',
        'MALATH Issue',
        'MALATH Complaint',
        'Other',
      ],
      required: true,
    },

    complaintReport: {
      type: Boolean,
      default: false,
    },

    form: {
      type: mongoose.Schema.ObjectId,
      ref: 'Form',
      required: function () {
        if (this.type === 'manual') {
          return [true, 'Ticket form is required!'];
        } else {
          return false;
        }
      },
    },

    questions: {
      type: [questionSchema],
    },

    solvingTime: {
      type: Date,
    },

    solvingUser: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
    },

    clientToken: {
      type: String,
      unique: true,
      // select: false,
    },

    rating: {
      type: String,
      enum: ['Positive', 'Negative', 'Neutral'],
    },

    feedback: {
      type: String,
    },

    ver: { type: String },
    system: { type: String },
    device: { type: String },
  },
  { timestamps: true }
);

// Pre-save middleware to add client token before saving
ticketSchema.pre('save', function (next) {
  const ticket = this;

  if (!ticket.clientToken) {
    ticket.clientToken = `${Date.now()}${ticket._id}`;
  }

  next();
});

const Ticket = mongoose.model('Ticket', ticketSchema);
module.exports = Ticket;
