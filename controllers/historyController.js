const Chat = require('../models/chatModel');
const ChatHistory = require('../models/historyModel');
const catchAsync = require('../utils/catchAsync');

exports.getAllChatHistory = catchAsync(async (req, res, next) => {
  const chat = await Chat.find({ client: req.params.chatNumber });
  if (!chat) {
    return next(new AppError('No chat found with that number!', 404));
  }

  const page = req.query.page * 1 || 1;

  const histories = await ChatHistory.find({ chat })
    .sort('-createdAt')
    .limit(page * 30);

  const totalResults = await ChatHistory.count({ chat });
  const totalPages = Math.ceil(totalResults / 30);

  res.status(200).json({
    status: 'success',
    results: histories.length,
    data: {
      totalPages,
      totalResults,
      page,
      histories,
    },
  });
});
