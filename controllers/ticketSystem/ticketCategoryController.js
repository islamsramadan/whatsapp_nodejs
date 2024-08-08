const AppError = require('../../utils/appError');
const catchAsync = require('../../utils/catchAsync');

const TicketCategory = require('../../models/ticketSystem/ticketCategoryModel');

const filterObj = (obj, ...allowedFields) => {
  const newObj = {};
  Object.keys(obj).forEach((el) => {
    if (allowedFields.includes(el)) newObj[el] = obj[el];
  });
  return newObj;
};

exports.getAllCategories = catchAsync(async (req, res, next) => {
  const filteredBody = {};

  if (req.query.status) {
    filteredBody.status = req.query.status;
  }
  const categories = await TicketCategory.find(filteredBody);

  res.status(200).json({
    status: 'success',
    results: categories.length,
    data: {
      categories,
    },
  });
});

exports.getCategory = catchAsync(async (req, res, next) => {
  const category = await TicketCategory.findOne(req.params.categoryID);
  if (!category) {
    return next(new AppError('No category found with that ID!', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      category,
    },
  });
});

exports.createCategory = catchAsync(async (req, res, next) => {
  const { name, description } = req.body;

  if (!name) {
    return next(new AppError('Category Name is required!', 400));
  }

  const newCategoryData = {
    name,
    description,
    creator: req.user._id,
  };

  const newCategory = await TicketCategory.create(newCategoryData);

  res.status(201).json({
    status: 'success',
    data: {
      category: newCategory,
    },
  });
});

exports.updateCategory = catchAsync(async (req, res, next) => {
  const category = await TicketCategory.findById(req.params.categoryID);

  if (!category) {
    return next(new AppError('No category found with that ID', 404));
  }

  // if (category.tickets && category.tickets.length > 0) {
  //   return next(new AppError("Couldn't update category with tickets!", 400));
  // }

  const updatedBody = filterObj(req.body, 'name', 'description');

  await TicketCategory.findByIdAndUpdate(req.params.categoryID, updatedBody, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    status: 'success',
    message: 'Category updated successfully!',
  });
});

exports.updateCategoryStatus = catchAsync(async (req, res, next) => {
  const category = await TicketCategory.findById(req.params.categoryID);

  if (!category) {
    return next(new AppError('No ticket category found with that ID!', 404));
  }

  if (!req.body.status) {
    return next(new AppError('No ticket status provided!', 400));
  }

  if (req.body.status === category.status) {
    return next(new AppError(`Category is already ${req.body.status}!`, 400));
  }

  await TicketCategory.findByIdAndUpdate(
    req.params.categoryID,
    { status: req.body.status },
    { runValidators: true, new: true }
  );

  res.status(200).json({
    status: 'success',
    message: 'Category updated Successfully!',
  });
});

// exports.deleteCategory = catchAsync(async (req, res, next) => {
//   const category = await TicketCategory.findById(req.params.categoryID);

//   if (!category) {
//     return next(new AppError('No category found with that ID', 404));
//   }

//   if (category.tickets && category.tickets.length > 0) {
//     return next(new AppError("Couldn't delete category with tickets!", 400));
//   }

//   await TicketCategory.findByIdAndDelete(req.params.categoryID);

//   res.status(200).json({
//     status: 'success',
//     message: 'Category deleted successfully!',
//   });
// });
