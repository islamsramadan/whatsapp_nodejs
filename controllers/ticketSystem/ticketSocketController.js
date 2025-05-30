const mongoose = require('mongoose');

const Team = require('../../models/teamModel');
const Comment = require('../../models/ticketSystem/commentModel');
const Ticket = require('../../models/ticketSystem/ticketModel');
const TicketStatus = require('../../models/ticketSystem/ticketStatusModel');
const User = require('../../models/userModel');
const TicketLog = require('../../models/ticketSystem/ticketLogModel');

const getSolvedDate = () => {
  const date = new Date();
  // console.log('date ==================== ', date);

  date.setDate(date.getDate() - 1);

  // console.log('date ==================== ', new Date(date.toDateString()));

  return new Date(date.toDateString());
};

exports.getAllTicketsList = async (data) => {
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
  let tickets, totalResults, totalPages;

  tickets = await Ticket.find(filteredBody)
    .sort('-createdAt')
    .populate('category', 'name')
    .populate('creator', 'firstName lastName photo')
    .populate('assignee', 'firstName lastName photo')
    .populate('solvingUser', 'firstName lastName photo')
    .populate('team', 'name')
    .populate('status', 'name category')
    .select('-questions -client -users -type')
    .skip((page - 1) * 20)
    .limit(20);

  totalResults = await Ticket.count(filteredBody);

  totalPages = Math.ceil(totalResults / 20);

  if (page > totalPages) {
    page = totalPages;
  }

  return { totalResults, totalPages, page, tickets };
};

