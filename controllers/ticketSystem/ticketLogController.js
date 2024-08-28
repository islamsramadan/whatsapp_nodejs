const TicketLog = require('../../models/ticketSystem/ticketLogModel');
const catchAsync = require('../../utils/catchAsync');

exports.getAllTicketLogs = catchAsync(async (req, res, next) => {
  const logs = await TicketLog.find({ ticket: req.params.ticketID })
    .populate('ticket', 'order')
    .populate('user', 'firstName lastName photo')
    .populate('assignee', 'firstName lastName photo')
    .populate('transfer.from.user', 'firstName lastName photo')
    .populate('transfer.to.user', 'firstName lastName photo')
    .populate('transfer.from.team', 'name')
    .populate('transfer.to.team', 'name')
    .populate('status', 'name endUserDisplayName category');

  res.status(200).json({
    results: logs.length,
    data: {
      ticketLogs: logs,
    },
  });
});
