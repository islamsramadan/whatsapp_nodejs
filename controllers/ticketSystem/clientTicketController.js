const Comment = require('../../models/ticketSystem/commentModel');
const TicketLog = require('../../models/ticketSystem/ticketLogModel');
const Ticket = require('../../models/ticketSystem/ticketModel');
const AppError = require('../../utils/appError');
const catchAsync = require('../../utils/catchAsync');

const getPopulatedTicket = async (filterObj) => {
  return await Ticket.findOne(filterObj)
    .populate('category', 'name')
    .populate('creator', 'firstName lastName photo')
    .populate('assignee', 'firstName lastName photo')
    .populate('team', 'name')
    .populate('status', 'endUserDisplayName category')
    .populate('form', 'name')
    .populate({
      path: 'questions.field',
      select: '-updatedAt -createdAt -forms -creator',
      populate: { path: 'type', select: 'name value description' },
    });
};

exports.protectClientTicket = catchAsync(async (req, res, next) => {
  // 1) Getting token and check if it is there
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(
      new AppError(
        'You are not authenticated! Kindly get the correct link for your ticket.',
        401
      )
    );
  }

  const ticket = await Ticket.findOne({ clientToken: token });

  if (!ticket) {
    return next(
      new AppError(
        'No ticket found! Kindly get the correct link for your ticket.',
        404
      )
    );
  }

  // GRANT ACCESS TO PROTECTED ROUTE
  req.ticket = ticket;
  next();
});

exports.getClientTicket = catchAsync(async (req, res, next) => {
  const ticketID = req.ticket._id;

  const ticket = await getPopulatedTicket({ _id: ticketID });

  const ticketLogs = await TicketLog.find({ ticket: ticketID })
    .populate('ticket', 'order')
    .populate('user', 'firstName lastName photo')
    .populate('assignee', 'firstName lastName photo')
    .populate('transfer.from.user', 'firstName lastName photo')
    .populate('transfer.to.user', 'firstName lastName photo')
    .populate('transfer.from.team', 'name')
    .populate('transfer.to.team', 'name')
    .populate('status', 'endUserDisplayName category');

  const ticketComments = await Comment.find({
    ticket: ticketID,
  }).populate('user', 'firstName lastName photo');

  res.status(200).json({
    status: 'success',
    data: {
      ticket,
      ticketLogs,
      ticketComments,
    },
  });
});

exports.sendFeedback = catchAsync(async (req, res, next) => {
  const { rating, feedback } = req.body;

  if (!rating) {
    return next(new AppError('Client rating is required', 400));
  }

  const updatedBody = { rating };

  if (feedback) updatedBody.feedback = feedback;

  const updatedTicket = await Ticket.findByIdAndUpdate(
    req.ticket._id,
    updatedBody,
    { new: true, runValidators: true }
  );

  res.status(200).json({
    status: 'success',
    data: {
      ticket: updatedTicket,
    },
  });
});
