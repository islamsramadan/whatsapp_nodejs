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
        (ticket) => ticket.rating === 'positive'
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

  res.status(200).json({
    status: 'success',
    data: {
      performances,
    },
  });
});
