const jwt = require('jsonwebtoken');
const { promisify } = require('util');

const User = require('./../models/userModel');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const axios = require('axios');
const { scheduleDocumentUpdateTask } = require('../utils/chatBotTimerUpdate');

const whatsappVersion = process.env.WHATSAPP_VERSION;
const whatsappToken = process.env.WHATSAPP_TOKEN;
const whatsappPhoneID = process.env.WHATSAPP_PHONE_ID;
const whatsappPhoneNumber = process.env.WHATSAPP_PHONE_NUMBER;
const whatsappAccountID = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
const productionLink = process.env.PRODUCTION_LINK;

const sendToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

const createSendToken = async (user, statusCode, req, res) => {
  const token = sendToken(user._id);

  await User.findByIdAndUpdate(
    user._id,
    { token },
    { new: true, runValidators: true }
  );

  // Remove password,otp, otp timer ,role and deleted from output
  user.password = undefined;
  user.otp = undefined;
  user.otpTimer = undefined;
  // user.role = undefined;
  user.deleted = undefined;
  user.passwordChangedAt = undefined;

  // // Disconnect the user from socket after creating new token
  // if (req.app.connectedUsers[user._id]) {
  //   req.app.connectedUsers[user._id].disconnect(true);
  // }

  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user,
    },
  });
};

const createSendOTP = async (user, res) => {
  if (!user.phone) {
    return next(new AppError('No whatsapp number found!', 400));
  }

  const otp = Math.floor(100000 + Math.random() * 900000);

  const templateName = 'login_otp';
  const response = await axios.request({
    method: 'get',
    url: `https://graph.facebook.com/${whatsappVersion}/${whatsappAccountID}/message_templates?name=${templateName}`,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${whatsappToken}`,
    },
  });
  const template = response.data.data[0];
  // console.log('template', template);

  const templateComponents = [
    { type: 'body', parameters: [{ type: 'text', text: otp }] },
    {
      type: 'button',
      sub_type: 'url',
      index: '0',
      parameters: [
        {
          type: 'text',
          text: otp,
        },
      ],
    },
  ];

  const whatsappPayload = {
    messaging_product: 'whatsapp',
    to: user.phone,
    type: 'template',
    template: {
      name: templateName,
      language: {
        code: template.language,
      },
      components: templateComponents,
    },
  };

  let sendTemplateResponse;
  try {
    sendTemplateResponse = await axios.request({
      method: 'post',
      maxBodyLength: Infinity,
      url: `https://graph.facebook.com/${whatsappVersion}/${whatsappPhoneID}/messages`,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
      },
      data: JSON.stringify(whatsappPayload),
    });
  } catch (err) {
    console.log(
      'err ----------------------------------------------------------> ',
      err
    );
  }

  if (sendTemplateResponse) {
    let otpTimer = new Date();
    otpTimer.setMinutes(otpTimer.getMinutes() + 2);

    await User.findByIdAndUpdate(
      user._id,
      { otp, otpTimer },
      { new: true, runValidators: true }
    );
    res
      .status(200)
      .json({ status: 'success', message: 'OTP sent successfully!' });
  } else {
    res.status(400).json({ status: 'fial', message: 'OTP error!' });
  }
};

exports.signup = catchAsync(async (req, res, next) => {
  // Checking the same email for existed user
  if (await User.findOne({ email: req.body.email, deleted: false })) {
    return next(new AppError('This email belongs to another user!', 400));
  }

  // Checking the same email for deleted user
  if (await User.findOne({ email: req.body.email, deleted: true })) {
    return next(
      new AppError('This email belongs to a suspended account!', 400)
    );
  }

  const newUser = await User.create({
    firstName: req.body.firstName,
    lastName: req.body.lastName,
    email: req.body.email,
    phone: req.body.phone,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm,
    role: req.body.role,
  });

  await createSendToken(newUser, 201, req, res);
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  // 1) check if email and password are exist
  if (!email || !password) {
    return next(new AppError('Email and password are required!', 400));
  }

  // 2) check if user exists && password is correct
  const user = await User.findOne({ email }).select('+password +deleted');

  // 3) check if everything Ok ,send otp to client
  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError('Incorrect Email or Password!', 400));
  }

  if (user.deleted === true) {
    return next(new AppError('Account has been deleted!', 400));
  }

  await createSendOTP(user, res);
});

