const multer = require('multer');
const AppError = require('../utils/appError');
const User = require('./../models/userModel');
const catchAsync = require('./../utils/catchAsync');
const Team = require('../models/teamModel');
const AnswersSet = require('../models/answersSetModel');

const filterObj = (obj, ...allowedFields) => {
  const newObj = {};
  Object.keys(obj).forEach((el) => {
    if (allowedFields.includes(el)) newObj[el] = obj[el];
  });
  return newObj;
};

const multerStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    // console.log('file==============', file);
    cb(null, 'public/img');
  },
  filename: (req, file, cb) => {
    const ext = file.mimetype.split('/')[1];

    cb(null, `user-${req.user.id}-${Date.now()}.${ext}`);
  },
});

const multerFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image')) {
    cb(null, true);
  } else {
    cb(new AppError('Not an image! Please upload only images.', 400), false);
  }
};

const upload = multer({
  storage: multerStorage,
  fileFilter: multerFilter,
});

exports.uploadUserPhoto = upload.single('photo');

exports.getAllUsers = catchAsync(async (req, res, next) => {
  let users;

  // for team users
  if (req.body.type && req.body.type === 'team') {
    users = await User.find({
      $or: [{ supervisor: { $ne: true } }, { team: req.body.teamID }],
    })
      .select('firstName lastName photo team')
      .populate('team', 'name');
  } else {
    // for normal users
    users = await User.find({ deleted: false })
      .select('-passwordChangedAt -createdAt -updatedAt')
      .populate('team', 'name');
  }

  res.status(200).json({
    status: 'success',
    results: users.length,
    data: {
      users,
    },
  });
});

exports.getUser = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.params.userID)
    .select('-passwordChangedAt')
    .populate('team', 'name');

  if (!user) {
    return next(new AppError('There is no user with that ID!', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      user,
    },
  });
});

exports.createUser = catchAsync(async (req, res, next) => {
  const newUserData = {
    firstName: req.body.firstName,
    lastName: req.body.lastName,
    email: req.body.email,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm,
    role: req.body.role,
  };

  // Checking if there is a valid team with that teamID
  const team = await Team.findById(req.body.team);
  if (team) {
    newUserData.team = req.body.team;
  }

  // Creating the new user
  const newUser = await User.create(newUserData);

  // Adding the user to the team
  if (team) {
    team.users = [...team.users, newUser._id];
    await team.save();
  }

  // Create private answers set for the user
  const newAnswersSet = await AnswersSet.create({
    creator: newUser._id,
    answers: [],
    type: 'private',
  });

  // Remove password from output
  newUser.password = undefined;

  res.status(201).json({
    status: 'success',
    data: {
      user: newUser,
    },
  });
});

exports.updateUser = catchAsync(async (req, res, next) => {
  /////////////////////////////////////////////////
  // For me
  if (req.params.userID === '64b01ddcb71752fc73c85619') {
    return next(new AppError('خليك ف حالك ي معلم!', 400));
  }

  const user = await User.findById(req.params.userID);
  if (!user) {
    return next(new AppError('No user found with that ID!', 404));
  }

  // 1) Create error if user post password data
  if (req.body.password || req.body.passwordConfirm) {
    return next(new AppError('This route is not for password updates!', 400));
  }

  // 2) Filtered out unwanted fields names that are not allowed to be updated
  const filteredBody = filterObj(
    req.body,
    'firstName',
    'lastName',
    'email',
    'role',
    'team'
  );

  const team = await Team.findById(req.body.team);

  // Checking if there is new team provided and the user is already a supervisor
  if (
    req.body.team &&
    req.body.team !== user.team &&
    user.supervisor === true
  ) {
    return next(
      new AppError(
        `Couldn\'t update team supervisor, Kindly update team with ID (${user.team}) first!`,
        400
      )
    );
  }

  // Checking if the provided team is existed
  if (req.body.team && !team) {
    return next(new AppError('No team found with that ID!', 404));
  }

  // 3) Update user document
  const updatedUser = await User.findByIdAndUpdate(
    req.params.userID,
    filteredBody,
    {
      new: true,
      runValidators: true,
    }
  ).select('-passwordChangedAt');

  if (!updatedUser) {
    return next(new AppError('No user found with that ID', 404));
  }

  // 4) Updating team users
  if (req.body.team && req.body.team !== user.team) {
    // Removing user from the array of users of the previous team
    await Team.findByIdAndUpdate(user.team, {
      $pull: { users: user._id },
    });

    // Adding user to the array of users of the new team
    await Team.findByIdAndUpdate(req.body.team, {
      $push: { users: user._id },
    });
  }

  res.status(200).json({
    status: 'success',
    data: {
      user: updatedUser,
    },
  });
});

exports.updateMe = catchAsync(async (req, res, next) => {
  // For me
  if (req.user.id === '64b01ddcb71752fc73c85619') {
    return next(new AppError('خليك ف حالك ي معلم!', 400));
  }

  // 1) Create error if user post password data
  if (req.body.password || req.body.passwordConfirm) {
    return next(
      new AppError(
        'This route is not for password updates. Kindly use /updateMyPassword.',
        400
      )
    );
  }

  // 2) Filtered out unwanted fields names that are not allowed to be updated
  const filteredBody = filterObj(req.body, 'firstName', 'lastName', 'email');

  // 3) Check if photo updated
  if (req.file) {
    filteredBody.photo = req.file.filename;
  }

  // 4) Update user document
  const updatedUser = await User.findByIdAndUpdate(req.user.id, filteredBody, {
    new: true,
    runValidators: true,
  }).select('-passwordChangedAt');

  res.status(200).json({
    status: 'success',
    data: {
      user: updatedUser,
    },
  });
});

exports.deleteUser = catchAsync(async (req, res, next) => {
  // For me
  if (req.params.userID === '64b01ddcb71752fc73c85619') {
    return next(new AppError('خليك ف حالك ي معلم!', 400));
  }

  const user = await User.findById(req.params.userID);
  if (!user) {
    return next(new AppError('No user found with that ID', 404));
  }

  if (user.team && user.supervisor === true) {
    return next(
      new AppError(
        `Couldn't delete team supervisor, Kindly update team with that id (${user.team}) first`,
        400
      )
    );
  }

  // Updating team doc by removing userID from array of users
  await Team.findByIdAndUpdate(user.team, {
    $pull: { users: user._id },
  });

  // Deleting user doc
  await user.deleteOne();

  res.status(200).json({
    status: 'success',
    message: 'User deleted successfully!!',
  });
});
