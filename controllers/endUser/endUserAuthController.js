const jwt = require('jsonwebtoken');

const { promisify } = require('util');

const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/appError');

const EndUser = require('../../models/endUserModel');

const createToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET);
};

exports.protectEndUserApp = catchAsync(async (req, res, next) => {
  // 1) Getting token and check if it is there
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(new AppError('You are not authenticated!', 401));
  }

  // 4) check if it is the same token in the config file
  if (process.env.END_USER_TOKEN !== token) {
    return next(new AppError('Invalid token!', 401));
  }

  next();
});

exports.protectEndUser = catchAsync(async (req, res, next) => {
  // 1) Getting token and check if it is there
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(new AppError('You are not authenticated!', 401));
  }

  // 2) Verification token
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
  // console.log('decoded', decoded);

  // 3) Check if user still exists
  const currentEndUser = await EndUser.findById(decoded.id).select('+token');
  if (!currentEndUser) {
    return next(
      new AppError(
        'The End user belonging to this token does no longer exist!',
        401
      )
    );
  }

  // 4) check if it is the same token in db as it is the last login
  if (currentEndUser.token && currentEndUser.token !== token) {
    return next(new AppError('Invalid token!', 401));
  }

  // Remove token from the user to send it in the req
  currentEndUser.token = undefined;

  // GRANT ACCESS TO PROTECTED ROUTE
  req.endUser = currentEndUser;
  next();
});

exports.getOrCreateEndUserToken = catchAsync(async (req, res, next) => {
  if (!req.body.nationalID || !req.body.name || !req.body.phone) {
    return next(new AppError('End user data is required!', 400));
  }

  let endUser = await EndUser.findOne({ nationalID: req.body.nationalID });

  if (!endUser) {
    endUser = await EndUser.create({
      nationalID: req.body.nationalID,
      phone: req.body.phone,
      name: req.body.name,
    });
  }

  const token = createToken(endUser._id);

  await EndUser.findByIdAndUpdate(
    endUser._id,
    { token },
    { new: true, runValidators: true }
  );

  res.status(200).json({
    status: 'success',
    token,
    data: {
      user: endUser,
    },
  });
});
