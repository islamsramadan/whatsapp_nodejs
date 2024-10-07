const mongoose = require('mongoose');
const multer = require('multer');

const AppError = require('../../utils/appError');
const catchAsync = require('../../utils/catchAsync');
const ticketUtilsHandler = require('../../utils/ticketsUtils');

const Comment = require('../../models/ticketSystem/commentModel');
const Ticket = require('../../models/ticketSystem/ticketModel');
const TicketStatus = require('../../models/ticketSystem/ticketStatusModel');
const Field = require('../../models/ticketSystem/fieldModel');
const TicketLog = require('../../models/ticketSystem/ticketLogModel');
const { mailerSendEmail } = require('../../utils/emailHandler');
const Team = require('../../models/teamModel');
const Notification = require('../../models/notificationModel');
const User = require('../../models/userModel');

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

  // ==========> Checking permission
  const userTeam = await Team.findById(req.user.team);
  if (
    req.user.role !== 'admin' &&
    !userTeam.default &&
    userTeam?.name.toLowerCase() !== 'qc' &&
    !ticket.assignee.equals(req.user._id) &&
    !ticket.creator.equals(req.user._id) &&
    !ticket.users.some((userId) => userId.equals(req.user._id))
  ) {
    return next(
      new AppError("You don't have permission to perform this action!", 403)
    );
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

  const ticket = await Ticket.findById(req.params.ticketID).populate(
    'status',
    'category'
  );

  if (!ticket) {
    return next(new AppError('No ticket found with that ID!', 404));
  }

  if (ticket.status.category === 'solved') {
    return next(new AppError("Couldn't update solved ticket!", 400));
  }

  // ==========> Checking permission
  const ticketTeam = await Team.findById(ticket.team);
  const defaultTeam = await Team.findOne({ default: true });
  if (
    req.user.role !== 'admin' &&
    !ticket.creator.equals(req.user._id) &&
    !ticket.assignee.equals(req.user._id) &&
    !ticketTeam.supervisor.equals(req.user._id) &&
    !defaultTeam._id.equals(req.user.team) &&
    !ticket.users.some((userId) => userId.equals(req.user._id))
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

  // ----------> Status validation
  let status;
  if (req.body.status && !ticket.status.equals(req.body.status)) {
    status = await TicketStatus.findById(req.body.status);

    if (!status || status.status === 'inactive') {
      return next(new AppError('Invalid status!', 400));
    }
  }

  // ------> field required answer for solved status
  if (status && status.category === 'solved') {
    await Promise.all(
      ticket.questions.map(async (item) => {
        const field = await Field.findById(item.field);
        if (!field) {
          return next(new AppError('Invalid field!', 400));
        }

        if (
          (field.required || field.solveRequired) &&
          (!item.answer || item.answer.length === 0)
        ) {
          return next(new AppError('Field answer is required!', 400));
        }
      })
    );
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

    if (status) {
      const ticketUpdatedBody = { status: status._id };
      if (status.category === 'solved') {
        ticketUpdatedBody.solvingTime = new Date();
        ticketUpdatedBody.solvingUser = req.user._id;
      }

      await Ticket.findByIdAndUpdate(ticket._id, ticketUpdatedBody, {
        new: true,
        runValidators: true,
        session: transactionSession,
      });
    }

    // =====================> Remove ticket from user tickets array
    if (status && status.category === 'solved') {
      await User.findByIdAndUpdate(
        ticket.assignee,
        { $pull: { tickets: ticket._id } },
        { new: true, runValidators: true, session: transactionSession }
      );
    }

    // =====================> Comment Ticket Log
    await TicketLog.create(
      [
        {
          ticket: req.params.ticketID,
          log: 'comment',
          user: req.user._id,
        },
      ],
      { session: transactionSession }
    );

    // =====================> New Comment Notification
    const newNotificationData = {
      type: 'tickets',
      ticket: ticket._id,
      event: 'newComment',
    };

    if (!ticket.assignee.equals(req.user._id)) {
      const assigneeNotification = await Notification.create(
        [{ ...newNotificationData, user: ticket.assignee }],
        {
          session: transactionSession,
        }
      );

      console.log('assigneeNotification', assigneeNotification);
    }

    if (
      !ticket.creator.equals(req.user._id) &&
      !ticket.creator.equals(ticket.assignee)
    ) {
      const creatorNotification = await Notification.create(
        [{ ...newNotificationData, user: ticket.creator }],
        {
          session: transactionSession,
        }
      );

      console.log('creatorNotification', creatorNotification);
    }

    // =====================> Status Ticket Log
    if (status) {
      await TicketLog.create(
        [
          {
            ticket: req.params.ticketID,
            log: 'status',
            user: req.user._id,
            status: status._id,
          },
        ],
        {
          session: transactionSession,
        }
      );
    }

    // =====================> Close Ticket Log
    if (status && status.category === 'solved') {
      await TicketLog.create(
        [
          {
            ticket: req.params.ticketID,
            log: 'close',
            user: req.user._id,
          },
        ],
        {
          session: transactionSession,
        }
      );
    }

    // =====================> Solved Ticket Notification
    if (status && status.category === 'solved') {
      const solvedTicketNotificationData = {
        type: 'tickets',
        ticket: ticket._id,
        event: 'solvedTicket',
      };

      // -----------------> creator notification
      if (!ticket.creator.equals(req.user._id)) {
        const creatorNotification = await Notification.create(
          [
            {
              ...solvedTicketNotificationData,
              user: ticket.creator,
              message: `Ticket no. ${ticket.order} has been solved and closed by ${req.user.firstName} ${req.user.lastName}`,
            },
          ],
          {
            session: transactionSession,
          }
        );

        console.log('creatorNotification', creatorNotification);
      }

      // -----------------> assignee notification
      if (
        !ticket.assignee.equals(req.user._id) &&
        !ticket.assignee.equals(ticket.creator)
      ) {
        const assigneeNotification = await Notification.create(
          [
            {
              ...solvedTicketNotificationData,
              user: ticket.assignee,
              message: `Ticket no. ${ticket.order} has been solved and closed by ${req.user.firstName} ${req.user.lastName}`,
            },
          ],
          {
            session: transactionSession,
          }
        );

        console.log('assigneeNotification', assigneeNotification);
      }
    }

    // console.log('New comment created: ============', comment[0]._id);
    await transactionSession.commitTransaction(); // Commit the transaction
  } catch (error) {
    await transactionSession.abortTransaction();

    console.error(
      'Transaction aborted due to an error: ===========================',
      error
    );

    return next(new AppError('Creating new comment aborted! Try again.', 400));
  } finally {
    transactionSession.endSession();
  }

  // ===================> Notify client

  // to send email if type is public
  if (req.body.type === 'public' && ticket.client.email) {
    const text = `عزيزي العميل 
    
    تم اضافة رد للتذكرة رقم (${ticket.order}) 

    ${newComment.text || 'Kindly find the attached.'}
  
    يمكنك متابعة الردود علي الرابط التالي
    
    https://whatsappdome-client.onrender.com/${ticket.clientToken}
    `;

    const emailDetails = {
      to: ticket.client.email,
      subject: `New Comment on your ticket no. ${ticket.order}`,
      text,
    };

    if (newComment.attachments) {
      emailDetails.attachments = newComment.attachments;
    }

    mailerSendEmail(emailDetails);
  }

  //--------------------> updating ticket event in socket io
  req.app.io.emit('updatingTickets');

  res.status(201).json({
    status: 'success',
    data: {
      //   ticket,
      comment: newComment,
    },
  });
});
