const catchAsync = require('../utils/catchAsync');
const Chat = require('./../models/chatModel');

exports.getAllChats = catchAsync(async (req, res, next) => {
  const chats = await Chat.find().populate('lastMessage');

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
