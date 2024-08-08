const mongoose = require('mongoose');
const multer = require('multer');

const AppError = require('../../utils/appError');
const catchAsync = require('../../utils/catchAsync');
const ticketUtilsHandler = require('../../utils/ticketsUtils');

const User = require('../../models/userModel');
const TicketCategory = require('../../models/ticketSystem/ticketCategoryModel');
const Ticket = require('../../models/ticketSystem/ticketModel');
const TicketStatus = require('../../models/ticketSystem/ticketStatusModel');
const Form = require('../../models/ticketSystem/formModel');
const Field = require('../../models/ticketSystem/fieldModel');

const multerStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    // console.log('file==============', file);

    cb(null, 'public');
  },
  filename: (req, file, cb) => {
    const ext =
      file.mimetype.split('/')[0] === 'image' ||
      file.mimetype.split('/')[0] === 'video' ||
      file.mimetype.split('/')[0] === 'audio'
        ? file.mimetype.split('/')[1]
        : file.originalname.split('.')[file.originalname.split('.').length - 1];

    cb(
      null,
      `ticket-${req.user.id}-${Date.now()}-${Math.floor(
        Math.random() * 1000
      )}.${ext}`
    );
  },
});

const multerFilter = (req, file, cb) => {
  // if (file.mimetype.startsWith('image')) {
  //   cb(null, true);
  // } else {
  //   cb(new AppError('Not an image! Please upload only images.', 400), false);
  // }
  cb(null, true);
};

const upload = multer({
  storage: multerStorage,
  fileFilter: multerFilter,
});

exports.uploadMultiFiles = upload.array('files');

exports.getAllTickets = catchAsync(async (req, res, next) => {
  const tickets = await Ticket.find()
    .populate('category', 'name')
    .populate('creator', 'firstName lastName photo')
    .populate('assignee', 'firstName lastName photo')
    .populate('team', 'name')
    .populate('status', 'name')
    .populate('form', 'name')
    .populate('questions.field', 'name');

  res.status(200).json({
    status: 'success',
    results: tickets.length,
    data: {
      tickets,
    },
  });
});

exports.getAllUserTickets = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.params.userID);
  if (!user) {
    return next(new AppError('No user found with that ID!', 404));
  }

  const tickets = await Ticket.find({
    $or: [{ creator: req.params.userID }, { assignee: req.params.userID }],
  })
    .populate('category', 'name')
    .populate('creator', 'firstName lastName photo')
    .populate('assignee', 'firstName lastName photo')
    .populate('team', 'name')
    .populate('status', 'name')
    .populate('form', 'name')
    .populate('questions.field', 'name');

  res.status(200).json({
    status: 'success',
    results: tickets.length,
    data: {
      tickets,
    },
  });
});

exports.getTicket = catchAsync(async (req, res, next) => {
  const ticket = await Ticket.findById(req.params.ticketID)
    .populate('category', 'name')
    .populate('creator', 'firstName lastName photo')
    .populate('assignee', 'firstName lastName photo')
    .populate('team', 'name')
    .populate('status', 'name')
    .populate('form', 'name')
    .populate('questions.field');

  if (!ticket) {
    return next(new AppError('No ticket found with that ID!', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      ticket,
    },
  });
});

