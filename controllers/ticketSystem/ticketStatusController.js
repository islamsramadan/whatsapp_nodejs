const mongoose = require('mongoose');

const catchAsync = require('../../utils/catchAsync');

const TicketStatus = require('../../models/ticketSystem/ticketStatusModel');
const AppError = require('../../utils/appError');

const filterObj = (obj, ...allowedFields) => {
  const newObj = {};
  Object.keys(obj).forEach((el) => {
    if (allowedFields.includes(el)) newObj[el] = obj[el];
  });
  return newObj;
};

exports.getAllStatuses = catchAsync(async (req, res, next) => {
  const filteredBody = {};

  if (req.query.status) {
    filteredBody.status = req.query.status;
  }

  const statuses = await TicketStatus.find(filteredBody);

  res.status(200).json({
    status: 'success',
    results: statuses.length,
    data: {
      statuses,
    },
  });
});

exports.getStatus = catchAsync(async (req, res, next) => {
  const status = await TicketStatus.findById(req.params.statusID);

  if (!status) {
    return next(new AppError('No status found with taht ID!', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      status,
    },
  });
});

exports.createStatus = catchAsync(async (req, res, next) => {
  const { name, endUserDisplayName, description, category } = req.body;

  if (!name || !endUserDisplayName || !category) {
    return next(new AppError('Status details are required!', 400));
  }

  const newStatusData = {
    name,
    endUserDisplayName,
    description,
    category,
    creator: req.user._id,
  };

  const statusTotalNumber = await TicketStatus.count();
  const previousDefaultStatus = await TicketStatus.findOne({ default: true });

  if (statusTotalNumber === 0 || !previousDefaultStatus) {
    newStatusData.default = true;
  }

  if (req.body.default === true) {
    if (req.body.category === 'solved') {
      return next(
        new AppError(
          "Couldn't create defautl status with {{solved}} category!",
          400
        )
      );
    }

    newStatusData.default = true;
  }

  const transactionSession = await mongoose.startSession();
  transactionSession.startTransaction();

  let newStatus;
  try {
    // =====================> Remove default from previous default status
    if (req.body.default === true && previousDefaultStatus) {
      await TicketStatus.findByIdAndUpdate(
        previousDefaultStatus._id,
        { default: false },
        { new: true, runValidators: true, session: transactionSession }
      );
    }

    // =====================> Create Status
    const ticketStatus = await TicketStatus.create([newStatusData], {
      session: transactionSession,
    });
    // console.log('ticketStatus', ticketStatus);

    newStatus = ticketStatus[0];

    await transactionSession.commitTransaction(); // Commit the transaction

    // console.log('New status created: ============', ticketStatus[0]._id);
  } catch (err) {
    await transactionSession.abortTransaction(); // Abort the transaction
    console.error('Transaction aborted due to an error:', err);
  } finally {
    transactionSession.endSession();
  }

  if (newStatus) {
    res.status(201).json({
      status: 'success',
      data: {
        status: newStatus,
      },
    });
  } else {
    res.status(400).json({
      status: 'fail',
      message: "Couldn't create the status! Kindly try again.",
    });
  }
});

exports.updateStatus = catchAsync(async (req, res, next) => {
  const status = await TicketStatus.findById(req.params.statusID);

  if (!status) {
    return next(new AppError('No status found with that ID', 404));
  }

  const updatedData = filterObj(
    req.body,
    'name',
    'endUserDisplayName',
    'description',
    'category',
    'status'
  );
  updatedData.updater = req.user._id;

  if (
    req.body.status &&
    req.body.status === 'inactive' &&
    (status.default === true || req.body.default === true)
  ) {
    return next(new AppError("Couldn't deactivate default status!", 400));
  }

  // Updating default status
  const previousDefaultStatus = await TicketStatus.findOne({ default: true });
  if (req.body.default && !status.default) {
    if (req.body.status === 'inactive') {
      return next(
        new AppError("Couldn't make inactive status a default status!", 400)
      );
    }

    updatedData.default = true;
  }

  if ((req.body.default || status.default) && req.body.category === 'solved') {
    return next(
      new AppError(
        "Couldn't make default status with {{solved}} category!",
        400
      )
    );
  }

  const transactionSession = await mongoose.startSession();
  transactionSession.startTransaction();

  try {
    // =============> Remove default from previous default status
    if (updatedData.default && previousDefaultStatus) {
      await TicketStatus.findByIdAndUpdate(
        previousDefaultStatus._id,
        { default: false },
        { new: true, runValidators: true, session: transactionSession }
      );
    }

    // =============> Updating Status
    await TicketStatus.findByIdAndUpdate(req.params.statusID, updatedData, {
      new: true,
      runValidators: true,
      session: transactionSession,
    });

    await transactionSession.commitTransaction(); // Commit the transaction
  } catch (err) {
    await transactionSession.abortTransaction(); // Abort the transaction
    console.error('Transaction aborted due to an error:', err);
  } finally {
    transactionSession.endSession();
  }

  res.status(200).json({
    status: 'success',
    message: 'Status updated successfully!',
  });
});
