const ExcelJS = require('exceljs');
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
    // Create a new workbook
    const workbook = new ExcelJS.Workbook();

    // Add a new sheet to the workbook
    const worksheet = workbook.addWorksheet('performance');

    // Add header row (keys of JSON objects)
    const headers = Object.keys(performances[0]);
    worksheet.addRow(headers);

    // Add data rows
    performances.forEach((data) => {
      worksheet.addRow(Object.values(data));
    });

    // Add columns to the sheet
    worksheet.columns = [
      { header: 'User', key: 'user', width: 30 },
      { header: 'Total Chats', key: 'totalChats', width: 30 },
      { header: 'On Time', key: 'onTime', width: 30 },
      { header: 'Danger', key: 'danger', width: 30 },
      { header: 'Too Late', key: 'tooLate', width: 30 },
    ];

    // Add auto-filter to all columns
    worksheet.autoFilter = {
      from: 'A1',
      to: `E${performances.length + 1}`, // Adjust based on the number of data rows
    };

    worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.alignment = {
          vertical: 'middle',
          horizontal: 'center',
          wrapText: true,
        };
      });
    });

    const headerRow = worksheet.getRow(1);
    headerRow.height = 40;
    headerRow.font = {
      name: 'Arial', // Font family
      size: 12, // Font size
      bold: true, // Bold text
    };
    headerRow.commit();

    // Save the workbook to a file
    const fileName = `Performance_${Date.now()}.xlsx`;
    await workbook.xlsx.writeFile(fileName);

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
