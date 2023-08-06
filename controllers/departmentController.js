const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const Department = require('./../models/departmentModel');

exports.getAllDepartments = catchAsync(async (req, res, next) => {
  const departments = await Department.find();

  res.status(200).json({
    status: 'success',
    results: departments.length,
    data: {
      departments,
    },
  });
});

exports.createDepartment = catchAsync(async (req, res, next) => {
  const newDepartment = await Department.create({
    ...req.body,
    user: req.user._id,
  });

  res.status(200).json({
    status: 'success',
    data: {
      department: newDepartment,
    },
  });
});

exports.getDepartment = catchAsync(async (req, res, next) => {
  const department = await Department.findById(req.params.id);

  if (!department) {
    return next(new AppError('No department found with that ID!'), 404);
  }

  res.status(200).json({
    status: 'success',
    data: {
      department,
    },
  });
});

exports.updateDepartment = catchAsync(async (req, res, next) => {
  const department = await Department.findByIdAndUpdate(
    req.params.id,
    {
      ...req.body,
      user: req.user._id,
    },
    { runValidators: true }
  );

  if (!department) {
    return next(new AppError('No department found with that ID!'), 404);
  }

  res.status(200).json({
    status: 'success',
    message: 'Department updated successfully!',
  });
});

exports.deleteDepartment = catchAsync(async (req, res, next) => {
  const department = await Department.findByIdAndDelete(req.params.id);

  if (!department) {
    return next(new AppError('No department found with that ID!'), 404);
  }

  res.status(200).json({
    status: 'success',
    message: 'Department deleted successfully!',
  });
});
