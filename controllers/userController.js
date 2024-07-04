const multer = require('multer');
const AppError = require('../utils/appError');
const User = require('./../models/userModel');
const Chat = require('../models/chatModel');
const catchAsync = require('./../utils/catchAsync');
const Team = require('../models/teamModel');
const AnswersSet = require('../models/answersSetModel');

const axios = require('axios');

const whatsappVersion = process.env.WHATSAPP_VERSION;
const whatsappToken = process.env.WHATSAPP_TOKEN;
const whatsappPhoneID = process.env.WHATSAPP_PHONE_ID;
const whatsappPhoneNumber = process.env.WHATSAPP_PHONE_NUMBER;
const whatsappAccountID = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
const productionLink = process.env.PRODUCTION_LINK;

const sendOtpTemplate = async (phone) => {
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
    to: phone,
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
        Authorization: `Bearer ${whatsappToken}`,
      },
      data: JSON.stringify(whatsappPayload),
    });
  } catch (err) {
    console.log(
      'err ----------------------------------------------------------> ',
      err
    );
  }

  return { sendTemplateResponse, otp };
};

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
    // cb(null, 'public/img');
    cb(null, 'public');
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
  const filteredBody = {
    bot: false,
    // deleted: false,
  };
  let select = '-passwordChangedAt -createdAt -updatedAt +deleted';
  let populate = { path: 'team', select: 'name' };

  // ------------> Active and Inactive users
  if (req.query.active === 'true') {
    filteredBody.deleted = false;
  } else if (req.query.active === 'false') {
    filteredBody.deleted = true;
  }

  // ------------> Role filters users
  if (req.query.role) {
    filteredBody.role = req.query.role;
  }

  // ------------> firstName & lastName filters users
  if (req.query.name) {
    filteredBody['$or'] = [
      { firstName: { $regex: req.query.name, $options: 'i' } },
      { lastName: { $regex: req.query.name, $options: 'i' } },
    ];
  }

  // ------------> Team filters users
  if (req.query.team) {
    filteredBody.team = req.query.team;
  }

  // Users for add or edit team
  // if (req.query.type === 'team') {
  //   if (req.query.teamID) {
  //     filteredBody['$or'] = [{ supervisor: false }, { team: req.query.teamID }];
  //   } else {
  //     filteredBody.supervisor = false;
  //   }
  //   select = 'firstName lastName photo team';
  //   populate = { path: 'team', select: 'name' };
  // }

  // users for chat transfer
  // if (req.query.type === 'chatTransfer') {
  //   filteredBody['$and'] = [
  //     { _id: { $ne: req.user._id } },
  //     { team: req.user.team },
  //   ];
  //   select = 'firstName lastName photo';
  //   populate = '';
  // }

  console.log('filteredBody', filteredBody);

  const page = req.query.page || 1;

  const users = await User.find(filteredBody)
    .select(select)
    .populate(populate)
    .skip((page - 1) * 20)
    .limit(20);

  const totalUsers = await User.count({ bot: false });
  const activeUsers = await User.count({ bot: false, deleted: false });
  const inactiveUsers = await User.count({ bot: false, deleted: true });

  const totalResults = await User.count(filteredBody);
  const totalPages = Math.ceil(totalResults / 20);

  res.status(200).json({
    status: 'success',
    results: users.length,
    data: {
      activeUsers,
      inactiveUsers,
      totalUsers,
      totalResults,
      totalPages,
      page,
      users,
    },
  });
});

exports.getUser = catchAsync(async (req, res, next) => {
  const user = await User.findOne({
    _id: req.params.userID,
    deleted: false,
  })
    .select('-passwordChangedAt')
    .populate('team', 'name');

  if (!user) {
    return next(new AppError('There is no user with that ID!', 404));
  }

  if (user.bot === true) {
    return next(new AppError('Bot User!', 400));
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
    phone: req.body.phone,
    creator: req.user._id,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm,
    role: req.body.role,
  };

  // Checking if there is a valid team with that teamID
  const team = await Team.findById(req.body.team);
  if (team) {
    newUserData.team = req.body.team;
  }

  // Checking the same email for deleted user
  if (await User.findOne({ email: req.body.email, deleted: true })) {
    return next(
      new AppError('This email belongs to a suspended account!', 400)
    );
  }

  // *********************************************************************************************************
  // Checking the whatsapp phone by sending template
  if (!req.body.phone) {
    return next(new AppError('Whatsapp number is required!', 400));
  }

  const { sendTemplateResponse, otp } = await sendOtpTemplate(req.body.phone);

  if (sendTemplateResponse) {
    let otpTimer = new Date();
    otpTimer.setMinutes(otpTimer.getMinutes() + 1);

    newUserData.otp = otp;
    newUserData.otpTimer = otpTimer;
  } else {
    return next(
      new AppError(
        'Invalid whatsapp number! Try again with form like 966500000000.',
        400
      )
    );
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
    name: `Private-${newUser._id}`,
    creator: newUser._id,
    answers: [],
    type: 'private',
  });

  await User.findByIdAndUpdate(
    newUser._id,
    { answersSet: newAnswersSet._id },
    { new: true, runValidators: true }
  );

  // Remove password from output
  newUser.password = undefined;

  res.status(201).json({
    status: 'success',
    data: {
      user: newUser,
      newAnswersSet,
    },
  });
});

