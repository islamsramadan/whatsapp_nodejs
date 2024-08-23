const mongoose = require('mongoose');

const AppError = require('../../utils/appError');
const catchAsync = require('../../utils/catchAsync');
const ticketUtilsHandler = require('../../utils/ticketsUtils');

const User = require('../../models/userModel');
const TicketCategory = require('../../models/ticketSystem/ticketCategoryModel');
const Ticket = require('../../models/ticketSystem/ticketModel');
const TicketStatus = require('../../models/ticketSystem/ticketStatusModel');
const Form = require('../../models/ticketSystem/formModel');
const Field = require('../../models/ticketSystem/fieldModel');
const Team = require('../../models/teamModel');

const filterObj = (obj, ...allowedFields) => {
  const newObj = {};
  Object.keys(obj).forEach((el) => {
    if (allowedFields.includes(el)) newObj[el] = obj[el];
  });
  return newObj;
};

exports.getAllTickets = catchAsync(async (req, res, next) => {
  const filteredBody = {};

  if (req.query.order) {
    filteredBody.order = req.query.order;
  }

  if (req.query.category) {
    filteredBody.category = req.query.category;
  }

  if (req.query.status) {
    filteredBody.status = req.query.status;
  }

  if (req.query.priority) {
    filteredBody.priority = req.query.priority;
  }

  if (req.query.startDate) {
    filteredBody.createdAt = { $gt: new Date(req.query.startDate) };
  }
  if (req.query.endDate) {
    const endDate = new Date(req.query.endDate);
    endDate.setDate(endDate.getDate() + 1);

    filteredBody.createdAt = {
      ...filteredBody.createdAt,
      $lt: endDate,
    };
  }

  if (req.query.assignee) {
    filteredBody.assignee = req.query.assignee;
  }

  const page = req.query.page || 1;

  const tickets = await Ticket.find(filteredBody)
    .populate('category', 'name')
    .populate('creator', 'firstName lastName photo')
    .populate('assignee', 'firstName lastName photo')
    .populate('team', 'name')
    .populate('status', 'name')
    // .populate('form', 'name')
    // .populate('questions.field', 'name')
    .skip((page - 1) * 20)
    .limit(20);

  const totalResults = await Ticket.count(filteredBody);
  const totalPages = Math.ceil(totalResults / 20);

  res.status(200).json({
    status: 'success',
    results: tickets.length,
    data: {
      totalResults,
      totalPages,
      page,
      tickets,
    },
  });
});

