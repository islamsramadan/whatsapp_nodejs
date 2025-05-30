const multer = require('multer');

const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const Team = require('../models/teamModel');
const User = require('../models/userModel');
const Conversation = require('../models/conversationModel');

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

    cb(null, `team-${req.user.id}-${Date.now()}.${ext}`);
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

exports.uploadTeamPhoto = upload.single('photo');

exports.getAllTeams = catchAsync(async (req, res, next) => {
  const filteredBody = { bot: false };
  if (req.query.type === 'chatTransfer') {
    filteredBody._id = { $ne: req.user.team };
  }

  if (req.query.name) {
    filteredBody.name = { $regex: req.query.name, $options: 'i' };
  }

  let teams = await Team.find(filteredBody)
    .sort('createdAt')
    .populate('supervisor', 'firstName lastName photo')
    .populate('users', 'firstName lastName photo')
    .populate('creator', 'firstName lastName photo')
    .populate('serviceHours', 'name')
    .populate('conversation', 'name')
    .populate('answersSets', 'name');

  const totalTeams = await Team.count({ bot: false });
  const defaultTeam = await Team.findOne({ default: true }).select('name');
  const userTeam = await Team.findById(req.user.team).select('name');

  res.status(200).json({
    status: 'success',
    results: teams.length,
    data: {
      totalTeams,
      defaultTeam,
      userTeam,
      teams,
    },
  });
});

exports.createTeam = catchAsync(async (req, res, next) => {
  const {
    name,
    supervisor,
    serviceHours,
    conversation,
    answersSets,
    ticketRequests,
  } = req.body;

  if (!name || !supervisor || !serviceHours || !conversation) {
    return next(
      new AppError(
        'Team name, supervisor, conversation and service hours are required!',
        404
      )
    );
  }

  // Adding supervisor to the users array
  let users = req.body.users || [];
  if (!users.includes(supervisor)) {
    users = [supervisor, ...users];
  }

  // Checking if any users or the supervisor is a supervisor in another team
  const teamWithTheSameSupervisor = await Team.find({
    supervisor: { $in: users },
  });

  if (teamWithTheSameSupervisor.length > 0) {
    return next(
      new AppError(
        "Team supervisor or any user couldn't be a supervisor of another team!",
        400
      )
    );
  }

  const newTeamData = {
    name,
    users,
    supervisor,
    serviceHours,
    conversation,
    answersSets,
    ticketRequests,
    creator: req.user._id,
  };

  const conversationDoc = await Conversation.findById(conversation);
  if (!conversationDoc) {
    return next(new AppError('No conversation found with that ID!', 404));
  }

  const newTeam = await Team.create(newTeamData);

  // Updating conversation by adding team to it
  await Conversation.findByIdAndUpdate(
    conversation,
    { $push: { teams: newTeam._id } },
    { new: true, runValidators: true }
  );

  // Updating users and teams
  for (let i = 0; i < users.length; i++) {
    let user = await User.findById(users[i]);
    let userTeam = await Team.findById(user?.team);
    // console.log('user', user, userTeam);

    if (user) {
      // user.team = newTeam._id;
      // await user.save();
      await User.findByIdAndUpdate(
        users[i],
        { team: newTeam._id },
        {
          new: true,
          runValidators: true,
        }
      );
    }
    if (userTeam) {
      await Team.findByIdAndUpdate(user.team, {
        $pull: { users: users[i] },
      });
    }
  }

  // Adding supervisor:true to the user supervisor
  await User.findByIdAndUpdate(supervisor, { supervisor: true });

  res.status(201).json({
    status: 'success',
    data: {
      team: newTeam,
    },
  });
});

exports.getTeam = catchAsync(async (req, res, next) => {
  const team = await Team.findById(req.params.id)
    .populate('supervisor', 'firstName lastName photo')
    .populate('users', 'firstName lastName photo')
    .populate('creator', 'firstName lastName photo')
    .populate({
      path: 'answersSets',
      populate: { path: 'answers', select: 'name body' },
    })
    .populate('serviceHours')
    .populate('conversation');

  if (!team) {
    return next(new AppError('No team found with that ID!', 404));
  }

  if (team.bot === true && req.user.bot === false) {
    return next(new AppError('Bot team!', 400));
  }

  res.status(200).json({
    status: 'success',
    data: {
      team,
    },
  });
});