exports.getAllUserTicketsList = async (data, user) => {
  const filteredBody = {
    $or: [{ creator: user._id }, { assignee: user._id }],
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
  let tickets, totalResults, totalPages;

  tickets = await Ticket.find(filteredBody)
    .sort('-createdAt')
    .populate('category', 'name')
    .populate('creator', 'firstName lastName photo')
    .populate('assignee', 'firstName lastName photo')
    .populate('solvingUser', 'firstName lastName photo')
    .populate('team', 'name')
    .populate('status', 'name category')
    .select('-questions -client -users -type')
    .skip((page - 1) * 20)
    .limit(20);

  totalResults = await Ticket.count(filteredBody);

  totalPages = Math.ceil(totalResults / 20);

  if (page > totalPages) {
    page = totalPages;
  }

  return { totalResults, totalPages, page, tickets };
};

exports.getAllTicketsFilters = async (user, teamsIDs) => {
  const userTickets = await Ticket.find({
    $or: [
      { creator: new mongoose.Types.ObjectId(user._id) },
      { assignee: new mongoose.Types.ObjectId(user._id) },
    ],
  })
    .select('status solvingTime')
    .populate('status', 'category');

  const userTicketsfilters = {
    all: userTickets.filter(
      (ticket) =>
        ticket.status.category !== 'solved' ||
        (ticket.status.category === 'solved' &&
          ticket.solvingTime &&
          ticket.solvingTime > getSolvedDate())
    ).length,
    pending: userTickets.filter(
      (ticket) => ticket.status.category === 'pending'
    ).length,
    new: userTickets.filter((ticket) => ticket.status.category === 'new')
      .length,
    open: userTickets.filter((ticket) => ticket.status.category === 'open')
      .length,
    solved: userTickets.filter(
      (ticket) =>
        ticket.status.category === 'solved' &&
        ticket.solvingTime &&
        ticket.solvingTime > getSolvedDate()
    ).length,
  };

  const teamTickets = await Ticket.find({
    team: { $in: teamsIDs },
  })
    .select('status solvingTime')
    .populate('status', 'category');

  const teamTicketsfilters = {
    all: teamTickets.filter(
      (ticket) =>
        ticket.status.category !== 'solved' ||
        (ticket.status.category === 'solved' &&
          ticket.solvingTime &&
          ticket.solvingTime > getSolvedDate())
    ).length,
    pending: teamTickets.filter(
      (ticket) => ticket.status.category === 'pending'
    ).length,
    new: teamTickets.filter((ticket) => ticket.status.category === 'new')
      .length,
    open: teamTickets.filter((ticket) => ticket.status.category === 'open')
      .length,
    solved: teamTickets.filter(
      (ticket) =>
        ticket.status.category === 'solved' &&
        ticket.solvingTime &&
        ticket.solvingTime > getSolvedDate()
    ).length,
  };

  return { userTicketsfilters, teamTicketsfilters };
};

exports.getTeamUsersTicketsFilters = async (teamsIDs) => {
  const teams = await Promise.all(
    teamsIDs.map(async (teamID) => {
      const team = await Team.findById(teamID);

      const teamUsers = await Promise.all(
        team.users.map(async (userID) => {
          const user = await User.findById(userID);
          if (user) {
            let userTickets = await Ticket.find({
              assignee: userID,
            })
              .select('status solvingTime')
              .populate('status', 'category');

            const userTicketsfilters = {
              all: userTickets.filter(
                (ticket) =>
                  ticket.status.category !== 'solved' ||
                  (ticket.status.category === 'solved' &&
                    ticket.solvingTime &&
                    ticket.solvingTime > getSolvedDate())
              ).length,
              new: userTickets.filter(
                (ticket) => ticket.status.category === 'new'
              ).length,
              open: userTickets.filter(
                (ticket) => ticket.status.category === 'open'
              ).length,
              pending: userTickets.filter(
                (ticket) => ticket.status.category === 'pending'
              ).length,
              solved: userTickets.filter(
                (ticket) =>
                  ticket.status.category === 'solved' &&
                  ticket.solvingTime &&
                  ticket.solvingTime > getSolvedDate()
              ).length,
            };

            return {
              _id: userID,
              firstName: user.firstName,
              lastName: user.lastName,
              photo: user.photo,
              status: user.status,
              tickets: userTicketsfilters,
            };
          }
        })
      );

      return { _id: teamID, teamName: team.name, users: teamUsers };
    })
  );

  return teams;
};

exports.getAllTeamTickets = async (teamsIDs, status, ticketPage) => {
  let statuses = status.split(',');
  if (statuses.includes('all')) {
    statuses = ['open', 'new', 'pending', 'solved'];
  }

  let page = ticketPage || 1;
  let tickets, totalResults, totalPages;

  let solvedStatusIDs = [];
  if (statuses.includes('solved')) {
    solvedStatusIDs = await TicketStatus.find({ category: 'solved' });
  }

  const otherStatuses = statuses.filter((status) => status !== 'solved');
  let otherStatusesIDs = await TicketStatus.find({
    category: { $in: otherStatuses },
  });

  const filteredBody = { team: { $in: teamsIDs } };

  if (solvedStatusIDs && solvedStatusIDs.length > 0) {
    filteredBody.$or = [
      { status: { $in: otherStatusesIDs } },
      {
        status: { $in: solvedStatusIDs },
        solvingTime: { $gte: getSolvedDate() },
      },
    ];
  } else {
    filteredBody.status = { $in: otherStatusesIDs };
  }

  tickets = await Ticket.find(filteredBody)
    .sort('-createdAt')
    .select('-updatedAt -questions -users -solvingTime -form')
    .populate('creator', 'firstName lastName photo')
    .populate('assignee', 'firstName lastName photo')
    .populate('team', 'name')
    .populate('status', 'name category')
    .limit(page * 10);

  totalResults = await Ticket.count(filteredBody);

  totalPages = Math.ceil(totalResults / 10);

  if (page > totalPages) {
    page = totalPages;
  }

  return { totalResults, totalPages, page, tickets };
};

exports.getAllUserTickets = async (user, status, ticketPage) => {
  let statuses = status.split(',');
  if (statuses.includes('all')) {
    statuses = ['open', 'new', 'pending', 'solved'];
  }

  let page = ticketPage || 1;
  let tickets, totalResults, totalPages;

  let solvedStatusIDs = [];
  if (statuses.includes('solved')) {
    solvedStatusIDs = await TicketStatus.find({ category: 'solved' });
  }

  const otherStatuses = statuses.filter((status) => status !== 'solved');
  let otherStatusesIDs = await TicketStatus.find({
    category: { $in: otherStatuses },
  });

  const filteredBody = {};

  if (solvedStatusIDs && solvedStatusIDs.length > 0) {
    filteredBody.$and = [
      {
        $or: [
          { creator: new mongoose.Types.ObjectId(user._id) },
          { assignee: new mongoose.Types.ObjectId(user._id) },
        ],
      },
      {
        $or: [
          { status: { $in: otherStatusesIDs } },
          {
            status: { $in: solvedStatusIDs },
            solvingTime: { $gte: getSolvedDate() },
          },
        ],
      },
    ];
  } else {
    filteredBody.$or = [
      { creator: new mongoose.Types.ObjectId(user._id) },
      { assignee: new mongoose.Types.ObjectId(user._id) },
    ];

    filteredBody.status = { $in: otherStatusesIDs };
  }

  tickets = await Ticket.find(filteredBody)
    .sort('-createdAt')
    .select('-updatedAt -questions -users -solvingTime -form')
    .populate('creator', 'firstName lastName photo')
    .populate('assignee', 'firstName lastName photo')
    .populate('team', 'name')
    .populate('status', 'name category')
    .limit(page * 10);

  totalResults = await Ticket.count(filteredBody);

  totalPages = Math.ceil(totalResults / 10);

  if (page > totalPages) {
    page = totalPages;
  }

  return { totalResults, totalPages, page, tickets };
};

exports.getAllTeamUserTickets = async (teamUserID, ticketPage) => {
  let page = ticketPage || 1;
  let tickets, totalResults, totalPages;

  let solvedStatusIDs = await TicketStatus.find({ category: 'solved' });

  let otherStatusesIDs = await TicketStatus.find({
    category: { $ne: 'solved' },
  });

  const filteredBody = {
    assignee: teamUserID,
    $or: [
      { status: { $in: otherStatusesIDs } },
      {
        status: { $in: solvedStatusIDs },
        solvingTime: { $gte: getSolvedDate() },
      },
    ],
  };

  tickets = await Ticket.find(filteredBody)
    .sort('-createdAt')
    .select('-updatedAt -questions -users -solvingTime -form')
    .populate('creator', 'firstName lastName photo')
    .populate('assignee', 'firstName lastName photo')
    .populate('team', 'name')
    .populate('status', 'name category')
    .populate('status', 'name category')
    .limit(page * 10);

  totalResults = await Ticket.count(filteredBody);

  totalPages = Math.ceil(totalResults / 10);

  if (page > totalPages) {
    page = totalPages;
  }

  return { totalResults, totalPages, page, tickets };
};

exports.getTicket = async (ticketID) => {
  const ticket = await Ticket.findById(ticketID)
    .populate('category', 'name')
    .populate('creator', 'firstName lastName photo')
    .populate('assignee', 'firstName lastName photo')
    .populate('solvingUser', 'firstName lastName photo')
    .populate('team', 'name')
    .populate('status', 'name category')
    .populate('form', 'name')
    .populate({
      path: 'questions.field',
      select: '-updatedAt -createdAt -forms -creator',
      populate: { path: 'type', select: 'name value description' },
    });

  const comments = await Comment.find({ ticket: ticketID }).populate(
    'user',
    'firstName lastName photo'
  );

  const ticketLogs = await TicketLog.find({ ticket: ticketID })
    .populate('ticket', 'order')
    .populate('user', 'firstName lastName photo')
    .populate('assignee', 'firstName lastName photo')
    .populate('transfer.from.user', 'firstName lastName photo')
    .populate('transfer.to.user', 'firstName lastName photo')
    .populate('transfer.from.team', 'name')
    .populate('transfer.to.team', 'name')
    .populate('status', 'name endUserDisplayName category');

  const pastTickets = await Ticket.find({
    refNo: ticket.refNo,
    _id: { $ne: ticket._id },
  })
    .select('-questions -client -users -type')
    .populate('category', 'name')
    .populate('creator', 'firstName lastName photo')
    .populate('assignee', 'firstName lastName photo')
    .populate('solvingUser', 'firstName lastName photo')
    .populate('team', 'name')
    .populate('status', 'name category');

  return { ticket, comments, ticketLogs, pastTickets };
};
