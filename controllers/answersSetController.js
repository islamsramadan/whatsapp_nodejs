const catchAsync = require('../utils/catchAsync');
const AnswersSet = require('../models/answersSetModel');
const AppError = require('../utils/appError');

exports.getAllAnswersSet = catchAsync(async (req, res, next) => {
  const answersSets = await AnswersSet.find();

  res.status(200).json({
    status: 'success',
    results: answersSets.length,
    data: {
      answersSets,
    },
  });
});

exports.createAnswersSet = catchAsync(async (req, res, next) => {
  const newAnswersSet = await AnswersSet.create({
    ...req.body,
    user: req.user._id,
  });

  res.status(201).json({
    status: 'success',
    data: {
      answersSet: newAnswersSet,
    },
  });
});

exports.getAnswersSet = catchAsync(async (req, res, next) => {
  const answersSet = await AnswersSet.findById(req.params.id)
    .populate('answers')
    .populate('user');

  if (!answersSet) {
    return next(new AppError('No answers set found with that ID!', 404));
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
    { ...req.body, user: req.user._id },
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
