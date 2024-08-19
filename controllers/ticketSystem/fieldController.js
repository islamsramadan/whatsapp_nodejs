const AppError = require('../../utils/appError');
const catchAsync = require('../../utils/catchAsync');

const Field = require('../../models/ticketSystem/fieldModel');
const FieldType = require('../../models/ticketSystem/fieldTypeModel');

const filterObj = (obj, ...allowedFields) => {
  const newObj = {};
  Object.keys(obj).forEach((el) => {
    if (allowedFields.includes(el)) newObj[el] = obj[el];
  });
  return newObj;
};

exports.getAllFields = catchAsync(async (req, res, next) => {
  const filteredBody = {};

  if (req.query.status) {
    filteredBody.status = req.query.status;
  }

  const fields = await Field.find(filteredBody).populate('type', 'name');

  res.status(200).json({
    status: 'success',
    results: fields.length,
    data: {
      fields,
    },
  });
});

exports.getField = catchAsync(async (req, res, next) => {
  const field = await Field.findById(req.params.fieldID).populate('type');

  if (!field) {
    return next(new AppError('No field found with that ID!', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      field,
    },
  });
});

exports.createField = catchAsync(async (req, res, next) => {
  const {
    type,
    name,
    description,
    required,
    solveRequired,
    tag,
    endUserView,
    values,
    defaultValue,
    endUserPermission,
  } = req.body;

  if (!type || !name || !endUserView) {
    return next(new AppError('Field data are required!', 400));
  }

  // =============> Field type validation
  const fieldType = await FieldType.findById(type);
  if (!fieldType) {
    return next(new AppError('No field type found with that ID', 400));
  }

  if (
    values &&
    values.length > 0 &&
    defaultValue &&
    !values.includes(defaultValue)
  ) {
    return next(new AppError('Values must contain default value!', 400));
  }

  const newFieldData = {
    creator: req.user._id,
    type,
    name,
    description,
    required,
    solveRequired,
    endUserView,
    values,
    defaultValue,
    endUserPermission,
  };

  // =============> Adding tag in case of dropdown field
  if (fieldType.value === 'dropdown') {
    newFieldData.tag = tag;
  }

  const newField = await Field.create(newFieldData);

  res.status(201).json({
    status: 'success',
    data: {
      field: newField,
    },
  });
});

exports.updateField = catchAsync(async (req, res, next) => {
  console.log('req.body', req.body);
  const field = await Field.findById(req.params.fieldID);

  if (!field) {
    return next(new AppError('No field found with that ID!', 400));
  }

  if (req.body.status === 'inactive' && field.forms && field.forms.length > 0) {
    return next(
      new AppError("Couldn't deactivate field used in active forms!", 400)
    );
  }

  if (req.body.type) {
    return next(new AppError("Couldn't update field type!", 400));
  }

  const updatedData = filterObj(
    req.body,
    'status',
    'name',
    'description',
    'required',
    'solveRequired',
    'tag',
    'endUserView',
    'endUserPermission',
    'values',
    'defaultValue'
  );
  updatedData.updater = req.user._id;

  if (
    updatedData.vlaues &&
    updatedData.values > 0 &&
    updatedData.defaultValue &&
    !updatedData.values.includes(updatedData.defaultValue)
  ) {
    return next(new AppError('Invalid default value!', 400));
  }

  await Field.findByIdAndUpdate(req.params.fieldID, updatedData, {
    runValidators: true,
    new: true,
  });

  res.status(200).json({
    status: 'success',
    message: 'Field updated successfully!',
  });
});

// exports.deleteField = catchAsync(async (req, res, next) => {
//   const field = await Field.findById(req.params.fieldID);

//   if (!field) {
//     return next(new AppError('No field found with that ID!', 404));
//   }

//   if (field.forms && field.forms.length > 0) {
//     return next(
//       new AppError("Couldn't delete field used in active forms!", 400)
//     );
//   }

//   // await Field.findByIdAndDelete(req.params.fieldID);
//   await Field.findByIdAndUpdate(
//     req.params.fieldID,
//     { status: 'inactive' },
//     { runValidators: true, new: true }
//   );

//   res.status(200).json({
//     status: 'success',
//     message: 'Field deleted successfully!',
//   });
// });
