const Ticket = require('../../models/ticketSystem/ticketModel');
const catchAsync = require('../../utils/catchAsync');

exports.getAllTicketsNumber = catchAsync(async (req, res, next) => {
  const tickets = await Ticket.find().populate('status', 'category');

  const totalTickets = tickets.length;

  const solvedTickets = tickets.map(
    (ticket) => ticket.status.category === 'solved'
  ).length;

  const unsolvedTickets = totalTickets - solvedTickets;

  const solvedTicketsTime = tickets.map((ticket) => {
    if (ticket.status.category === 'solved' && ticket.solvingTime) {
      const creationTime = ticket.createdAt;
      const solvingTime = ticket.solvingTime;
      return solvingTime - creationTime;
    }
  });

  let solvedTimeAverage;
  if (solvedTicketsTime.length > 0) {
    solvedTimeAverage =
      solvedTicketsTime.reduce((acc, cur) => {
        return acc + cur;
      }, 0) / solvedTicketsTime.length;
  }

  res.status(200).json({
    status: 'success',
    data: {
      totalTickets,
      solvedTickets,
      unsolvedTickets,
      solvedTimeAverage,
    },
  });
});
