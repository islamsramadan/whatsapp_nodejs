const jwt = require('jsonwebtoken');
const { promisify } = require('util');

const User = require('./../models/userModel');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');

const sendToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

const createSendToken = (user, statusCode, res) => {
  const token = sendToken(user._id);

  // Remove password ,role and deleted from output
  user.password = undefined;
  // user.role = undefined;
  user.deleted = undefined;
  user.passwordChangedAt = undefined;

  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user,
    },
  });
};

exports.signup = catchAsync(async (req, res, next) => {
  const validateUser = await User.findOne({ email: req.body.email });
  if (validateUser) {
    return next(new AppError('This email belongs to another user!', 400));
  }

  const newUser = await User.create({
    firstName: req.body.firstName,
    lastName: req.body.lastName,
    email: req.body.email,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm,
    role: req.body.role,
  });

  createSendToken(newUser, 201, res);
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  // 1) check if email and password are exist
  if (!email || !password) {
    return next(new AppError('Email and password are required!', 400));
  }

  // 2) check if user exists && password is correct
  const user = await User.findOne({ email }).select('+password +deleted');

  // 3) check if everything Ok ,send token to client
  if (
    !user ||
    user.deleted ||
    !(await user.correctPassword(password, user.password))
  ) {
    return next(new AppError('Incorrect Email or Password!', 400));
  }

  createSendToken(user, 200, res);
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
        'You are not authenticated! Please log in to get access!',
        401
      )
    );
  }

  // 2) Verification token
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
  // console.log('decoded', decoded);

  // 3) Check if user still exists
  const currentUser = await User.findById(decoded.id);
  if (!currentUser) {
    return next(
      new AppError(
        'The user belonging to this token does no longer exist!',
        401
      )
    );
  }

  // 4) Check if user changed password after token had been issued
  if (currentUser.changedPasswordAfter(decoded.iat)) {
    return next(
      new AppError(
        'User recently changed password! Kindly login again to get access.',
        401
      )
    );
  }

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

exports.updatePassword = catchAsync(async (req, res, next) => {
  // For me
  // if (req.user.id === '64b01ddcb71752fc73c85619') {
  //   return next(new AppError('خليك ف حالك ي معلم!', 400));
  // }

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

  // 2) Check if current password is correct
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

  // 3) If it is ok, update password
  currentUser.password = newPassword;
  currentUser.passwordConfirm = passwordConfirm;
  await currentUser.save();

  // Disconnect the user from socket after changing password
  req.app.connectedUsers[req.user._id].disconnect(true);

  // 4) Log user in and send jwt token
  createSendToken(currentUser, 200, res);
});
