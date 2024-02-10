const Session = require('../models/sessionModel');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');

exports.getAllSessions = catchAsync(async (req, res, next) => {
  const userSessions = await Session.find({
    user: req.user._id,
    // status: { $ne: 'finished' },
    end: { $exists: false },
  });
  const userSessionsfilters = {
    all: userSessions.length,
    onTime: userSessions.filter((session) => session.status === 'onTime')
      .length,
    danger: userSessions.filter((session) => session.status === 'danger')
      .length,
    tooLate: userSessions.filter((session) => session.status === 'tooLate')
      .length,
    open: userSessions.filter((session) => session.status === 'open').length,
  };

  const teamsIDs = req.params.teamsIDs?.split(',');
  if (teamsIDs.length === 0) {
    return next(new AppError('Teams IDs are required!', 400));
  }

  if (
    (teamsIDs.length > 1 ||
      (teamsIDs.length === 1 && !req.user.team.equals(teamsIDs[0]))) &&
    req.user.role !== 'admin'
  ) {
    return next(
      new AppError("You don't have permission to perform this action!", 403)
    );
  }
  // console.log('teamsIDs', teamsIDs);

  const teamSessions = await Session.find({
    team: { $in: teamsIDs },
    // team: req.user.team,
    // status: { $ne: 'finished' },
    end: { $exists: false },
  });
  const teamSessionsfilters = {
    all: teamSessions.length,
    onTime: teamSessions.filter((session) => session.status === 'onTime')
      .length,
    danger: teamSessions.filter((session) => session.status === 'danger')
      .length,
    tooLate: teamSessions.filter((session) => session.status === 'tooLate')
      .length,
    open: teamSessions.filter((session) => session.status === 'open').length,
  };

  res.status(200).json({
    status: 'success',
    data: {
      usersSessions: userSessionsfilters,
      teamSessions: teamSessionsfilters,
      // userSessions,
    },
  });
});

exports.getAllPerformance = catchAsync(async (req, res, next) => {
  const sessions = await Session.find({
    type: 'normal',
    'performance.all': { $gt: 0 },
  });

  const performance = sessions.map((session) => ({
    all: session.performance.all,
    onTime: session.performance.onTime,
    tooLate: session.performance.all - session.performance.onTime,
  }));
  res.status(200).json({
    status: 'success',
    results: sessions.length,
    data: {
      performance,
    },
  });
});
