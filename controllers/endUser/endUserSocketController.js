const mongoose = require('mongoose');
const multer = require('multer');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

const AppError = require('../../utils/appError');
const catchAsync = require('../../utils/catchAsync');
const ticketUtilsHandler = require('../../utils/ticketsUtils');
const { mailerSendEmail } = require('../../utils/emailHandler');
const serviceHoursUtils = require('../../utils/serviceHoursUtils');

const User = require('../../models/userModel');
const TicketCategory = require('../../models/ticketSystem/ticketCategoryModel');
const Ticket = require('../../models/ticketSystem/ticketModel');
const TicketStatus = require('../../models/ticketSystem/ticketStatusModel');
const Form = require('../../models/ticketSystem/formModel');
const Field = require('../../models/ticketSystem/fieldModel');
const Team = require('../../models/teamModel');
const TicketLog = require('../../models/ticketSystem/ticketLogModel');
const Comment = require('../../models/ticketSystem/commentModel');
const Chat = require('../../models/chatModel');
const Message = require('../../models/messageModel');
const Service = require('../../models/serviceModel');
const EndUserNotification = require('../../models/endUser/endUserNotificationModel');

exports.getAllEndUserTickets = async (socket, data) => {
  const filteredBody = {
    $or: [
      { endUser: socket.endUser._id },
      { 'client.number': socket.endUser.phone },
    ],
  };

  if (data.category) {
    filteredBody.category = data.category;
  }

  if (data.status) {
    const statusesIDs = data.status.split(',');
    filteredBody.status = { $in: statusesIDs };
  }

  if (data.priority) {
    filteredBody.priority = data.priority;
  }

  if (data.startDate) {
    filteredBody.createdAt = { $gt: new Date(data.startDate) };
  }
  if (data.endDate) {
    const endDate = new Date(data.endDate);
    endDate.setDate(endDate.getDate() + 1);

    filteredBody.createdAt = {
      ...filteredBody.createdAt,
      $lt: endDate,
    };
  }

  if (data.assignee) {
    const assigneesIDs = data.assignee.split(',');
    filteredBody.assignee = { $in: assigneesIDs };
  }

  if (data.creator) {
    const creatorIDs = data.creator.split(',');
    filteredBody.creator = { $in: creatorIDs };
  }

  if (data.team) {
    filteredBody.team = data.team;
  }

  if (data.refNo) {
    filteredBody.refNo = { $regex: data.refNo };
  }

  if (data.order && !isNaN(data.order * 1)) {
    filteredBody.order = data.order * 1;
  }

  if (data.requestNature) {
    filteredBody.requestNature = data.requestNature;
  }

  if (data.requestType) {
    filteredBody.requestType = data.requestType;
  }

  let page = data.page * 1 || 1;

  const tickets = await Ticket.find(filteredBody)
    .sort('-createdAt')
    .populate('category', 'name')
    .populate('endUser', 'name nationalID phone')
    .populate('creator', 'firstName lastName photo')
    .populate('assignee', 'firstName lastName photo')
    .populate('team', 'name')
    .populate('status', 'name category')
    .select(
      '-form -questions -client -users -clientToken -complaintReport -tags -priority -solvingTime -solvingUser -rating -feedback'
    )
    .skip((page - 1) * 20)
    .limit(20);

  const totalResults = await Ticket.count(filteredBody);
  const totalPages = Math.ceil(totalResults / 20);

  if (page > totalPages) {
    page = totalPages;
  }

  return {
    totalResults,
    totalPages,
    page,
    tickets,
  };
};

