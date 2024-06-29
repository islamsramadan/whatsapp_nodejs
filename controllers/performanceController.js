const json2xls = require('json2xls');
const fs = require('fs');

const Session = require('../models/sessionModel');
const User = require('../models/userModel');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');

const getMonthName = (date) => {
  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  return months[date.getMonth()];
};

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
  let usersIDs = req.query.selectedUsers?.split(',');
  let teamsIDs = req.query.selectedTeams?.split(',');

  if (!req.query.selectedUsers) {
    if (req.query.selectedTeams) {
      usersIDs = await User.find({ team: { $in: teamsIDs } });
    } else {
      usersIDs = await User.find({ bot: false });
    }
  }

  // console.log('usersIDs', usersIDs);
  const startDate = req.query.startDate;
  const endDate = req.query.endDate;

  const populateObject = {
    // user: userID,
    type: 'normal',
    'performance.all': { $gt: 0 },
    status: 'finished',
    end: { $exists: true },
  };
  if (startDate)
    populateObject.updatedAt = {
      ...populateObject.updatedAt,
      $gt: new Date(startDate),
    };

  if (endDate)
    populateObject.updatedAt = {
      ...populateObject.updatedAt,
      $lt: new Date(endDate),
    };

  const performances = await Promise.all(
    usersIDs.map(async (userID) => {
      populateObject.user = userID;
      // console.log('populateObject', populateObject);

      const sessions = await Session.find(populateObject).populate(
        'user',
        'firstName lastName'
      );

      // console.log('sessions', sessions);

      let statuses = sessions.map((item) => {
        let status;
        if (item.performance.onTime / item.performance.all >= 0.8) {
          status = 'onTime';
        } else {
          if (item.performance.tooLate > item.performance.danger) {
            status = 'tooLate';
          } else {
            status = 'danger';
          }
        }

        return status;
      });

      const statusesNumbers = {
        all: sessions.length,
        onTime: 0,
        danger: 0,
        tooLate: 0,
      };
      statuses.map((status) => {
        statusesNumbers[status] = statusesNumbers[status] + 1;
      });

      let user;
      if (sessions.length === 0) {
        user = await User.findById(userID).select('firstName lastName');
      }

      let userName = sessions[0]?.user || user;
      userName = `${userName.firstName} ${userName.lastName}`;
      return {
        user: userName,
        totalChats: statusesNumbers.all,
        onTime: statusesNumbers.onTime,
        danger: statusesNumbers.danger,
        tooLate: statusesNumbers.tooLate,
        // statusesNumbers,
        // sessions,
      };
    })
  );

  if (req.query.type === 'download') {
    // Convert JSON to Excel
    const xls = json2xls(performances);

    // Generate a unique filename
    const fileName = `data_${Date.now()}.xlsx`;

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
      results: performances.length,
      data: {
        performances,
      },
    });
  }
});
