const json2xls = require('json2xls');
const fs = require('fs');

const Log = require('../models/logModel');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');

const convertDate = (timestamp) => {
  const date = new Date(timestamp * 1);

  const hours =
    (date.getHours() + '').length > 1 ? date.getHours() : `0${date.getHours()}`;

  const minutes =
    (date.getMinutes() + '').length > 1
      ? date.getMinutes()
      : `0${date.getMinutes()}`;

  const seconds =
    (date.getSeconds() + '').length > 1
      ? date.getSeconds()
      : `0${date.getSeconds()}`;

  const dateString = date.toDateString();

  const dateFormat = `${hours}:${minutes}:${seconds}, ${dateString}`;

  return dateFormat;
};

exports.getAllStatusLogs = catchAsync(async (req, res, next) => {
  let logs = await Log.find({ type: 'user' }).populate(
    'user',
    'firstName lastName'
  );

  logs = logs.map((log) => {
    return {
      creator: `${log.user.firstName} ${log.user.lastName}`,
      time: convertDate(new Date(log.createdAt)),
      event: log.event,
    };
  });

  if (req.query.type === 'download') {
    // Convert JSON to Excel
    const xls = json2xls(logs);

    // Generate a unique filename
    const fileName = `user-logs_${Date.now()}.xlsx`;

    // Write the Excel file to disk
    fs.writeFileSync(fileName, xls, 'binary');

    // Send the Excel file as a response
    res.download(fileName, () => {
      // Remove the file after sending
      fs.unlinkSync(fileName);
    });
  } else {
    res.status(200).json({
      status: 'success',
      results: logs.length,
      data: {
        logs,
      },
    });
  }
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
