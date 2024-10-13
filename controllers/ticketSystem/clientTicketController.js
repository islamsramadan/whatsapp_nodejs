const multer = require('multer');

const AppError = require('../../utils/appError');
const catchAsync = require('../../utils/catchAsync');

const Comment = require('../../models/ticketSystem/commentModel');
const TicketLog = require('../../models/ticketSystem/ticketLogModel');
const Ticket = require('../../models/ticketSystem/ticketModel');
const Field = require('../../models/ticketSystem/fieldModel');
const Notification = require('../../models/notificationModel');

const getPopulatedTicket = async (filterObj) => {
  return await Ticket.findOne(filterObj)
    .populate('category', 'name')
    .populate('creator', 'firstName lastName photo')
    .populate('assignee', 'firstName lastName photo')
    .populate('team', 'name')
    .populate('status', 'endUserDisplayName category')
    .populate('form', 'name')
    .populate({
      path: 'questions.field',
      select: '-updatedAt -createdAt -forms -creator',
      populate: { path: 'type', select: 'name value description' },
    });
};

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
      `client-${req.ticket._id}-${Date.now()}-${Math.floor(
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

exports.protectClientTicket = catchAsync(async (req, res, next) => {
  // 1) Getting token and check if it is there
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(
      new AppError(
        'You are not authenticated! Kindly get the correct link for your ticket.',
        401
      )
    );
  }

  const ticket = await Ticket.findOne({ clientToken: token }).populate(
    'status',
    'category'
  );

  if (!ticket) {
    return next(
      new AppError(
        'No ticket found! Kindly get the correct link for your ticket.',
        404
      )
    );
  }

  // GRANT ACCESS TO PROTECTED ROUTE
  req.ticket = ticket;
  next();
});

exports.getClientTicket = catchAsync(async (req, res, next) => {
  const ticketID = req.ticket._id;

  const ticket = await getPopulatedTicket({ _id: ticketID });

  const ticketLogs = await TicketLog.find({ ticket: ticketID })
    .populate('ticket', 'order')
    .populate('user', 'firstName lastName photo')
    .populate('assignee', 'firstName lastName photo')
    .populate('transfer.from.user', 'firstName lastName photo')
    .populate('transfer.to.user', 'firstName lastName photo')
    .populate('transfer.from.team', 'name')
    .populate('transfer.to.team', 'name')
    .populate('status', 'endUserDisplayName category');

  const ticketComments = await Comment.find({
    ticket: ticketID,
  }).populate('user', 'firstName lastName photo');

  res.status(200).json({
    status: 'success',
    data: {
      ticket,
      ticketLogs,
      ticketComments,
    },
  });
});

exports.sendFeedback = catchAsync(async (req, res, next) => {
  const { rating, feedback } = req.body;

  if (!rating) {
    return next(new AppError('Client rating is required', 400));
  }

  const updatedBody = { rating };

  if (feedback) updatedBody.feedback = feedback;

  const updatedTicket = await Ticket.findByIdAndUpdate(
    req.ticket._id,
    updatedBody,
    { new: true, runValidators: true }
  );

  //--------------------> updating ticket event in socket io
  req.app.io.emit('updatingTickets');

  res.status(200).json({
    status: 'success',
    data: {
      ticket: updatedTicket,
    },
  });
});

exports.createComment = catchAsync(async (req, res, next) => {
  if (req.ticket.status.category === 'solved') {
    return next(new AppError("Couldn't update solved ticket!", 400));
  }

  const previousComments = await Comment.find({ ticket: req.ticket._id });

  if (previousComments.length === 0) {
    return next(new AppError("Couldn't add comments!", 400));
  }

  if (!req.body.text && (!req.files || req.files.length === 0)) {
    return next(new AppError('Comment body is required!', 400));
  }

  const newCommentData = {
    ticket: req.ticket._id,
    type: 'user',
  };

  if (req.body.text) {
    newCommentData.text = req.body.text;
  }

  if (req.files) {
    const attachments = req.files.map((item) => ({
      file: item.filename,
      filename: item.originalname,
    }));
    newCommentData.attachments = attachments;
  }

  const notificationUsersIDs = new Set();

  const newComment = await Comment.create(newCommentData);

  // =====================> Comment Ticket Log
  await TicketLog.create({
    ticket: req.ticket._id,
    log: 'clientComment',
  });

  // =====================> New Comment Notification
  const newNotificationData = {
    type: 'tickets',
    ticket: req.ticket._id,
    event: 'newComment',
    message: `New comment on ticket no. ${req.ticket.order} from client`,
  };

  const assigneeNotification = await Notification.create({
    ...newNotificationData,
    user: req.ticket.assignee,
  });
  console.log('assigneeNotification', assigneeNotification);

  notificationUsersIDs.add(req.ticket.assignee);

  if (!req.ticket.creator.equals(req.ticket.assignee)) {
    const creatorNotification = await Notification.create({
      ...newNotificationData,
      user: req.ticket.creator,
    });

    console.log('creatorNotification', creatorNotification);

    notificationUsersIDs.add(req.ticket.creator);
  }

  //--------------------> updating ticket event in socket io
  req.app.io.emit('updatingTickets');

  //--------------------> updating notifications event in socket io
  Array.from(notificationUsersIDs).map((userID) => {
    if (req.app.connectedUsers[userID]) {
      req.app.connectedUsers[userID].emit('updatingNotifications');
    }
  });

  res.status(201).json({
    status: 'success',
    data: {
      comment: newComment,
    },
  });
});

exports.updateTicketForm = catchAsync(async (req, res, next) => {
  if (req.ticket.status.category === 'solved') {
    return next(new AppError("Couldn't update solved ticket!", 400));
  }

  const { questions } = req.body;

  const updatedQuestions = await Promise.all(
    req.ticket.questions.map(async (item) => {
      // console.log('item', item);
      const field = await Field.findById(item.field);

      if (field.endUserPermission === 'edit') {
        const selectedQuestion = questions.filter((question) =>
          item.field.equals(question.field)
        )[0];

        // console.log('selectedQuestion ----------------', selectedQuestion);
        if (selectedQuestion) {
          // ------> field required answer
          if (
            field.required &&
            (!selectedQuestion.answer || selectedQuestion.answer.length === 0)
          ) {
            return item;
          }

          return selectedQuestion;
        }
      }

      return item;
    })
  );

  // console.log('updatedQuestions ----------------', updatedQuestions);

  const updatedTicket = await Ticket.findByIdAndUpdate(
    req.ticket._id,
    { questions: updatedQuestions },
    { new: true, runValidators: true }
  );

  //--------------------> updating ticket event in socket io
  req.app.io.emit('updatingTickets');

  res.status(200).json({
    status: 'success',
    messgae: 'Ticket updated successfully!',
    data: {
      // updatedQuestions,
      ticket: updatedTicket,
    },
  });
});
