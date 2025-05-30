const axios = require('axios');

const EndUserNotification = require('../../models/endUser/endUserNotificationModel');
const Chat = require('../../models/chatModel');
const Ticket = require('../../models/ticketSystem/ticketModel');
const AppError = require('../../utils/appError');
const catchAsync = require('../../utils/catchAsync');

exports.getAllEndUserNotifications = catchAsync(async (req, res, next) => {
  const page = req.query.page * 1 || 1;

  const notifications = await EndUserNotification.find({
    endUser: req.endUser._id,
  })
    .sort('-sortingDate')
    .populate('ticket', 'order')
    .populate('chat', 'client')
    .limit(page * 10);

  const newNotifications = await EndUserNotification.count({
    endUser: req.endUser._id,
    read: false,
  });

  const totalResults = await EndUserNotification.count({
    endUser: req.endUser._id,
  });

  const totalPages = Math.ceil(totalResults / 10);

  res.status(200).json({
    status: 'success',
    results: notifications.length,
    data: {
      page,
      totalPages,
      totalResults,
      newNotifications,
      notifications,
    },
  });
});

exports.getAllEndUserNotificationsNumbers = catchAsync(
  async (req, res, next) => {
    const newNotifications = await EndUserNotification.count({
      endUser: req.endUser._id,
      read: false,
    });

    res.status(200).json({
      status: 'success',
      data: {
        newNotifications,
      },
    });
  }
);

exports.readEndUserNotification = catchAsync(async (req, res, next) => {
  const notification = await EndUserNotification.findById(
    req.params.notificationID
  );

  if (!notification) {
    return next(new AppError('No notification found with that ID!', 404));
  }

  if (!notification.endUser.equals(req.endUser._id)) {
    return next(
      new AppError('This notification belongs to another user!', 400)
    );
  }

  await EndUserNotification.findByIdAndUpdate(
    req.params.notificationID,
    { read: true, numbers: 0 },
    { new: true, runValidators: true }
  );

  //???????????????????????????????????????????????
  //???????????????????????????????????????????????
  //???????????????????????????????????????????????
  // updating notifications event in socket io
  if (req.app.connectedUsers[notification.user]) {
    req.app.connectedUsers[notification.user].emit('updatingNotifications');
  }

  res.status(200).json({
    status: 'success',
    message: 'Read notification updated successfully!',
  });
});

exports.readAllEndUserTicketNotifications = catchAsync(
  async (req, res, next) => {
    const ticket = await Ticket.findById(req.params.ticketID);
    if (!ticket) {
      return next(new AppError('No ticket found with that ID', 404));
    }

    await EndUserNotification.updateMany(
      { ticket: ticket._id, endUser: req.endUser._id },
      { read: true, numbers: 0 },
      { new: true, runValidators: true }
    );

    //????????????????????????????????????????????????????????
    //????????????????????????????????????????????????????????
    //????????????????????????????????????????????????????????
    // updating notifications event in socket io
    // if (req.app.connectedUsers[req.user._id]) {
    //   req.app.connectedUsers[req.user._id].emit('updatingNotifications');
    // }

    res.status(200).json({
      status: 'success',
      message: 'Ticket notifications updated successfully!',
    });
  }
);

exports.readAllEndUserChatNotifications = catchAsync(async (req, res, next) => {
  const chat = await Chat.findById(req.params.chatID);

  if (!chat) {
    return next(new AppError('No chat found with that number!', 404));
  }

  await EndUserNotification.updateMany(
    { chat: chat._id, endUser: req.endUser._id },
    { read: true, numbers: 0 },
    { new: true, runValidators: true }
  );

  //???????????????????????????????????????????????????????
  //???????????????????????????????????????????????????????
  //???????????????????????????????????????????????????????
  // updating notifications event in socket io
  // if (req.app.connectedUsers[req.user._id]) {
  //   req.app.connectedUsers[req.user._id].emit('updatingNotifications');
  // }

  res.status(200).json({
    status: 'success',
    message: 'Chat notifications updated successfully!',
  });
});

exports.readAllEndUserNotifications = catchAsync(async (req, res, next) => {
  await EndUserNotification.updateMany(
    { endUser: req.endUser._id },
    { read: true, numbers: 0 },
    { new: true, runValidators: true }
  );

  //??????????????????????????????????????????????????????
  //??????????????????????????????????????????????????????
  //??????????????????????????????????????????????????????
  // updating notifications event in socket io
  // if (req.app.connectedUsers[req.user._id]) {
  //   req.app.connectedUsers[req.user._id].emit('updatingNotifications');
  // }

  res.status(200).json({
    status: 'success',
    message: 'User notifications updated successfully!',
  });
});

const sendDataToThirdParty = async (data) => {
  // console.log('data =======================', data);

  try {
    const response = await axios.post(
      'https://api.althameen.net/api/v1/notification-web/store',
      data
    );

    // console.log('Success:', response.data);

    if (response.data && Object.keys(response.data.data).length > 0) {
      const notificationsIDs = Object.keys(response.data.data);
      const updatedNotificationsIDs = notificationsIDs.filter((item) => {
        return response.data.data[`${item}`] === 'success';
      });

      // console.log('updatedNotificationsIDs', updatedNotificationsIDs);
      await EndUserNotification.updateMany(
        { _id: { $in: updatedNotificationsIDs } },
        {
          sent: true,
        }
      );
    }
  } catch (error) {
    console.error('Error sending data:', error.response?.data || error.message);
  }
};

exports.sendEndUserNotifications = async () => {
  const notifications = await EndUserNotification.find({
    sent: false,
  }).populate('endUser', 'phone');

  // console.log('notifications.length', notifications.length);

  const sentNoificationsArray = await Promise.all(
    notifications.map(async (notification) => {
      let mobile_number = notification.endUser.phone;

      if (mobile_number.startsWith('966')) {
        mobile_number = `0${mobile_number.slice(3)}`;
      } else if (mobile_number.startsWith('20')) {
        mobile_number = mobile_number.slice(1);
      }

      return {
        notification_uuid: notification._id,
        mobile_number,
        reference_number: notification.refNo,
        title: notification.event,
        content: notification.message,
        item: notification.ticket,
        type: notification.type,
      };
    })
  );

  await sendDataToThirdParty(sentNoificationsArray);
};
