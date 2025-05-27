const FieldType = require('../../models/ticketSystem/fieldTypeModel');
const catchAsync = require('../../utils/catchAsync');

exports.getAllFieldTypes = catchAsync(async (req, res, next) => {
  const types = await FieldType.find();

  res.status(200).json({
    status: 'success',
    results: types.length,
    data: {
      types,
    },
  });
});

exports.createFieldType = catchAsync(async (req, res, next) => {
  const newTypeData = {
    name: req.body.name,
    value: req.body.value,
    description: req.body.description,
    creator: req.user._id,
  };

  const newType = await FieldType.create(newTypeData);

  res.status(201).json({
    status: 'success',
    data: {
      type: newType,
    },
  });
});

exports.createMultiFieldTypes = catchAsync(async (req, res, next) => {
  const { types } = req.body;
  if (!types || types.length === 0) {
    return next(new AppError('Field types are required!', 400));
  }

  const fieldTypes = await Promise.all(
    types.map(async (item) => {
      if (!item.name || !item.value) {
        return null;
      }

      const newTypeData = {
        name: item.name,
        value: item.value,
        description: item.description,
        creator: req.user._id,
      };

      const newType = await FieldType.create(newTypeData);

      return newType;
    })
  );

  res.status(201).json({
    status: 'success',
    data: {
      fieldTypes,
    },
  });
});
