const Session = require('../models/sessionModel');
const catchAsync = require('../utils/catchAsync');

exports.getAllSessions = catchAsync(async (req, res, next) => {
  const sessions = await Session.find();

  res.status(200).json({
    status: 'success',
    results: sessions.length,
    data: {
      sessions,
    },
  });
});