exports.getAllUserTickets = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.params.userID);
  if (!user) {
    return next(new AppError('No user found with that ID!', 404));
  }

  const filteredBody = {
    $or: [{ creator: req.params.userID }, { assignee: req.params.userID }],
  };

  if (req.query.order) {
    filteredBody.order = req.query.order;
  }

  if (req.query.category) {
    filteredBody.category = req.query.category;
  }

  if (req.query.status) {
    filteredBody.status = req.query.status;
  }

  if (req.query.priority) {
    filteredBody.priority = req.query.priority;
  }

  if (req.query.startDate) {
    filteredBody.createdAt = { $gt: new Date(req.query.startDate) };
  }
  if (req.query.endDate) {
    const endDate = new Date(req.query.endDate);
    endDate.setDate(endDate.getDate() + 1);

    filteredBody.createdAt = {
      ...filteredBody.createdAt,
      $lt: endDate,
    };
  }

  const page = req.query.page || 1;

  const tickets = await Ticket.find(filteredBody)
    .populate('category', 'name')
    .populate('creator', 'firstName lastName photo')
    .populate('assignee', 'firstName lastName photo')
    .populate('team', 'name')
    .populate('status', 'name')
    // .populate('form', 'name')
    // .populate('questions.field', 'name')
    .skip((page - 1) * 20)
    .limit(20);

  const totalResults = await Ticket.count(filteredBody);
  const totalPages = Math.ceil(totalResults / 20);

  res.status(200).json({
    status: 'success',
    results: tickets.length,
    data: {
      totalResults,
      totalPages,
      page,
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
  let {
    category,
    team,
    assignee,
    client,
    priority,
    status,
    refNo,
    requestNature,
    requestType,
    complaintReport,
    form,
    questions,
  } = req.body;

  if (
    !category ||
    !team ||
    !client ||
    (!client.email && !client.number) ||
    !priority ||
    !refNo ||
    !requestNature ||
    !requestType ||
    !form ||
    !questions ||
    questions.length === 0
  ) {
    return next(new AppError('Ticket details are required!', 400));
  }

  // =======> Checking and selecting the assignee
  if (assignee) {
    const assignedUser = await User.findById(assignee);

    if (!assignedUser) {
      return next(new AppError('No assigned user found with that ID!', 400));
    }

    if (!assignedUser.team.equals(team)) {
      return next(new AppError('Assignee must belong to the team!', 400));
    }

    if (!assignedUser.tasks.includes('tickets')) {
      return next(
        new AppError(
          "Couldn't assign to a user with no permission to tickets",
          400
        )
      );
    }
  } else {
    // --------> Selecting the assignee
    const teamDoc = await Team.findById(team);

    let teamUsers = [];
    for (let i = 0; i < teamDoc.users.length; i++) {
      let teamUser = await User.findOne({
        _id: teamDoc.users[i],
        deleted: false,
      });

      if (teamUser.tasks.includes('tickets')) {
        teamUsers = [...teamUsers, teamUser];
      }
    }

    if (teamUsers.length === 0) {
      return next(
        new AppError(
          "This team doesn't have any user to deal with tickets!",
          400
        )
      );
    }

    // status sorting order
    const statusSortingOrder = ['Online', 'Service hours', 'Offline', 'Away'];

    // teamUsers = teamUsers.sort((a, b) => a.chats.length - b.chats.length);
    teamUsers = teamUsers.sort((a, b) => {
      const orderA = statusSortingOrder.indexOf(a.status);
      const orderB = statusSortingOrder.indexOf(b.status);

      // If 'status' is the same, then sort by chats length
      if (orderA === orderB) {
        return a.tickets.length - b.tickets.length;
      }

      // Otherwise, sort by 'status'
      return orderA - orderB;
    });

    // console.log('teamUsers=============', teamUsers);
    assignee = teamUsers[0];
  }

  const newTicketData = {
    creator: req.user._id,
    category,
    assignee,
    team,
    users: [],
    client,
    priority,
    status,
    refNo,
    requestNature,
    requestType,
    form,
    tags: [],
  };

  // ----------> Adding complaint report ability
  if (newTicketData.requestNature === 'Complaint') {
    newTicketData.complaintReport = complaintReport;
  }

  // ----------> Adding status
  if (status) {
    const statusDoc = await TicketStatus.findById(status);
    if (!statusDoc || statusDoc.status === 'inactive') {
      return next(new AppError('Invalid Status!', 400));
    }
    newTicketData.status = status;
  } else {
    const statusDoc = await TicketStatus.findOne({ default: true });
    newTicketData.status = statusDoc._id;
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

  // ----------> Add ticket users array
  newTicketData.users.push(req.user._id);
  if (!req.user._id.equals(assignee)) {
    newTicketData.users.push(assignee);
  }

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
    // await User.findByIdAndUpdate(
    //   req.user._id,
    //   { $push: { tickets: ticket[0]._id } },
    //   { new: true, runValidators: true, session: transactionSession }
    // );

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

    console.log('New ticket created: ============', ticket[0]._id);
  } catch (error) {
    await transactionSession.abortTransaction();

    console.error(
      'Transaction aborted due to an error: ===========================',
      error
    );
  } finally {
    transactionSession.endSession();
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

exports.updateTicketInfo = catchAsync(async (req, res, next) => {
  const ticket = await Ticket.findById(req.params.ticketID);
  if (!ticket) {
    return next(new AppError('No ticket found with that ID!', 404));
  }

  // -----> Status validation
  if (req.body.status) {
    const status = await TicketStatus.findById(req.body.status);
    if (!status || status.status === 'inactive') {
      return next(new AppError('Invalid status!', 400));
    }
  }
  // -----> Category validation
  if (req.body.category && !ticket.category.equals(req.body.category)) {
    const category = await TicketCategory.findById(req.body.category);
    if (!category || category.status === 'inactive') {
      return next(new AppError('Invalid category!', 400));
    }
  }

  const filteredBody = filterObj(req.body, 'priority', 'status', 'category');

  await Ticket.findByIdAndUpdate(req.params.ticketID, filteredBody, {
    runValidators: true,
    new: true,
  });

  res.status(200).json({
    status: 'success',
    message: 'Ticket updated successfully!',
  });
});

exports.reassignTicket = catchAsync(async (req, res, next) => {
  const ticket = await Ticket.findById(req.params.ticketID);
  if (!ticket) {
    return next(new AppError('No ticket found with that ID!', 404));
  }

  let { assignee, team } = req.body;

  if (!team) {
    return next(new AppError('No team provided', 400));
  }

  const updatedBody = {};

  if (assignee) {
    if (ticket.assignee.equals(assignee) && ticket.team.equals(team)) {
      return next(
        new AppError('Ticket is already assigned to the same user!', 400)
      );
    }

    const assignedUser = await User.findById(assignee);
    if (!assignedUser) {
      return next(new AppError('No user found with that ID!', 404));
    }

    if (!assignedUser.team.equals(team)) {
      return next(new AppError('Assignee must belong to the team!', 400));
    }

    if (!assignedUser.tasks.includes('tickets')) {
      return next(
        new AppError(
          "Couldn't assign ticket to a user with no tickets task!",
          400
        )
      );
    }

    updatedBody.assignee = assignee;
    updatedBody.team = team;
  } else {
    if (ticket.team.equals(team)) {
      return next(
        new AppError('Ticket is already assigned to that team!', 400)
      );
    }

    // --------> Selecting the assignee
    const teamDoc = await Team.findById(team);

    let teamUsers = [];
    for (let i = 0; i < teamDoc.users.length; i++) {
      let teamUser = await User.findOne({
        _id: teamDoc.users[i],
        deleted: false,
      });

      if (teamUser.tasks.includes('tickets')) {
        teamUsers = [...teamUsers, teamUser];
      }
    }

    if (teamUsers.length === 0) {
      return next(
        new AppError(
          "This team doesn't have any user to deal with tickets!",
          400
        )
      );
    }

    // status sorting order
    const statusSortingOrder = ['Online', 'Service hours', 'Offline', 'Away'];

    // teamUsers = teamUsers.sort((a, b) => a.chats.length - b.chats.length);
    teamUsers = teamUsers.sort((a, b) => {
      const orderA = statusSortingOrder.indexOf(a.status);
      const orderB = statusSortingOrder.indexOf(b.status);

      // If 'status' is the same, then sort by chats length
      if (orderA === orderB) {
        return a.tickets.length - b.tickets.length;
      }

      // Otherwise, sort by 'status'
      return orderA - orderB;
    });

    // console.log('teamUsers=============', teamUsers);
    assignee = teamUsers[0];

    updatedBody.assignee = assignee;
    updatedBody.team = team;
  }

  if (!ticket.users.includes(assignee)) {
    updatedBody[$push] = { users: assignee };
  }

  const previousAssignee = await User.findById(ticket.assignee);

  const transactionSession = await mongoose.startSession();
  transactionSession.startTransaction();
  try {
    await Ticket.findByIdAndUpdate(req.params.ticketID, updatedBody, {
      runValidators: true,
      new: true,
      session: transactionSession,
    });

    // ======> Remove ticket from the previous assignee tickets array
    await User.findByIdAndUpdate(
      previousAssignee._id,
      { $pull: { tickets: ticket[0]._id } },
      { new: true, runValidators: true, session: transactionSession }
    );

    // ======> Add ticket to the new assignee tickets array
    await User.findByIdAndUpdate(
      assignee,
      { $push: { tickets: ticket[0]._id } },
      { new: true, runValidators: true, session: transactionSession }
    );

    await transactionSession.commitTransaction();
  } catch (err) {
    await transactionSession.abortTransaction();

    console.error(
      'Transaction aborted due to an error: ===========================',
      err
    );
  } finally {
    transactionSession.endSession();
  }

  res.status(200).json({
    status: 'success',
    messgae: 'Ticket has been reassigned successully!',
  });
});

exports.updateTicketForm = catchAsync(async (req, res, next) => {
  const ticket = await Ticket.findById(req.params.ticketID);
  if (!ticket) {
    return next(new AppError('No ticket found with that ID!', 404));
  }

  const { questions } = req.body;

  if (questions.length !== ticket.questions.length) {
    return next(
      new AppError('Invalid questions depending on form fields!', 400)
    );
  }

  const tags = [];

  // ----------> Field validation and Adding Tags
  await Promise.all(
    questions.map(async (item) => {
      const field = await Field.findById(item.field);
      if (!field) {
        return next(new AppError('Invalid field!', 400));
      }

      if (field.required && (!item.answer || item.answer.length === 0)) {
        return next(new AppError('Answer is required!', 400));
      }

      // ----------> Adding tags
      if (field.tag && !tags.includes(item.answer[0])) {
        tags.push(item.answer[0]);
      }
    })
  );

  // ----------> Updating ticket doc
  await Ticket.findByIdAndUpdate(
    req.params.ticketID,
    { questions, tags },
    { new: true, runValidators: true }
  );

  res.status(200).json({
    status: 'success',
    message: 'Ticket form updated successfully!',
  });
});

exports.updateTicketClientData = catchAsync(async (req, res, next) => {
  const ticket = await Ticket.findById(req.parmas.ticketID);
  if (!ticket) {
    return next(new AppError('No ticket found with that ID!', 404));
  }

  const { client } = req.body;
  if (!client || (!client.email && !client.number)) {
    return next(new AppError('Client data is required!', 400));
  }

  await Ticket.findByIdAndUpdate(
    req.params.ticketID,
    { client },
    { runValidators: true, new: true }
  );

  res.status(200).json({
    status: 'success',
    message: 'Client data updated successully!',
  });
});
