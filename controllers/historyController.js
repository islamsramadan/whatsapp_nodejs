const Chat = require('../models/chatModel');
const ChatHistory = require('../models/historyModel');
const catchAsync = require('../utils/catchAsync');

exports.getAllChatHistory = catchAsync(async (req, res, next) => {
  const chat = await Chat.findById(req.params.chatID);
  if (!chat) {
    return next(new AppError('No chat found with that number!', 404));
  }

  const page = req.query.page * 1 || 1;

  const histories = await ChatHistory.find({ chat })
    .sort('-createdAt')
    .populate('user', 'firstName lastName')
    .populate('transfer.from', 'firstName lastName')
    .populate('transfer.to', 'firstName lastName')
    .populate('transfer.fromTeam', 'name')
    .populate('transfer.toTeam', 'name')
    .populate('takeOwnership.from', 'firstName lastName')
    .populate('takeOwnership.to', 'firstName lastName')
    .populate('start', 'firstName lastName')
    .populate('archive', 'firstName lastName')
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