exports.createTicket = catchAsync(async (req, res, next) => {
  const {
    category,
    team,
    assignee,
    client,
    priority,
    status,
    form,
    questions,
  } = req.body;

  if (
    !category ||
    !team ||
    !assignee ||
    !client ||
    (!client.email && !client.number) ||
    !priority ||
    !status ||
    !form ||
    !questions ||
    questions.length === 0
  ) {
    return next(new AppError('Ticket details are required!', 400));
  }

  const assignedUser = await User.findById(assignee);
  if (!assignedUser) {
    return next(new AppError('No assigned user found with that ID!', 400));
  }
  if (!assignedUser.tasks.includes('tickets')) {
    return next(
      new AppError(
        "Couldn't assign to a user with no permission to tickets",
        400
      )
    );
  }

  const newTicketData = {
    creator: req.user._id,
    category,
    assignee,
    team,
    client,
    priority,
    status,
    form,
    tags: [],
  };

  // ----------> Adding attachments
  if (req.files) {
    const attachments = req.files.map((item) => ({
      file: item.filename,
      filename: item.originalname,
    }));
    newTicketData.attachments = attachments;
  }

  // ----------> Adding questions
  const formDoc = await Form.findById(form);
  if (questions.length !== formDoc.fields.length) {
    return next(
      new AppError('Invalid questions depending on form fields!', 400)
    );
  }

  newTicketData.questions = questions;

  // ----------> Field validation and Adding Tags
  await Promise.all(
    questions.map(async (item) => {
      const field = await Field.findById(item.field);
      if (!field || field.status === 'inactive') {
        return next(new AppError('Invalid field!', 400));
      }

      if (field.required && (!item.answer || item.answer.length === 0)) {
        return next(new AppError('Answer is required!', 400));
      }

      // ----------> Adding tags
      if (field.tag && !newTicketData.tags.includes(item.answer[0])) {
        newTicketData.tags.push(item.answer[0]);
      }
    })
  );

  // ----------> Add ticket order
  const ticketsTotalNumber = await Ticket.count();
  newTicketData.order = ticketsTotalNumber + 1;

  // ===============================> Create ticket in transaction session

  const transactionSession = await mongoose.startSession();
  transactionSession.startTransaction();

  let newTicket;
  try {
    // =====================> Create Ticket
    const ticket = await Ticket.create([newTicketData], {
      session: transactionSession,
    });
    // console.log('ticket', ticket);

    // =====================> Add ticket to the creator tickets
    await User.findByIdAndUpdate(
      req.user._id,
      { $push: { tickets: ticket[0]._id } },
      { new: true, runValidators: true, session: transactionSession }
    );

    // =====================> Add ticket to the assigned user tickets
    await User.findByIdAndUpdate(
      assignee,
      { $push: { tickets: ticket[0]._id } },
      { new: true, runValidators: true, session: transactionSession }
    );

    // =====================> Add ticket to the category
    await TicketCategory.findByIdAndUpdate(
      category,
      { $push: { tickets: ticket[0]._id } },
      { new: true, runValidators: true, session: transactionSession }
    );

    newTicket = ticket[0];

    await transactionSession.commitTransaction(); // Commit the transaction
    transactionSession.endSession();
    console.log('New ticket created: ============', ticket[0]._id);
  } catch (error) {
    await transactionSession.abortTransaction();
    transactionSession.endSession();

    console.error(
      'Transaction aborted due to an error: ===========================',
      error
    );
  }

  if (newTicket) {
    // req.body.ticketID = newTicket._id;
    // req.body.link = 'Not found!';
    // await ticketUtilsHandler.notifyClientHandler(req, newTicket);

    res.status(201).json({
      status: 'success',
      data: {
        ticket: newTicket,
      },
    });
  } else {
    res.status(400).json({
      status: 'fail',
      message: "Couldn't create the ticket! Kindly try again.",
    });
  }
});

// exports.createTicket = catchAsync(async (req, res, next) => {
//   const { category, name, description, assignee, client } = req.body;

//   if (
//     !category ||
//     !name ||
//     !description ||
//     !assignee ||
//     !client ||
//     (!client.email && !client.number)
//   ) {
//     return next(new AppError('Ticket details are required!', 400));
//   }

//   const assignedUser = await User.findById(assignee);
//   if (!assignedUser) {
//     return next(new AppError('No assigned user found with that ID!', 400));
//   }
//   if (!assignedUser.tasks.includes('tickets')) {
//     return next(
//       new AppError(
//         "Couldn't assign to a user with no permission to tickets",
//         400
//       )
//     );
//   }

//   const newTicketData = {
//     creator: req.user._id,
//     category,
//     name,
//     description,
//     assignee,
//     client,
//     type: 'manual',
//     status: 'open',
//   };

//   const transactionSession = await mongoose.startSession();
//   transactionSession.startTransaction();

