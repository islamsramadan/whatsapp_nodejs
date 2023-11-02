const catchAsync = require('../utils/catchAsync');
const AnswersSet = require('../models/answersSetModel');
const AppError = require('../utils/appError');
const User = require('../models/userModel');

exports.getAllAnswersSet = catchAsync(async (req, res, next) => {
  const answersSets = await AnswersSet.find({ type: 'public' })
    .populate('answers', 'name')
    .populate('creator', 'firstName lastName');

  res.status(200).json({
    status: 'success',
    results: answersSets.length,
    data: {
      answersSets,
    },
  });
});

exports.createAnswersSet = catchAsync(async (req, res, next) => {
  const { name, type, answers } = req.body;

  if (req.body?.type === 'private' && req.user.answersSet) {
    return next(
      new AppError('You could have only one private answers set!', 400)
    );
  }

  const answersSetData = {
    name,
    answers,
    type,
    creator: req.user._id,
  };
  if (req.body?.type === 'private' && !answersSetData.name) {
    answersSetData.name = `Private-${req.user._id}`;
  }

  const newAnswersSet = await AnswersSet.create(answersSetData);

  if (req.body?.type === 'private') {
    await User.findByIdAndUpdate(
      req.user._id,
      { answersSet: newAnswersSet._id },
      { new: true, runValidators: true }
    );
  }

  res.status(201).json({
    status: 'success',
    data: {
      answersSet: newAnswersSet,
    },
  });
});

exports.getAnswersSet = catchAsync(async (req, res, next) => {
  const answersSet = await AnswersSet.findById(req.params.id)
    .populate('answers', 'name body')
    .populate('creator', 'firstName lastName');

  if (!answersSet) {
    return next(new AppError('No answers set found with that ID!', 404));
  }

  if (
    answersSet.type === 'private' &&
    !req.user._id.equals(answersSet.creator._id)
  ) {
    return next(new AppError('Private answers!', 400));
  }

  res.status(200).json({
    status: 'success',
    data: {
      answersSet,
    },
  });
});

exports.updateAnswersSet = catchAsync(async (req, res, next) => {
  const answersSet = await AnswersSet.findByIdAndUpdate(
    req.params.id,
    { ...req.body, creator: req.user._id },
    {
      runValidators: true,
    }
  );

  if (!answersSet) {
    return next(new AppError('No answers set found with that ID!', 404));
  }

  res.status(200).json({
    status: 'success',
    message: 'Answers set updated successfully!',
  });
});

exports.deleteAnswersSet = catchAsync(async (req, res, next) => {
  const answersSet = await AnswersSet.findById(req.params.id);

  if (!answersSet) {
    return next(new AppError('No answers set found with that ID!', 404));
  }

  if (answersSet.type === 'private') {
    return next(new AppError("Couldn't delete private answers set!", 400));
  }

  if (answersSet.answers.length > 0) {
    return next(
      new AppError("Couldn't delete answers set with active answers!", 400)
    );
  }

  await AnswersSet.findByIdAndDelete(req.params.id);

  res.status(200).json({
    status: 'success',
    message: 'Answers set deleted successfully!',
  });
});
