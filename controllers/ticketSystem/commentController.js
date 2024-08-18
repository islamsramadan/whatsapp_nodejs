const mongoose = require('mongoose');
const multer = require('multer');

const AppError = require('../../utils/appError');
const catchAsync = require('../../utils/catchAsync');
const ticketUtilsHandler = require('../../utils/ticketsUtils');

const Comment = require('../../models/ticketSystem/commentModel');
const Ticket = require('../../models/ticketSystem/ticketModel');
const TicketStatus = require('../../models/ticketSystem/ticketStatusModel');

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

exports.getAllTicketComments = catchAsync(async (req, res, next) => {
  const ticket = await Ticket.findById(req.params.ticketID);
  if (!ticket) {
    return next(new AppError('No ticket found with that ID!', 404));
  }

  const comments = await Comment.find({ ticket: req.params.ticketID }).populate(
    'user',
    'firstName lastName photo'
  );

  res.status(200).json({
    status: 'success',
    results: comments.length,
    data: {
      comments,
    },
  });
});

exports.getComment = catchAsync(async (req, res, next) => {
  const comment = await Comment.findById(req.params.commentID).populate(
    'user',
    'firstName lastName photo'
  );

  if (!comment) {
    return next(new AppError('No comment found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      comment,
    },
  });
});

exports.createComment = catchAsync(async (req, res, next) => {
  //   console.log('req.files -------------------> ', req.files);

  const ticket = await Ticket.findById(req.params.ticketID);
  if (!ticket) {
    return next(new AppError('No ticket found with that ID!', 400));
  }

  if (
    !ticket.creator.equals(req.user._id) &&
    !ticket.assignee.equals(req.user._id)
  ) {
    return next(
      new AppError(
        "You don't have the permission to reply to this ticket!",
        403
      )
    );
  }

  if (!req.body.type) {
    return next(new AppError('Comment type is required!', 400));
  }

  if (!req.body.text && (!req.files || req.files.length === 0)) {
    return next(new AppError('Comment body is required!', 400));
  }

  const newCommentData = {
    type: req.body.type,
    user: req.user._id,
    ticket: req.params.ticketID,
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

  const transactionSession = await mongoose.startSession();
  transactionSession.startTransaction();

  let newComment;
  try {
    // =====================> Create Comment
    const comment = await Comment.create([newCommentData], {
      session: transactionSession,
    });
    // console.log('comment', comment);

    newComment = comment[0];

    if (
      req.body.ticketStatus &&
      (await TicketStatus.findById(req.body.ticketStatus))
    ) {
      ticket.status = req.body.ticketStatus;
      await ticket.save({ session: transactionSession });
    }

    await transactionSession.commitTransaction(); // Commit the transaction

    console.log('New comment created: ============', comment[0]._id);
  } catch (error) {
    await transactionSession.abortTransaction();

    console.error(
      'Transaction aborted due to an error: ===========================',
      error
    );

    return next(new AppError('Creating new comment aborted', 400));
  } finally {
    transactionSession.endSession();
  }

  // ===================> Notify client

  // to send email if type is public
  // if (req.body.type === 'public') {
  //   let link = '';
  //   if (req.files) {
  //     const linksArray = req.files.map(
  //       (item) => `https://wp.designal.cc/${item.filename}`
  //     );
  //     link = linksArray.join(' -- ');
  //   } else {
  //     link = 'Not found!';
  //   }
  //   req.body.ticketID = ticket._id;
  //   req.body.link = link;

  //   // await ticketUtilsHandler.notifyClientHandler(req, ticket);
  // }

  res.status(201).json({
    status: 'success',
    data: {
      //   ticket,
      comment: newComment,
    },
  });
});
