const Ticket = require('../../models/ticketSystem/ticketModel');
const TicketStatus = require('../../models/ticketSystem/ticketStatusModel');
const catchAsync = require('../../utils/catchAsync');

const filterObj = (obj, ...allowedFields) => {
  const newObj = {};
  Object.keys(obj).forEach((el) => {
    if (allowedFields.includes(el)) newObj[el] = obj[el];
  });
  return newObj;
};

exports.getAllStatuses = catchAsync(async (req, res, next) => {
  const filteredBody = {};

  if (req.query.status) {
    filteredBody.status = req.query.status;
  }

  const statuses = await TicketStatus.find(filteredBody);

  res.status(200).json({
    status: 'success',
    results: statuses.length,
    data: {
      statuses,
    },
  });
});

exports.getStatus = catchAsync(async (req, res, next) => {
  const status = await TicketStatus.findById(req.params.statusID);

  if (!status) {
    return next(new AppError('No status found with taht ID!', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      status,
    },
  });
});

exports.createStatus = catchAsync(async (req, res, next) => {
  const { name, description, category, endUserView } = req.body;

  if (!name || !category || !endUserView) {
    return next(new AppError('Status details are required!', 400));
  }

  const newStatusData = {
    name,
    description,
    category,
    endUserView,
    creator: req.user._id,
  };

  const newStatus = await TicketStatus.create(newStatusData);

  res.status(201).json({
    status: 'success',
    data: {
      status: newStatus,
    },
  });
});

exports.updateStatus = catchAsync(async (req, res, next) => {
  const status = await TicketStatus.findById(req.params.statusID);

  if (!status) {
    return next(new AppError('No status found with that ID', 404));
  }

  const filteredBody = filterObj(
    req.body,
    'name',
    'description',
    'endUserView',
    'status'
  );
  filteredBody.updater = req.user._id;

  await TicketStatus.findByIdAndUpdate(req.params.statusID, filteredBody, {
    runValidators: true,
    new: true,
  });

  res.status(200).json({
    status: 'success',
    message: 'Status updated successfully!',
  });
});

// exports.deleteStatus = catchAsync(async (req, res, next) => {
//   const status = await TicketStatus.findById(req.params.statusID);

//   if (!status) {
//     return next(new AppError('No status found with that ID!', 404));
//   }

//   if (status.default) {
//     return next(new AppError("Couldn't delete default satatus!", 400));
//   }
// removed status

//   const ticketsWithStatus = await Ticket.find({ status: req.params.statusID });
//   if (ticketsWithStatus.length > 0) {
//     return next(new AppError("Couldn't delete status used in tickets!", 400));
//   }

//   await TicketStatus.findByIdAndDelete(req.params.statusID);

//   res.status(200).json({
//     status: 'success',
//     message: 'Status deleted successfully!',
//   });
// });
