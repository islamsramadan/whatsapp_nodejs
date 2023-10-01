const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const Team = require('../models/teamModel');

exports.getAllTeams = catchAsync(async (req, res, next) => {
  const teams = await Team.find()
    .sort('-createdAt')
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
  if (!req.body.users || req.body.users.length === 0) {
    return next(new AppError('Team users are required!', 400));
  }

  const newTeam = await Team.create({ ...req.body, creator: req.user._id });

  const populatedTeam = await Team.findById(newTeam._id)
    .populate('supervisor', 'firstName lastName photo')
    .populate('users', 'firstName lastName photo')
    .populate('creator', 'firstName lastName photo');

  res.status(201).json({
    status: 'success',
    data: {
      team: populatedTeam,
    },
  });
});

exports.getTeam = catchAsync(async (req, res, next) => {
  const team = await Team.findById(req.params.id)
    .populate('supervisor', 'firstName lastName photo')
    .populate('users', 'firstName lastName photo')
    .populate('creator', 'firstName lastName photo');

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
  if (req.body.users && req.body.users.length === 0) {
    return next(new AppError('Team users are required!', 400));
  }

  const updatedTeam = await Team.findByIdAndUpdate(req.params.id, req.body, {
    runValidators: true,
  });

  if (!updatedTeam) {
    return next(new AppError('No team found with that ID!'));
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
  const team = await Team.findByIdAndDelete(req.params.id);

  if (!team) {
    return next(new AppError('No team found with that ID!'));
  }

  res.status(200).json({
    status: 'success',
    message: 'Team deleted successfully!',
  });
});
