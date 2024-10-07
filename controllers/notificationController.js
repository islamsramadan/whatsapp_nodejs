const Chat = require('../models/chatModel');
const Notification = require('../models/notificationModel');
const Ticket = require('../models/ticketSystem/ticketModel');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');

exports.getAllUserNotifications = catchAsync(async (req, res, next) => {
  const page = req.query.page * 1 || 1;

  const notifications = await Notification.find({ user: req.user._id })
    .populate('ticket', 'order')
    .populate('chat', 'client')
    .limit(page * 10);

  const totalResults = await Notification.count({ user: req.user._id });

  const totalPages = Math.ceil(totalResults / 10);

  res.status(200).json({
    status: 'success',
    results: notifications.length,
    data: {
      page,
      totalPages,
      totalResults,
      notifications,
    },
  });
});

exports.readNotification = catchAsync(async (req, res, next) => {
  const notification = await Notification.findById(req.params.notificationID);

  if (!notification) {
    return next(new AppError('No notification found with that ID!', 404));
  }

  if (!notification.user.equals(req.user._id)) {
    return next(
      new AppError('This notification belongs to another user!', 400)
    );
  }

  await Notification.findByIdAndUpdate(
    req.params.notificationID,
    { read: true, numbers: 0 },
    { new: true, runValidators: true }
  );

  res.status(200).json({
    status: 'success',
    message: 'Read notification updated successfully!',
  });
});

exports.readAllUserTicketNotifications = catchAsync(async (req, res, next) => {
  const ticket = await Ticket.findById(req.params.ticketID);
  if (!ticket) {
    return next(new AppError('No ticket found with that ID', 404));
  }

  const updatedNotifications = await Notification.updateMany(
    { ticket: ticket._id, user: req.user._id },
    { read: true, numbers: 0 },
    { new: true, runValidators: true }
  );

  res.status(200).json({
    status: 'success',
    message: 'Ticket notifications updated successfully!',
    updatedNotifications,
  });
});

exports.readAllUserChatNotifications = catchAsync(async (req, res, next) => {
  const chat = await Chat.findById(req.params.chatID);

  if (!chat) {
    return next(new AppError('No chat found with that ID', 404));
  }

  const updatedNotifications = await Notification.updateMany(
    { chat: chat._id, user: req.user._id },
    { read: true, numbers: 0 },
    { new: true, runValidators: true }
  );

  res.status(200).json({
    status: 'success',
    message: 'Ticket notifications updated successfully!',
    updatedNotifications,
  });
});

exports.readAllUserNotifications = catchAsync(async (req, res, next) => {
  const updatedNotifications = await Notification.updateMany(
    { user: req.user._id },
    { read: true, numbers: 0 },
    { new: true, runValidators: true }
  );

  res.status(200).json({
    status: 'success',
    message: 'Ticket notifications updated successfully!',
    updatedNotifications,
  });
});