exports.updateTeam = catchAsync(async (req, res, next) => {
  const team = await Team.findById(req.params.id);
  if (!team) {
    return next(new AppError('No team found with that ID!', 404));
  }

  if (team.bot === true) {
    return next(new AppError("Couldn't update bot team!", 400));
  }

  if (
    req.user.role !== 'admin' &&
    !(req.user.supervisor === true && req.user.team.equals(team._id))
  ) {
    return next(
      new AppError("You don't have permission to perform this action!", 403)
    );
  }

  let updatedTeam;

  // Update Team Photo
  if (req.body.type === 'update_photo') {
    if (!req.file) {
      return next(new AppError('Image not found!', 404));
    }

    updatedTeam = await Team.findByIdAndUpdate(
      req.params.id,
      { photo: req.file.filename },
      { new: true, runValidators: true }
    );
  } else {
    // Updating team by the provided in the body
    if (!req.body.supervisor || !(await User.findById(req.body.supervisor))) {
      return next(new AppError('Team supervisor is required!', 400));
    }

    if (team.default === true && req.body.default === false) {
      return next(
        new AppError(
          "Couldn't remove default from the team, Select another team to be default!",
          400
        )
      );
    }

    // Checking if the new conversation already exist
    if (
      req.body.conversation &&
      !team.conversation.equals(req.body.conversation) &&
      !(await Conversation.findById(req.body.conversation))
    ) {
      return next(new AppError('No conversation found with that ID', 404));
    }

    // Adding supervisor to the users array
    let users = req.body.users || team.users;
    if (!users.includes(req.body.supervisor)) {
      users = [req.body.supervisor, ...users];
    }

    req.body.users = users;

    const filteredBody = filterObj(
      req.body,
      'name',
      'supervisor',
      'users',
      'serviceHours',
      'answersSets',
      'conversation',
      'ticketRequests',
      'default'
    );

    // Checking if any users or the supervisor is a supervisor in another team
    const teamWithTheSameSupervisor = await Team.find({
      $and: [{ supervisor: { $in: users } }, { _id: { $ne: req.params.id } }],
    });

    if (teamWithTheSameSupervisor.length > 0) {
      return next(
        new AppError(
          "Team supervisor or any user couldn't be a supervisor of another team!",
          400
        )
      );
    }

    // Removing team from the removed users only
    for (let i = 0; i < team.users.length; i++) {
      if (!users.includes(team.users[i])) {
        await User.findByIdAndUpdate(
          team.users[i],
          {
            $unset: { team: 1 },
            supervisor: false,
          },
          { new: true, runValidators: true }
        );
      }
    }

    //selecting the previous default team
    let defaultTeam;
    if (req.body.default === true) {
      defaultTeam = await Team.findOne({ default: true });
    }

    //selecting the previous supervisor
    let prevSupervisor;
    if (req.body.supervisor && !team.supervisor.equals(req.body.supervisor)) {
      prevSupervisor = team.supervisor;
    }

    updatedTeam = await Team.findByIdAndUpdate(req.params.id, filteredBody, {
      new: true,
      runValidators: true,
    });

    if (!updatedTeam) {
      return next(new AppError('No team found with that ID!', 404));
    }

    //Updating conversations if there is an update
    if (
      req.body.conversation &&
      !team.conversation.equals(req.body.conversation)
    ) {
      //removing
      await Conversation.findByIdAndUpdate(
        team.conversation,
        { $pull: { teams: req.params.id } },
        { new: true, runValidators: true }
      );

      //adding
      await Conversation.findByIdAndUpdate(
        req.body.conversation,
        { $push: { teams: req.params.id } },
        { new: true, runValidators: true }
      );
    }

    //update previous default team to not default
    if (defaultTeam && !defaultTeam._id.equals(team._id)) {
      defaultTeam.default = false;
      await defaultTeam.save();
    }

    // Adding user.team to all new users
    for (let i = 0; i < users.length; i++) {
      await User.findByIdAndUpdate(
        users[i],
        { team: req.params.id },
        { new: true, runValidators: true }
      );
    }

    // Adding supervisor:false to the previous supervisor user
    if (prevSupervisor) {
      await User.findByIdAndUpdate(
        prevSupervisor,
        { supervisor: false },
        { new: true, runValidators: true }
      );
    }

    // Adding supervisor:true to the supervisor user
    await User.findByIdAndUpdate(
      updatedTeam.supervisor,
      { supervisor: true },
      { new: true, runValidators: true }
    );
  }

  if (!updatedTeam) {
    return next(
      new AppError(
        'No team updated, Kindly check for the provided varaiables!',
        400
      )
    );
  }

  const populatedTeam = await Team.findById(updatedTeam._id)
    .populate('supervisor', 'firstName lastName photo')
    .populate('users', 'firstName lastName photo')
    .populate('creator', 'firstName lastName photo');

  res.status(200).json({
    status: 'success',
    data: {
      team: populatedTeam,
    },
  });
});

exports.deleteTeam = catchAsync(async (req, res, next) => {
  // const team = await Team.findByIdAndDelete(req.params.id);
  const team = await Team.findById(req.params.id);

  if (!team) {
    return next(new AppError('No team found with that ID!', 404));
  }

  if (team.default === true) {
    return next(new AppError("Couldn't delete default team!", 400));
  }

  if (team.bot === true) {
    return next(new AppError("Couldn't delete bot team!", 400));
  }

  const users = team.users;
  const supervisorUser = team.supervisor;

  //deleting team
  await Team.findByIdAndDelete(req.params.id);

  //removing user.team
  for (let i = 0; i < users.length; i++) {
    await User.findByIdAndUpdate(users[i], { $unset: { team: 1 } });
  }

  //make supervisor:false for the supervisor user
  await User.findByIdAndUpdate(supervisorUser, {
    supervisor: false,
    $unset: { team: 1 },
  });

  // Updating conversation doc
  await Conversation.findByIdAndUpdate(
    team.conversation,
    { $pull: { teams: req.params.id } },
    { new: true, runValidators: true }
  );

  res.status(200).json({
    status: 'success',
    message: 'Team deleted successfully!',
  });
});
