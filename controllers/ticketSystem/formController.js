const mongoose = require('mongoose');

const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/appError');

const Form = require('../../models/ticketSystem/formModel');
const Field = require('../../models/ticketSystem/fieldModel');

const filterObj = (obj, ...allowedFields) => {
  const newObj = {};
  Object.keys(obj).forEach((el) => {
    if (allowedFields.includes(el)) newObj[el] = obj[el];
  });
  return newObj;
};

exports.getAllForms = catchAsync(async (req, res, next) => {
  const filterBody = {};

  if (req.query.status) {
    filterBody.status === req.query.status; //active or inactive
  }

  const forms = await Form.find(filterBody)
    .sort('order')
    .select('name order default status');

  res.status(200).json({
    status: 'success',
    results: forms.length,
    data: {
      forms,
    },
  });
});

exports.getForm = catchAsync(async (req, res, next) => {
  const form = await Form.findById(req.params.formID).populate({
    path: 'fields.field',
    select: '-forms -createdAt -updatedAt',
    populate: {
      path: 'type',
      select: 'name value',
    },
  });

  if (!form) {
    return next(new AppError('No form found with that ID!', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      form,
    },
  });
});

exports.createForm = catchAsync(async (req, res, next) => {
  const { name, description, fields } = req.body;

  if (!name || !fields || fields.length === 0) {
    return next(new AppError('Form data are required!', 400));
  }

  // checking if the fields items are unique
  const fieldsSet = new Set(fields);
  if (fieldsSet.size !== fields.length) {
    return next(new AppError('Form must contain unique fields!', 400));
  }

  // checking if field is active and return field with order
  const fieldsArray = await Promise.all(
    fields.map(async (item, i) => {
      const field = await Field.findById(item);

      if (field.status === 'active') {
        return { field: item, order: i + 1 };
      }
    })
  );

  const newFormData = {
    creator: req.user._id,
    name,
    description,
    fields: fieldsArray,
  };

  // get the form order
  const formstotalNumber = await Form.count();
  newFormData.order = formstotalNumber + 1;

  // make default if the first form or no default found
  const previousDefaultForm = await Form.findOne({ default: true });

  if (formstotalNumber === 0 || !previousDefaultForm) {
    newFormData.default = true;
  }

  if (req.body.default === true) {
    newFormData.default = true;

    await Form.findByIdAndUpdate(
      previousDefaultForm._id,
      { default: false },
      { new: true, runValidators: true }
    );
  }

  const newForm = await Form.create(newFormData);

  // add form id to all fields used in it
  await Field.updateMany(
    { _id: { $in: req.body.fields } },
    { $push: { forms: newForm._id } },
    { runValidators: true, new: true }
  );

  res.status(201).json({
    status: 'success',
    data: {
      form: newForm,
    },
  });
});

exports.updateForm = catchAsync(async (req, res, next) => {
  const form = await Form.findById(req.params.formID);
  const previousFields = form.fields;

  if (!form) {
    return next(new AppError('No form found with that ID!', 404));
  }

  const updatedData = filterObj(
    req.body,
    'name',
    'description',
    'fields',
    'status'
  );
  updatedData.updater = req.user._id;

  // Validate inactive with default forms
  if (
    req.body.status &&
    req.body.status === 'inactive' &&
    (form.default === true || req.body.default === true)
  ) {
    return next(new AppError("Couldn't deactivate default form!", 400));
  }

  if (req.body.fields && req.body.fields.length === 0) {
    return next(new AppError('Form fields are required!', 400));
  }

  // checking if field is active
  if (req.body.fields) {
    await Promise.all(
      req.body.fields.map(async (item) => {
        const field = await Field.findById(item.field);

        if (field.status === 'inactive') {
          return next(new AppError('Inactive field has been added!', 400));
        }
      })
    );
  }

  // Updating default forms
  const previousDefaultForm = await Form.findOne({ default: true });
  if (req.body.default && !form.default) {
    if (form.status === 'inactive') {
      return next(
        new AppError("Couldn't make inactive form a default form!", 400)
      );
    }

    updatedData.default = true;
  }

  const transactionSession = await mongoose.startSession();
  transactionSession.startTransaction();

  try {
    // =============> Remove default from previous default form
    if (updatedData.default && previousDefaultForm) {
      await Form.findByIdAndUpdate(
        previousDefaultForm._id,
        { default: false },
        { new: true, runValidators: true, session: transactionSession }
      );
    }

    // =============> Updating form
    await Form.findByIdAndUpdate(req.params.formID, updatedData, {
      new: true,
      runValidators: true,
      session: transactionSession,
    });

    // =============> Updating Fields Forms Array
    if (req.body.fields) {
      const fieldsArray = req.body.fields.map((item) => item.field);
      const previousFieldsArray = previousFields.map((item) => item.field);

      // Remove form from field forms array
      await Promise.all(
        previousFieldsArray.map(async (item) => {
          if (!fieldsArray.includes(item)) {
            await Field.findByIdAndUpdate(
              item,
              { $pull: { forms: form._id } },
              { runValidators: true, new: true, session: transactionSession }
            );
          }
        })
      );

      // Add form to field forms array
      await Promise.all(
        fieldsArray.map(async (item) => {
          if (!previousFieldsArray.includes(item)) {
            await Field.findByIdAndUpdate(
              item,
              { $push: { forms: form._id } },
              { runValidators: true, new: true, session: transactionSession }
            );
          }
        })
      );
    }

    await transactionSession.commitTransaction(); // Commit the transaction
  } catch (err) {
    await transactionSession.abortTransaction(); // Abort the transaction
    console.error('Transaction aborted due to an error:', err);
  } finally {
    transactionSession.endSession();
  }

  res.status(200).json({
    status: 'success',
    message: 'Form updated successfully!',
  });
});

