const Team = require('../models/teamModel');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const Service = require('./../models/serviceModel');

exports.getAllServices = catchAsync(async (req, res, next) => {
  const services = await Service.find();

  res.status(200).json({
    status: 'success',
    results: services.length,
    data: {
      services,
    },
  });
});

exports.createService = catchAsync(async (req, res, next) => {
  if (!req.body.durations || req.body.durations.length === 0) {
    return next(new AppError('Service durations are required!', 400));
  }

  const newService = await Service.create({
    ...req.body,
    creator: req.user._id,
  });

  res.status(201).json({
    status: 'success',
    data: {
      service: newService,
    },
  });
});

exports.getService = catchAsync(async (req, res, next) => {
  const service = await Service.findById(req.params.id).populate(
    'creator',
    'firstName lastName photo'
  );

  if (!service) {
    return next(new AppError('No service found with that ID!', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      service,
    },
  });
});

exports.updateService = catchAsync(async (req, res, next) => {
  const service = await Service.findById(req.params.id);
  if (!service) {
    return next(new AppError('No service found with that ID!', 404));
  }

  if (req.body.durations && req.body.durations.length === 0) {
    return next(new AppError('Service durations are required!', 400));
  }

  const updatedService = await Service.findByIdAndUpdate(
    req.params.id,
    req.body,
    {
      new: true,
      runValidators: true,
    }
  );

  if (!updatedService) {
    return next(new AppError('No service found with that ID!', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      service: updatedService,
    },
  });
});

exports.deleteService = catchAsync(async (req, res, next) => {
  const service = await Service.findById(req.params.id);

  if (!service) {
    return next(new AppError('No service found with that ID!', 404));
  }

  const teams = await Team.find({ serviceHours: service._id });
  if (teams.length > 0) {
    return next(
      new AppError("Couldn't delete services already used in teams!", 400)
    );
  }

  await Service.findByIdAndDelete(req.params.id);

  res.status(200).json({
    status: 'success',
    message: 'Service deleted successfully!',
  });
});
