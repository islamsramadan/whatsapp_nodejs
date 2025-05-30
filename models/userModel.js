const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: [true, 'First name is required!'],
    },

    lastName: {
      type: String,
      required: [true, 'Last name is required!'],
    },

    email: {
      type: String,
      required: [true, 'Email is required!'],
      unique: [true, 'This email address already exist!'],
      validate: [validator.isEmail, 'Invalid email!'],
    },

    photo: {
      type: String,
      // default: 'default.jpg',
    },

    status: {
      type: String,
      enum: ['Online', 'Offline', 'Service hours', 'Away'],
      default: 'Service hours',
    },

    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },

    tasks: {
      type: [
        {
          type: String,
          enum: ['messages', 'tickets'],
        },
      ],
      default: ['messages', 'tickets'],
    },

    ticketRequests: [
      {
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
      },
    ],

    team: {
      type: mongoose.Schema.ObjectId,
      ref: 'Team',
    },

    supervisor: {
      type: Boolean,
      default: false,
    },

    chats: [
      {
        type: mongoose.Schema.ObjectId,
        ref: 'Chat',
      },
    ],

    tickets: [
      {
        type: mongoose.Schema.ObjectId,
        ref: 'Ticket',
      },
    ],

    answersSet: {
      type: mongoose.Schema.ObjectId,
      ref: 'AnswersSet',
    },

    password: {
      type: String,
      required: [true, 'Password is required!'],
      minLength: [
        8,
        'Kindly make sure your password is atleast 8 characters long',
      ],
      maxLength: [
        128,
        'Kindly make sure your password is less than 128 characters long',
      ],
      select: false,
    },

    passwordConfirm: {
      type: String,
      required: [true, 'Confirm your password!'],
      validate: {
        // This only works on CREATE and SAVE!!!
        validator: function (el) {
          return el === this.password;
        },
        message: 'Passwords are not the same!',
      },
    },

    token: {
      type: String,
      select: false,
    },

    creator: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
    },

    phone: {
      type: String,
      required: [true, 'Whatsapp number is required!'],
      match: [/\d{10,}/, 'Invalid whatsapp number!'],
    },

    otp: {
      type: String,
      select: false,
    },

    otpTimer: {
      type: Date,
      select: false,
    },

    passwordChangedAt: {
      type: Date,
    },

    bot: {
      type: Boolean,
      default: false,
    },

    deleted: {
      type: Boolean,
      default: false,
      select: false,
    },

    superAdmin: {
      type: Boolean,
      default: false,
    },

    secret: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

userSchema.index({ firstName: 1, lastName: 1 }, { unique: true });

// Hashing password
userSchema.pre('save', async function (next) {
  // Only run this function if password was actually modified
  if (!this.isModified('password')) return next();

  // Hash the password with cost of 12
  this.password = await bcrypt.hash(this.password, 12);

  // Delete passwordConfirm field
  this.passwordConfirm = undefined;
  next();
});

// Assign password changed at
userSchema.pre('save', function (next) {
  if (!this.isModified('password') || this.isNew) {
    return next();
  }

  // make it earlier one second to give time to record the document in DB
  this.passwordChangedAt = Date.now() - 1000;

  next();
});

userSchema.methods.correctPassword = async function (
  candidatePassword,
  userPassword
) {
  const correct = bcrypt.compare(candidatePassword, userPassword);
  return correct;
};

userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000);
    return JWTTimestamp < changedTimestamp;
  }

  // False means NOT changed
  return false;
};

const User = mongoose.model('User', userSchema);

module.exports = User;
