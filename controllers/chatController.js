const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const Chat = require('./../models/chatModel');

exports.getAllChats = catchAsync(async (req, res, next) => {
  const chats = await Chat.find().sort('-updatedAt').populate('lastMessage');

  res.status(200).json({
    status: 'success',
    results: chats.length,
    data: {
      chats,
    },
  });
});

exports.createChat = catchAsync(async (req, res, next) => {
  const newChat = await Chat.create({
    client: req.body.client,
    activeUser: req.user.id,
    users: [req.user.id],
  });

  res.status(201).json({
    status: 'success',
    data: {
      chat: newChat,
    },
  });
});

exports.updateChatNotification = catchAsync(async (req, res, next) => {
  const chat = await Chat.findOne({ client: req.params.chatNumber });
  if (!chat) {
    return next(new AppError('No chat found with that number', 404));
  }

  if (req.body?.notification === false) {
    chat.notification = false;
    await chat.save();
  }

  res.status(200).json({
    status: 'success',
    message: 'Chat notification updated successfully!',
  });
});
