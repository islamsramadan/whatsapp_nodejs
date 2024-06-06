const Log = require('../models/logModel');
const catchAsync = require('../utils/catchAsync');

exports.getAllLogs = catchAsync(async (req, res, next) => {
  const logs = await Log.find().populate('user', 'firstName lasrName');

  res.status(200).json({
    status: 'success',
    results: logs.length,
    data: {
      logs,
    },
  });
});

exports.getAllChatLogs = catchAsync(async (req, res, next) => {
  const logs = await Log.find({ chat: req.params.chatID }).populate(
    'user',
    'firstName lastName'
  );

  res.status(200).json({
    status: 'success',
    results: logs.length,
    data: {
      logs,
    },
  });
});
