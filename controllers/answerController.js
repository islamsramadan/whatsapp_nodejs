const mongoose = require('mongoose');
const { ObjectId } = mongoose.Schema.Types;

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

  // Restriction to specific conditions
  if (
    (answersSet.type === 'private' &&
      !answersSet.creator.equals(req.user._id)) ||
    (answersSet.type === 'public' && req.user.role === 'user')
  ) {
    return next(
      new AppError("You don't have permission to perform this action!", 403)
    );
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
  const answer = await Answer.findById(req.params.id);
  if (!answer) {
    return next(new AppError('No answer found with that ID!', 404));
  }

  // Restriction to specific conditions
  const answersSet = await AnswersSet.findById(answer.answersSet);
  if (
    (answersSet.type === 'private' &&
      !answersSet.creator.equals(req.user._id)) ||
    (answersSet.type === 'public' && req.user.role === 'user')
  ) {
    return next(
      new AppError("You don't have permission to perform this action!", 403)
    );
  }

  await Answer.findByIdAndUpdate(req.params.id, req.body, {
    runValidators: true,
  });

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

  // Restriction to specific conditions
  const answersSet = await AnswersSet.findById(answer.answersSet);
  if (
    (answersSet.type === 'private' &&
      !answersSet.creator.equals(req.user._id)) ||
    (answersSet.type === 'public' && req.user.role === 'user')
  ) {
    return next(
      new AppError("You don't have permission to perform this action!", 403)
    );
  }

  await Answer.findByIdAndRemove(req.params.id);

  await AnswersSet.findByIdAndUpdate(answer.answersSet, {
    $pull: { answers: answer._id },
  });

  res.status(200).json({
    status: 'success',
    message: 'Answer deleted successfully!',
  });
});

exports.deleteMultiAnswers = catchAsync(async (req, res, next) => {
  const answersIDs = req.body.answersIDs;
  if (!answersIDs || answersIDs.length === 0) {
    return next(new AppError('answersIDs are required!', 400));
  }

  const answersToBeDeleted = await Answer.find({ _id: { $in: answersIDs } });

  if (answersToBeDeleted.length !== answersIDs.length) {
    return next(
      new AppError(
        'There are no answers found for one or more of provided IDs!',
        404
      )
    );
  }

  const differentAnswersSet = answersToBeDeleted.filter(
    (answer) => !answer.answersSet.equals(answersToBeDeleted[0].answersSet)
  );

  if (differentAnswersSet.length > 0) {
    return next(
      new AppError("Couldn't delete answers from different answers sets!", 400)
    );
  }

  // Restriction to specific conditions
  const answersSet = await AnswersSet.findById(
    answersToBeDeleted[0].answersSet
  );
  if (
    (answersSet.type === 'private' &&
      !answersSet.creator.equals(req.user._id)) ||
    (answersSet.type === 'public' && req.user.role === 'user')
  ) {
    return next(
      new AppError("You don't have permission to perform this action!", 403)
    );
  }

  // Delete answers
  const deletedAnswers = await Answer.deleteMany({ _id: { $in: answersIDs } });

  // Updating answers set
  await AnswersSet.findByIdAndUpdate(
    answersToBeDeleted[0].answersSet,
    { $pull: { answers: { $in: answersIDs } } },
    { new: true, runValidators: true }
  );

  res.status(200).json({
    status: 'success',
    message: `${deletedAnswers.deletedCount} Answers deleted successfully!`,
  });
});
