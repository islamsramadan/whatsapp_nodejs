const multer = require('multer');

const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const Team = require('../models/teamModel');
const User = require('../models/userModel');

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
  const teams = await Team.find()
    .sort('createdAt')
    .populate('supervisor', 'firstName lastName photo')
    .populate('users', 'firstName lastName photo')
    .populate('creator', 'firstName lastName photo')
    .populate('answersSets', 'name');

  res.status(200).json({
    status: 'success',
    results: teams.length,
    data: {
      teams,
    },
  });
});

exports.createTeam = catchAsync(async (req, res, next) => {
  const { name, supervisor, serviceHours, answersSets } = req.body;

  if (!name || !supervisor || !serviceHours) {
    return next(
      new AppError('Team name, supervisor and service hours are required!', 404)
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
    answersSets,
    creator: req.user._id,
  };

  const newTeam = await Team.create(newTeamData);

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
    .populate('answersSets');

  if (!team) {
    return next(new AppError('No team found with that ID!'));
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
  }

  // Updating team to default team
  else if (req.body.default === true) {
    const team = await Team.findById(req.params.id);
    if (!team) {
      return next(new AppError('No team found with that ID!', 404));
    }

    //remove default from the other default team
    await Team.findOneAndUpdate(
      { default: true },
      { default: false },
      { new: true, runValidators: true }
    );

    //update the new default team
    team.default = true;
    updatedTeam = await team.save();
  } else {
    // Updating team by the provided in the body
    if (!req.body.supervisor || !(await User.findById(req.body.supervisor))) {
      return next(new AppError('Team supervisor is required!', 400));
    }

    const filteredBody = filterObj(
      req.body,
      'name',
      'supervisor',
      'users',
      'serviceHours',
      'answersSets'
    );

    // Adding supervisor to the users array
    let users = req.body.users || [];
    if (!users.includes(req.body.supervisor)) {
      users = [req.body.supervisor, ...users];
    }

    // Checking if any users or the supervisor is a supervisor in another team
    const teamWithTheSameSupervisor = await Team.find({
      supervisor: { $in: users },
      _id: { $ne: req.params.id },
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

    updatedTeam = await Team.findByIdAndUpdate(req.params.id, filteredBody, {
      new: true,
      runValidators: true,
    });

    if (!updatedTeam) {
      return next(new AppError('No team found with that ID!', 404));
    }

    // Adding user.team to all new users
    for (let i = 0; i < users.length; i++) {
      await User.findByIdAndUpdate(
        users[i],
        { team: req.params.id },
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

  res.status(200).json({
    status: 'success',
    message: 'Team deleted successfully!',
  });
});