exports.getEndUserTicket = async (socket, data) => {
  const ticketID = data.ticketID;

  // let ticket = await getPopulatedTicket({ _id: ticketID });
  let ticket = await Ticket.findById(ticketID)
    .populate('category', 'name')
    .populate('creator', 'firstName lastName photo')
    .populate('endUser', 'nationalID name phone')
    .populate('assignee', 'firstName lastName photo email')
    .populate('solvingUser', 'firstName lastName photo')
    .populate('team', 'name')
    .populate('status', 'name category')
    .populate('form', 'name')
    .populate({
      path: 'questions.field',
      select: 'type endUserView endUserPermission',
      populate: { path: 'type', select: 'name value description' },
    })
    .select('-client -users -clientToken -complaintReport -tags -priority')
    .lean();

  ticket = {
    ...ticket,
    questions: ticket.questions.filter((item) =>
      ['view', 'edit'].includes(item.field.endUserPermission)
    ),
  };

  // console.log('ticket', ticket);
  const ticketLogs = await TicketLog.find({ ticket: ticketID, type: 'public' })
    .populate({
      path: 'user',
      select: 'firstName lastName photo team',
      populate: { path: 'team', select: 'name' },
    })
    .populate({
      path: 'assignee',
      select: 'firstName lastName photo team',
      populate: { path: 'team', select: 'name' },
    })
    .populate('endUser', 'nationalID name phone')
    .populate('transfer.from.user', 'firstName lastName photo')
    .populate('transfer.to.user', 'firstName lastName photo')
    .populate('transfer.from.team', 'name')
    .populate('transfer.to.team', 'name')
    .populate('status', 'endUserDisplayName category')
    .select('-updatedAt');

  const ticketComments = await Comment.find({
    ticket: ticketID,
    type: { $ne: 'note' },
  })
    .populate('user', 'firstName lastName photo')
    .populate('endUser', 'nationalID name phone')
    .select('-updatedAt');

  const pastTickets = await Ticket.find({ refNo: ticket.refNo })
    .sort('-createdAt')
    .populate('category', 'name')
    .populate('endUser', 'name nationalID phone')
    .populate('creator', 'firstName lastName photo')
    .populate('assignee', 'firstName lastName photo')
    .populate('team', 'name')
    .populate('status', 'name category')
    .select(
      '-form -questions -users -clientToken -complaintReport -tags -priority -solvingTime -solvingUser -rating -feedback'
    );

  return {
    ticket,
    ticketLogs,
    ticketComments,
    pastTickets,
  };
};

exports.getAllEndUserMessages = async (socket, data) => {
  const chat = await Chat.findOne({ endUser: socket.endUser._id });

  const page = data.page * 1 || 1;

  const messages = await Message.find({ chat: chat._id })
    .sort('-createdAt')
    .populate('reply')
    .limit(page * 20);

  const totalResults = await Message.count({ chat: chat._id });
  const totalPages = Math.ceil(totalResults / 20);

  let userStatus;

  if (chat.currentUser && chat.team && chat.status === 'open') {
    const currentUser = await User.findById(chat.currentUser);
    userStatus = currentUser.status;

    if (userStatus === 'Service hours') {
      const team = await Team.findById(chat.team);
      const serviceHours = await Service.findById(team.serviceHours);

      if (serviceHoursUtils.checkInsideServiceHours(serviceHours.durations)) {
        userStatus = 'Online';
      } else {
        userStatus = 'Offline';
      }
    }
  } else {
    const defaultTeam = await Team.findOne({ default: true });
    const defaultServiceHours = await Service.findById(
      defaultTeam.serviceHours
    );

    if (
      serviceHoursUtils.checkInsideServiceHours(defaultServiceHours.durations)
    ) {
      userStatus = 'Online';
    } else {
      userStatus = 'Offline';
    }
  }

  return {
    userStatus,
    chatID: chat._id,
    page,
    totalPages,
    totalResults,
    messages: messages.reverse(),
  };
};

exports.getAllEndUserNewNotifications = async (socket, data) => {
  const newNotifications = await EndUserNotification.count({
    endUser: socket.endUser._id,
    read: false,
  });

  return { newNotifications };
};

exports.getAllEndUserNotifications = async (socket, data) => {
  const page = data.page * 1 || 1;
  const notifications = await EndUserNotification.find({
    endUser: socket.endUser._id,
  })
    .sort('-sortingDate')
    .populate('ticket', 'order')
    .populate('chat', 'client')
    .limit(page * 10);

  const newNotifications = await EndUserNotification.count({
    endUser: socket.endUser._id,
    read: false,
  });

  const totalResults = await EndUserNotification.count({
    endUser: socket.endUser._id,
  });

  const totalPages = Math.ceil(totalResults / 10);

  return { page, totalPages, totalResults, newNotifications, notifications };
};
