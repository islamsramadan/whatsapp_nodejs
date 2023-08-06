const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const Conversation = require('./../models/conversationModel');

exports.getAllConversations = catchAsync(async (req, res, next) => {
  const conversations = await Conversation.find();

  res.status(200).json({
    status: 'success',
    results: conversations.length,
    data: {
      conversations,
    },
  });
});

exports.createConversation = catchAsync(async (req, res, next) => {
  const newConversation = await Conversation.create({
    ...req.body,
    user: req.user._id,
  });

  res.status(201).json({
    status: 'success',
    data: {
      conversation: newConversation,
    },
  });
});

exports.getConversation = catchAsync(async (req, res, next) => {
  const conversation = await Conversation.findById(req.params.id);

  if (!conversation) {
    return next(new AppError('No conversation found with that ID!', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      conversation,
    },
  });
});

exports.updateConversation = catchAsync(async (req, res, next) => {
  const conversation = await Conversation.findByIdAndUpdate(
    req.params.id,
    {
      ...req.body,
      user: req.user._id,
    },
    { runValidators: true }
  );

  if (!conversation) {
    return next(new AppError('No conversation found with that ID!', 404));
  }

  res.status(200).json({
    status: 'success',
    message: 'Conversation updated successfully!',
  });
});

exports.deleteConversation = catchAsync(async (req, res, next) => {
  const conversation = await Conversation.findByIdAndDelete(req.params.id);

  if (!conversation) {
    return next(new AppError('No conversation found with that ID!', 404));
  }

  res.status(200).json({
    status: 'success',
    message: 'Conversation deleted successfully!',
  });
});