//   let newTicket;
//   try {
//     // =====================> Create Ticket
//     const ticket = await Ticket.create([newTicketData], {
//       session: transactionSession,
//     });
//     // console.log('ticket', ticket);

//     // =====================> Add ticket to the creator tickets
//     await User.findByIdAndUpdate(
//       req.user._id,
//       { $push: { tickets: ticket[0]._id } },
//       { new: true, runValidators: true, session: transactionSession }
//     );

//     // =====================> Add ticket to the assigned user tickets
//     await User.findByIdAndUpdate(
//       assignee,
//       { $push: { tickets: ticket[0]._id } },
//       { new: true, runValidators: true, session: transactionSession }
//     );

//     // =====================> Add ticket to the category
//     await TicketCategory.findByIdAndUpdate(
//       category,
//       { $push: { tickets: ticket[0]._id } },
//       { new: true, runValidators: true, session: transactionSession }
//     );

//     newTicket = ticket[0];

//     await transactionSession.commitTransaction(); // Commit the transaction
//     transactionSession.endSession();
//     console.log('New ticket created: ============', ticket[0]._id);
//   } catch (error) {
//     await transactionSession.abortTransaction();
//     transactionSession.endSession();

//     console.error(
//       'Transaction aborted due to an error: ===========================',
//       error
//     );
//   }

//   if (newTicket) {
//     req.body.ticketID = newTicket._id;
//     req.body.link = 'Not found!';
//     await ticketUtilsHandler.notifyClientHandler(req, newTicket);

//     res.status(201).json({
//       status: 'success',
//       data: {
//         ticket: newTicket,
//       },
//     });
//   } else {
//     res.status(400).json({
//       status: 'fail',
//       message: "Couldn't create the ticket!",
//     });
//   }
// });

exports.updateTicket = catchAsync(async (req, res, next) => {
  const ticket = await Ticket.findById(req.params.ticketID);

  if (!ticket) {
    return next(new AppError('No ticket found with  that ID!', 404));
  }

  if (!req.body.type) {
    return next(new AppError('Update type is required!', 400));
  }

  if (req.body.type === 'status') {
    if (!req.body.status) {
      return next(new AppError('No status found!', 400));
    }

    await Ticket.findByIdAndUpdate(
      req.params.ticketID,
      { status: req.body.status },
      { new: true, runValidators: true }
    );
  } else if (req.body.type === 'client') {
    if (
      !req.body.client ||
      (!req.body.client.number && !req.body.client.email)
    ) {
      return next(new AppError('Client data is required!', 400));
    }

    await Ticket.findByIdAndUpdate(
      req.params.ticketID,
      { client: req.body.client },
      { new: true, runValidators: true }
    );
  } else if (req.body.type === 'reassigned') {
    const previousUser = ticket.assignee;
    const reassignedUser = await User.findById(req.body.reassigned);

    if (!reassignedUser || reassignedUser.deleted === true) {
      return next(new AppError('Reassigned user not found!', 400));
    }

    if (!reassignedUser.tasks.includes('tickets')) {
      return next(
        new AppError("Reassigned user doesn't have this permission!", 400)
      );
    }

    // --------------> Update the ticket with the new assigned user
    await Ticket.findByIdAndUpdate(
      req.params.ticketID,
      { assignee: req.body.reassigned },
      { new: true, runValidators: true }
    );

    // --------------> Remove the ticket from the previous assigned user
    if (previousUser.tickets && previousUser.tickets.includes(ticket._id)) {
      await User.findByIdAndUpdate(
        previousUser._id,
        { $pull: { tickets: ticket._id } },
        { new: true, runValidators: true }
      );
    }

    // --------------> Add the ticket to the new assigned user
    if (
      !reassignedUser.tickets ||
      !reassignedUser.tickets.includes(ticket._id)
    ) {
      await User.findByIdAndUpdate(
        previousUser._id,
        { $push: { tickets: ticket._id } },
        { new: true, runValidators: true }
      );
    }
  } else {
    return next(new AppError('Update type is not recognized!', 400));
  }

  res.status(200).json({
    status: 'success',
    message: 'Ticket updated Successfully!',
  });
});
