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

exports.getAllPerformance = catchAsync(async (req, res, next) => {
  let usersIDs = req.query.selectedUsers?.split(',');
  let teamsIDs = req.query.selectedTeams?.split(',');

  if (!req.query.selectedUsers) {
    if (req.query.selectedTeams) {
      usersIDs = await User.find({
        team: { $in: teamsIDs },
        deleted: false,
      });
    } else {
      usersIDs = await User.find({ bot: false, deleted: false });
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

  if (endDate) {
    const endDateObj = new Date(endDate);
    endDateObj.setDate(endDateObj.getDate() + 1);

    populateObject.updatedAt = {
      ...populateObject.updatedAt,
      $lt: endDateObj,
    };
  }

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