exports.verifyOTP = catchAsync(async (req, res, next) => {
  const { email, password, otp } = req.body;

  if (!email || !password || !otp) {
    return next(new AppError('OTP is required!', 400));
  }

  const user = await User.findOne({ email }).select(
    '+password +deleted +otp +otpTimer'
  );

  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError('No Account found with that email', 401));
  }

  if (user.deleted === true) {
    return next(new AppError('Account has been deleted!', 401));
  }

  if (user.otp && user.otp === otp && user.otpTimer > Date.now()) {
    await createSendToken(user, 200, req, res);
  } else {
    return next(new AppError('Invalid OTP!', 400));
  }
});

exports.protect = catchAsync(async (req, res, next) => {
  // 1) Getting token and check if it is there
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(
      new AppError(
        'You are not authenticated! Kindly log in to get access.',
        401
      )
    );
  }

  // 2) Verification token
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
  // console.log('decoded', decoded);

  // 3) Check if user still exists
  const currentUser = await User.findById(decoded.id).select('+token');
  if (!currentUser) {
    return next(
      new AppError(
        'The user belonging to this token does no longer exist!',
        401
      )
    );
  }

  // 3) check if the account has been deleted
  if (currentUser.deleted === true) {
    return next(new AppError('Account has been deleted!', 401));
  }

  // 4) Check if user changed password after token had been issued
  if (currentUser.changedPasswordAfter(decoded.iat)) {
    return next(
      new AppError(
        'User recently changed password! Kindly log in again to get access.',
        401
      )
    );
  }

  // 5) check if it is the same token in db as it is the last login
  if (currentUser.token && currentUser.token !== token) {
    return next(new AppError('Invalid token!', 401));
  }

  // Remove token from the user to send it in the req
  currentUser.token = undefined;

  // GRANT ACCESS TO PROTECTED ROUTE
  req.user = currentUser;
  next();
});

exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    // roles = ['user', 'admin', ...]
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError("You don't have permission to perform this action!", 403)
      );
    }

    next();
  };
};

exports.restrictToTasks = (task) => {
  return (req, res, next) => {
    // tasks = ['messages', 'tickets', ...]
    if (!req.user.tasks.includes(task)) {
      return next(
        new AppError("You don't have permission to perform this action!", 403)
      );
    }

    next();
  };
};

exports.updatePassword = catchAsync(async (req, res, next) => {
  // 1) Getting user from collection
  const currentUser = await User.findById(req.user._id).select('+password');

  const { currentPassword, newPassword, passwordConfirm } = req.body;
  if (!currentPassword || !newPassword || !passwordConfirm) {
    return next(
      new AppError(
        'Current Password, New Password and Password Confirm are required!',
        400
      )
    );
  }

  if (currentPassword === newPassword) {
    return next(
      new AppError('New password must be different from current password!', 400)
    );
  }

  // 2) check if the account has been deleted
  if (currentUser.deleted === true) {
    return next(new AppError('Account has been deleted!', 400));
  }

  // 3) Check if current password is correct
  const correctPassword = await currentUser.correctPassword(
    req.body.currentPassword,
    currentUser.password
  );
  if (!correctPassword) {
    return next(
      new AppError(
        'Your current password is incorrect. Kindly provide the correct one!',
        400
      )
    );
  }

  // 4) If it is ok, update password
  currentUser.password = newPassword;
  currentUser.passwordConfirm = passwordConfirm;
  await currentUser.save();

  // 5) Log user in and send jwt token
  await createSendToken(currentUser, 200, req, res);
});
