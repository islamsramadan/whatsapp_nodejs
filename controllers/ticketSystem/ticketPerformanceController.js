const catchAsync = require('../../utils/catchAsync');

exports.getTicketPerformance = catchAsync(async (req, res, next) => {
  res.status(200).json({
    status: 'success',
    data: {},
  });
});