// exports.updateDefaultForm = catchAsync(async (req, res, next) => {
//   const form = await Form.findById(req.params.formID);

//   if (!form) {
//     return next(new AppError('No form found with that ID!', 404));
//   }

//   if (form.default) {
//     return next(new AppError('This is the default form!', 400));
//   }

//   if (form.status === 'inactive') {
//     return next(new AppError("Couldn't update inactive forms to default!"));
//   }

//   const previousDefault = await Form.findOne({ default: true });

//   const updatedForm = await Form.findByIdAndUpdate(
//     req.params.formID,
//     { default: true, updater: req.user._id },
//     { runValidators: true, new: true }
//   );

//   //remove previous default
//   if (previousDefault) {
//     await Form.findByIdAndUpdate(
//       previousDefault._id,
//       { default: false },
//       { runValidators: true, new: true }
//     );
//   }

//   //Sending all forms
//   const forms = await Form.find()
//     .sort('order')
//     .select('name order default status');

//   res.status(200).json({
//     status: 'success',
//     data: {
//       form: updatedForm,
//       forms,
//     },
//   });
// });

exports.updateFormsOrder = catchAsync(async (req, res, next) => {
  // req.body.forms =[{form:"formID",order:1}, {}, ...]

  const formsIDs = await Form.find().select('_id');
  if (
    !req.body.forms ||
    req.body.forms.length === 0 ||
    req.body.forms.length !== formsIDs.length
  ) {
    return next(new AppError('Invalid Forms!', 400));
  }

  const formsIDsArray = req.body.forms.map((item) => item.form);
  const formsIDsSet = new Set(formsIDsArray);
  if (formsIDsSet.size !== formsIDsArray.length) {
    return next(new AppError('Forms with unique IDs are required!', 400));
  }

  const formsOrdersArray = req.body.forms.map((item) => item.order);
  const formsOrdersSet = new Set(formsOrdersArray);
  if (formsOrdersSet.size !== formsOrdersArray.length) {
    return next(new AppError('forms with unique orders are required!', 400));
  }

  const operations = req.body.forms.map((item) => ({
    updateOne: {
      filter: { _id: item.form },
      update: { $set: { order: item.order } },
    },
  }));

  await Form.bulkWrite(operations)
    .then((result) => {
      //   console.log('Bulk write operation successful:', result);
    })
    .catch((err) => {
      //   console.error('Error performing bulk write operation:', err);
      return next(new AppError('Invalid updates!', 400));
    });

  // for response
  //   const orderedForms = await Form.find().select('_id order');
  const orderedForms = await Form.find()
    .sort('order')
    .select('name order default status');

  res.status(200).json({
    status: 'success',
    forms: orderedForms,
  });
});

// exports.updateFormStatus = catchAsync(async (req, res, next) => {
//   const form = await Form.findById(req.params.formID);
//   if (!form) {
//     return next(new AppError('No form found with that ID!', 404));
//   }

//   if (!req.body.status) {
//     return next(new AppError('Form status is required!', 400));
//   }

//   if (form.default === true && req.body.status === 'inactive') {
//     return next(new AppError("Couldn't deactivate default form!"));
//   }

//   if (form.status === req.body.status) {
//     return next(new AppError(`Form is already ${form.status}!`, 400));
//   }

//   await Form.findByIdAndUpdate(
//     req.params.formID,
//     { status: req.body.status },
//     { runValidators: true, new: true }
//   );

//   res.status(200).json({
//     status: 'success',
//     message: 'Form updated successfully!',
//   });
// });

// exports.deleteForm = catchAsync(async (req, res, next) => {
//   const form = await Form.findById(req.params.formID);

//   if (!form) {
//     return next(new AppError('No form found with that ID', 404));
//   }

//   if (form.default === true) {
//     return next(new AppError("Couldn't delete default form!", 400));
//   }

//   await Form.findByIdAndDelete(req.params.formID);

//   // update other forms order
//   await Form.updateMany(
//     { order: { $gt: form.order } },
//     { $inc: { order: -1 } }
//   );

//   res.status(200).json({
//     status: 'success',
//     message: 'Form deleted successfully!',
//   });
// });
