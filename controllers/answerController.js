const AppError = require('./../utils/appError');
const Answer = require('./../models/answerModel');
const catchAsync = require('./../utils/catchAsync');
const AnswersSet = require('../models/answersSetModel');

exports.getAllAnswers = catchAsync(async (req, res, next) => {
  const answers = await Answer.find()
    .populate('answersSet', 'name')
    .populate('creator', 'firstName lastName');

  res.status(200).json({
    status: 'success',
    results: answers.length,
    data: {
      answers,
    },
  });
});

exports.createAnswer = catchAsync(async (req, res, next) => {
  const answersSet = await AnswersSet.findById(req.body.answersSet);
  if (!answersSet) {
    return next(new AppError("Couldn't found answers set with that ID!", 404));
  }

  const newAnswer = await Answer.create({ ...req.body, creator: req.user._id });

  await AnswersSet.findByIdAndUpdate(answersSet._id, {
    answers: [...answersSet.answers, newAnswer._id],
  });

  res.status(200).json({
    status: 'success',
    data: {
      answer: newAnswer,
    },
  });
});

exports.getAnswer = catchAsync(async (req, res, next) => {
  const answer = await Answer.findById(req.params.id)
    .populate('answersSet', 'name')
    .populate('creator', 'firstName lastName');

  if (!answer) {
    return next(new AppError('No answer found with that ID!', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      answer,
    },
  });
});

exports.updateAnswer = catchAsync(async (req, res, next) => {
  const answer = await Answer.findByIdAndUpdate(
    req.params.id,
    { ...req.body, user: req.user._id },
    {
      runValidators: true,
    }
  );

  if (!answer) {
    return next(new AppError('No answer found with that ID!', 404));
  }

  res.status(200).json({
    status: 'success',
    message: 'Answer updated successfully!',
  });
});

exports.deleteAnswer = catchAsync(async (req, res, next) => {
  const answer = await Answer.findById(req.params.id);
  if (!answer) {
    return next(new AppError('No answer found with that ID!', 404));
  }

  const answersSet = await AnswersSet.findById(answer.answersSet);
  if (!answersSet) {
    return next(new AppError('No answers set found for this answer!', 404));
  }

  await Answer.findByIdAndRemove(req.params.id);

  await AnswersSet.findByIdAndUpdate(answer.answersSet, {
    answers: answersSet.answers.filter((el) => !el.equals(answer._id)),
  });

  res.status(200).json({
    status: 'success',
    message: 'Answer deleted successfully!',
  });
});
