const ExcelJS = require('exceljs');
const fs = require('fs');

const Ticket = require('../../models/ticketSystem/ticketModel');
const User = require('../../models/userModel');

const catchAsync = require('../../utils/catchAsync');
const getDateRange = require('../../utils/dateRangeFilter');

exports.getTicketPerformance = catchAsync(async (req, res, next) => {
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

  const filteredBody = {};

  if (req.query.startDate) {
    const start = new Date(req.query.startDate);

    if (req.query.endDate) {
      const end = new Date(req.query.endDate);

      const dateRange = getDateRange(start, end);

      filteredBody.createdAt = {
        $gte: dateRange.start,
        $lte: dateRange.end,
      };
    } else {
      filteredBody.createdAt = {
        $gte: getDateRange(start).start,
      };
    }
  }

  const performances = await Promise.all(
    usersIDs.map(async (userID) => {
      const user = await User.findById(userID).select('firstName lastName');
      filteredBody.assignee = user._id;

      const tickets = await Ticket.find(filteredBody)
        .select('status createdAt solvingTime rating')
        .populate('status', 'category');

      // =================> Total tickets
      const totalTickets = tickets.length;

      // =================> Solved tickets
      const solvedTickets = tickets.filter(
        (ticket) => ticket.status.category === 'solved'
      );

      // =================> Unsolved tickets
      const unsolvedTickets = totalTickets - solvedTickets.length;

      // =================> Solved time average
      const solvedTicketsTime = solvedTickets
        .filter(
          (ticket) => ticket.status.category === 'solved' && ticket.solvingTime
        )
        .map((item) => item.solvingTime - item.createdAt);

      //   console.log('solvedTicketsTime', solvedTicketsTime);

      function convertMillisecondsToHoursMinutes(milliseconds) {
        // Convert milliseconds to total seconds
        const totalSeconds = Math.floor(milliseconds / 1000);

        // Calculate total minutes from total seconds
        const totalMinutes = Math.floor(totalSeconds / 60);

        // Calculate total hours from total minutes
        const totalHours = Math.floor(totalMinutes / 60);

        // Calculate days from total hours
        const days = Math.floor(totalHours / 24);

        // Remaining hours after converting to days
        const hours = totalHours % 24;

        // Remaining minutes after converting to hours
        const minutes = totalMinutes % 60;

        return { days, hours, minutes };
      }

      let solvedTimeAverage;
      if (solvedTicketsTime.length > 0) {
        solvedTimeAverage =
          solvedTicketsTime.reduce((acc, cur) => {
            return acc + cur;
          }, 0) / solvedTicketsTime.length;

        solvedTimeAverage =
          convertMillisecondsToHoursMinutes(solvedTimeAverage);
      }

      const totalRatedTickets = tickets.filter(
        (ticket) => ticket.rating
      ).length;
      const positiveTickets = tickets.filter(
        (ticket) => ticket.rating === 'Positive'
      ).length;
      const NeutralTickets = tickets.filter(
        (ticket) => ticket.rating === 'Neutral'
      ).length;
      const NegativeTickets = tickets.filter(
        (ticket) => ticket.rating === 'Negative'
      ).length;

      return {
        user: `${user.firstName} ${user.lastName}`,
        totalTickets,
        solvedTickets: solvedTickets.length,
        unsolvedTickets,
        solvedTimeAverage,

        totalRatedTickets,
        positiveTickets,
        NeutralTickets,
        NegativeTickets,
      };
    })
  );

  if (req.query.type === 'download') {
    // Create a new workbook
    const workbook = new ExcelJS.Workbook();

    // Add a new sheet to the workbook
    const worksheet = workbook.addWorksheet('tickets');

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
      { header: 'Total Tickets', key: 'totalTickets', width: 30 },
      { header: 'Solved', key: 'solvedTickets', width: 30 },
      { header: 'Unsolved', key: 'unsolvedTickets', width: 30 },
      { header: 'Solving Time avg.', key: 'solvedTimeAverage', width: 50 },
      { header: 'Total Rated Tickets', key: 'totalRatedTickets', width: 30 },
      { header: 'Positive', key: 'positiveTickets', width: 30 },
      { header: 'Neutral', key: 'NeutralTickets', width: 30 },
      { header: 'Negative', key: 'NegativeTickets', width: 30 },
    ];

    // Add auto-filter to all columns
    worksheet.autoFilter = {
      from: 'A1',
      to: `I${performances.length + 1}`, // Adjust based on the number of data rows
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
    const fileName = `tickets-performance_${Date.now()}.xlsx`;
    await workbook.xlsx.writeFile(fileName);
    console.log('Excel file created successfully.');

    // Send the Excel file as a response
    res.download(fileName, () => {
      // Remove the file after sending
      fs.unlinkSync(fileName);
    });
  } else {
    res.status(200).json({
      status: 'success',
      data: {
        performances,
      },
    });
  }
});