exports.updateUser = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.params.userID).populate('team', 'name');
  if (!user) {
    return next(new AppError('No user found with that ID!', 404));
  }

  if (user.bot === true) {
    return next(new AppError("Couldn't update bot user!", 400));
  }

  if (user.deleted === true) {
    return next(new AppError("Couldn't update deleted user!", 400));
  }

  // 1) Create error if user post password data
  // if (req.body.password || req.body.passwordConfirm) {
  //   return next(new AppError('This route is not for password updates!', 400));
  // }

  // 2) Filtered out unwanted fields names that are not allowed to be updated
  const filteredBody = filterObj(
    req.body,
    'firstName',
    'lastName',
    'email',
    'phone',
    'role',
    'status'
    // 'team'
  );

  // Checking for password
  if (req.body.password && req.body.password !== req.body.passwordConfirm) {
    return next(
      new AppError('Password and password confirm must be the same', 400)
    );
  }

  // Checking if the whatsapp number is valid
  if (req.body.phone && req.body.phone !== user.phone) {
    const { sendTemplateResponse, otp } = await sendOtpTemplate(req.body.phone);

    if (!sendTemplateResponse) {
      return next(
        new AppError(
          'Invalid whatsapp number! Try again with form like 966500000000.',
          400
        )
      );
    }
  }

  if (req.body.password) {
    user.password = req.body.password;
    user.passwordConfirm = req.body.passwordConfirm;
    user.token = undefined;
    await user.save();
  }

  const team = await Team.findById(req.body.team);

  // Checking if there is new team provided and the user is already a supervisor
  if (
    req.body.team &&
    req.body.team !== user.team &&
    user.supervisor === true
  ) {
    return next(
      new AppError(
        `Couldn\'t update team supervisor, Kindly update (${user.team.name}) team first!`,
        400
      )
    );
  }

  // Checking if the provided team is existed
  if (req.body.team && !team) {
    return next(new AppError('No team found with that ID!', 404));
  }

  // Remove token from database if email updated
  if (req.body.email && req.body.email !== user.email) {
    filteredBody.token = undefined;
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
  let filteredBody = filterObj(
    req.body,
    'firstName',
    'lastName',
    'email',
    'phone'
  );

  // To update only user status
  if (req.body.status) {
    filteredBody = { status: req.body.status };
  }

  // 3) Check if photo updated
  if (req.file) {
    filteredBody.photo = req.file.filename;
  }

  // Checking if the whatsapp number is valid
  if (
    filteredBody.phone &&
    req.body.phone &&
    req.body.phone !== req.user.phone
  ) {
    const { sendTemplateResponse, otp } = await sendOtpTemplate(req.body.phone);

    if (!sendTemplateResponse) {
      return next(
        new AppError(
          'Invalid whatsapp number! Try again with form like 966500000000.',
          400
        )
      );
    }
  }

  // 4) Update user document
  const updatedUser = await User.findByIdAndUpdate(req.user._id, filteredBody, {
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
  const user = await User.findById(req.params.userID);
  if (!user) {
    return next(new AppError('No user found with that ID', 404));
  }

  if (user.deleted === true) {
    return next(new AppError('User is already deleted!', 400));
  }

  if (user.bot === true) {
    return next(new AppError("Couldn't delete bot user!", 404));
  }

  if (user.team && user.supervisor === true) {
    return next(
      new AppError(
        `Couldn't delete team supervisor, Kindly update team with that id (${user.team}) first.`,
        400
      )
    );
  }

  const userChats = await Chat.find({ currentUser: user._id });
  if (userChats.length > 0) {
    return next(
      new AppError(
        "Couldn't delete user with active chats! Kindly archive his chats first.",
        400
      )
    );
  }

  // Updating team doc by removing userID from array of users
  await Team.findByIdAndUpdate(user.team, {
    $pull: { users: user._id },
  });

  // Deleting user doc by adding {delete : true}
  await User.findByIdAndUpdate(
    user._id,
    {
      deleted: true,
      $unset: { token: null, team: null, otp: null, otpTimer: null },
    },
    { new: true, runValidators: true }
  );

  res.status(200).json({
    status: 'success',
    message: 'User deleted successfully!',
  });
});

exports.recoverUser = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.params.userID);
  if (!user) {
    return next(new AppError('No user found with that ID!', 400));
  }

  if (user.deleted === false) {
    return next(new AppError('User is already recovered!', 400));
  }

  await User.findByIdAndUpdate(
    req.params.userID,
    { deleted: false },
    { new: true, runValidators: true }
  );

  res.status(200).json({
    status: 'success',
    message: 'User recovered successfully!',
  });
});
