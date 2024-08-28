const TicketLog = require('../../models/ticketSystem/ticketLogModel');
const catchAsync = require('../../utils/catchAsync');

exports.getAllTicketLogs = catchAsync(async (req, res, next) => {
  const logs = await TicketLog.find({ ticket: req.params.ticketID });

  res.status(200).json({
    results: logs.length,
    data: {
      ticketLogs: logs,
    },
  });
});
