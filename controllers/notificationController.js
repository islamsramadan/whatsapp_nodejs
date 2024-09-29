const Notification = require('../models/notificationModel');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');

exports.getAllUserNotifications = catchAsync(async (req, res, next) => {
  const page = req.query.page * 1 || 1;

  const notifications = await Notification.find({ user: req.user._id })
    .populate('ticket', 'order')
    .populate('chat', 'client')
    .limit(page * 10);

  const totalResults = await Notification.count({ user: req.user._id });

  const totalPages = totalResults / 10;

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

  const updatedNotification = await Notification.findByIdAndUpdate(
    req.params.notificationID,
    { read: true },
    { new: true, runValidators: true }
  );

  res.status(200).json({
    status: 'success',
    message: 'Read notification updated successfully!',
  });
});
