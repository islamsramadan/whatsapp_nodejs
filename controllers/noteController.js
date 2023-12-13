const Chat = require('../models/chatModel');
const Note = require('../models/noteModel');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');

// exports.getAllNotes = catchAsync(async (req, res, next) => {
//   const notes = await Note.find();

//   res.status(200).json({
//     status: 'success',
//     results: notes.length,
//     data: {
//       notes,
//     },
//   });
// });

exports.getAllChatNotes = catchAsync(async (req, res, next) => {
  const chat = await Chat.findOne({ client: req.params.chatNumber });
  if (!chat) {
    return next(new AppError('No chat found with that number!', 404));
  }

  const notes = await Note.find({ chat: chat._id })
    .populate('creator', 'firstName lastName photo')
    .populate('updater', 'firstName lastName photo');

  res.status(200).json({
    status: 'success',
    results: notes.length,
    data: {
      notes,
    },
  });
});

exports.getNote = catchAsync(async (req, res, next) => {
  const note = await Note.findById(req.params.id)
    .populate('creator', 'firstName lastName photo')
    .populate('updater', 'firstName lastName photo');

  if (!note) {
    return next(new AppError('No note found with that ID!', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      note,
    },
  });
});

exports.createNote = catchAsync(async (req, res, next) => {
  const chat = await Chat.findOne({ client: req.params.chatNumber });
  if (!chat) {
    return next(new AppError('No chat found with that number!', 404));
  }

  const newNote = await Note.create({
    chat: chat._id,
    creator: req.user._id,
    body: req.body.body,
  });

  res.status(201).json({
    status: 'success',
    data: {
      note: newNote,
    },
  });
});

exports.updateNote = catchAsync(async (req, res, next) => {
  const note = await Note.findById(req.params.id);
  if (!note) {
    return next(new AppError('No note found with that ID!', 404));
  }

  if (!req.body.body) {
    return next(new AppError('Note body is required!', 400));
  }

  const updatedNote = await Note.findByIdAndUpdate(
    req.params.id,
    {
      body: req.body.body,
      updater: req.user._id,
    },
    {
      new: true,
      runValidators: true,
    }
  );

  res.status(200).json({
    status: 'success',
    data: {
      note: updatedNote,
    },
  });
});

exports.deleteNote = catchAsync(async (req, res, next) => {
  const note = await Note.findById(req.params.id);
  if (!note) {
    return next(new AppError('No note found with that ID!', 404));
  }

  await Note.findByIdAndDelete(req.params.id);

  res.status(200).json({
    status: 'success',
    message: 'Note deleted successfully!',
  });
});
