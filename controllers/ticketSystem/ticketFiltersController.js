const mongoose = require('mongoose');

const AppError = require('../../utils/appError');
const catchAsync = require('../../utils/catchAsync');

const User = require('../../models/userModel');
const Ticket = require('../../models/ticketSystem/ticketModel');
const Team = require('../../models/teamModel');
const TicketStatus = require('../../models/ticketSystem/ticketStatusModel');

const getSolvedDate = () => {
  const date = new Date();
  // console.log('date ==================== ', date);

  date.setDate(date.getDate() - 1);

  // console.log('date ==================== ', new Date(date.toDateString()));

  return new Date(date.toDateString());
};

exports.getAllTicketsFilters = catchAsync(async (req, res, next) => {
  const userTickets = await Ticket.find({
    $or: [
      { creator: new mongoose.Types.ObjectId(req.user._id) },
      { assignee: new mongoose.Types.ObjectId(req.user._id) },
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

  const teamsIDs = req.params.teamsIDs?.split(',');
  if (teamsIDs.length === 0) {
    return next(new AppError('Teams IDs are required!', 400));
  }

  if (
    (teamsIDs.length > 1 ||
      (teamsIDs.length === 1 && !req.user.team.equals(teamsIDs[0]))) &&
    req.user.role !== 'admin'
  ) {
    return next(
      new AppError("You don't have permission to perform this action!", 403)
    );
  }
  // console.log('teamsIDs', teamsIDs);

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

  res.status(200).json({
    status: 'success',
    data: {
      userTicketsfilters,
      teamTicketsfilters,
    },
  });
});

exports.getTeamUsersTicketsFilters = catchAsync(async (req, res, next) => {
  const teamsIDs = req.params.teamsIDs?.split(',');

  if (teamsIDs.length === 0) {
    return next(new AppError('Teams IDs are required!', 400));
  }

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

  res.status(200).json({
    status: 'success',
    results: teams.length,
    data: {
      teams,
    },
  });
});

exports.getAllTeamTickets = catchAsync(async (req, res, next) => {
  if (!req.query.status) {
    return next(new AppError('Status is required', 400));
  }

  let statuses = req.query.status.split(',');
  if (statuses.includes('all')) {
    statuses = ['open', 'new', 'pending', 'solved'];
  }

  const teamsIDs = req.params.teamsIDs.split(',');
  if (teamsIDs.length === 0) {
    return next(new AppError('Teams IDs are required!', 400));
  }

  let page = req.query.page * 1 || 1;
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
  if (!req.query.status) {
    return next(new AppError('Status is required', 400));
  }

  let statuses = req.query.status.split(',');
  if (statuses.includes('all')) {
    statuses = ['open', 'new', 'pending', 'solved'];
  }

  let page = req.query.page * 1 || 1;
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
          { creator: new mongoose.Types.ObjectId(req.user._id) },
          { assignee: new mongoose.Types.ObjectId(req.user._id) },
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
      { creator: new mongoose.Types.ObjectId(req.user._id) },
      { assignee: new mongoose.Types.ObjectId(req.user._id) },
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

exports.getAllTeamUserTickets = catchAsync(async (req, res, next) => {
  let page = req.query.page * 1 || 1;
  let tickets, totalResults, totalPages;

  let solvedStatusIDs = await TicketStatus.find({ category: 'solved' });

  let otherStatusesIDs = await TicketStatus.find({
    category: { $ne: 'solved' },
  });

  const filteredBody = {
    assignee: req.params.userID,
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
