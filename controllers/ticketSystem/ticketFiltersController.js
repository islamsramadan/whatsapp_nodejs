const mongoose = require('mongoose');

const AppError = require('../../utils/appError');
const catchAsync = require('../../utils/catchAsync');

const User = require('../../models/userModel');
const Ticket = require('../../models/ticketSystem/ticketModel');
const Team = require('../../models/teamModel');
const TicketStatus = require('../../models/ticketSystem/ticketStatusModel');

exports.getAllTicketsFilters = catchAsync(async (req, res, next) => {
  // console.log('req.user', req.user);

  // const teams = req.query.teams.split(',');

  const userTickets = await Ticket.find({
    $or: [
      { creator: new mongoose.Types.ObjectId(req.user._id) },
      { assignee: new mongoose.Types.ObjectId(req.user._id) },
    ],
  })
    .select('status')
    .populate('status', 'category');

  const userTicketsfilters = {
    all: userTickets.length,
    pending: userTickets.filter(
      (ticket) => ticket.status.category === 'pending'
    ).length,
    new: userTickets.filter((ticket) => ticket.status.category === 'new')
      .length,
    open: userTickets.filter((ticket) => ticket.status.category === 'open')
      .length,
    solved: userTickets.filter((ticket) => ticket.status.category === 'solved')
      .length,
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
    .select('status')
    .populate('status', 'category');

  const teamTicketsfilters = {
    all: teamTickets.length,
    pending: teamTickets.filter(
      (ticket) => ticket.status.category === 'pending'
    ).length,
    new: teamTickets.filter((ticket) => ticket.status.category === 'new')
      .length,
    open: teamTickets.filter((ticket) => ticket.status.category === 'open')
      .length,
    solved: teamTickets.filter((ticket) => ticket.status.category === 'solved')
      .length,
  };

  const getUserStatusCount = async (statusCategory) => {
    const result = await Ticket.aggregate([
      {
        $lookup: {
          from: 'ticketstatuses',
          localField: 'status',
          foreignField: '_id',
          as: 'statusDetails',
        },
      },
      {
        $unwind: '$statusDetails',
      },
      {
        $match: {
          'statusDetails.category': statusCategory,
          $or: [
            { creator: new mongoose.Types.ObjectId(req.user._id) },
            { assignee: new mongoose.Types.ObjectId(req.user._id) },
          ],
        },
      },
      {
        $count: 'ticketCount',
      },
    ]);

    const ticketCount = result.length > 0 ? result[0].ticketCount : 0;

    return ticketCount;
  };

  // const ticketsUserFilters = {
  //   pendingTickets: await getUserStatusCount('pending'),
  //   newTickets: await getUserStatusCount('new'),
  //   openTickets: await getUserStatusCount('open'),
  //   solvedTickets: await getUserStatusCount('solved'),
  // };

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
              .select('status')
              .populate('status', 'category');

            const userTicketsfilters = {
              all: userTickets.length,
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
                (ticket) => ticket.status.category === 'solved'
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

  let page = req.query.page || 1;
  let tickets, totalResults, totalPages;

  let statusesIDs = await TicketStatus.find({ category: { $in: statuses } });
  statusesIDs = statusesIDs.map(
    (item) => new mongoose.Types.ObjectId(item._id)
  );

  tickets = await Ticket.find({
    team: { $in: teamsIDs },
    status: { $in: statusesIDs },
  })
    .select('-updatedAt -questions -users -solvingTime -form')
    .populate('creator', 'firstName lastName photo')
    .populate('assignee', 'firstName lastName photo')
    .populate('team', 'name')
    .populate('status', 'name category')
    .limit(page * 10);

  totalResults = await Ticket.count({
    team: { $in: teamsIDs },
    status: { $in: statusesIDs },
  });

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

  let page = req.query.page || 1;
  let tickets, totalResults, totalPages;

  let statusesIDs = await TicketStatus.find({ category: { $in: statuses } });
  statusesIDs = statusesIDs.map(
    (item) => new mongoose.Types.ObjectId(item._id)
  );

  tickets = await Ticket.find({
    assignee: req.user._id,
    status: { $in: statusesIDs },
  })
    .select('-updatedAt -questions -users -solvingTime -form')
    .populate('creator', 'firstName lastName photo')
    .populate('assignee', 'firstName lastName photo')
    .populate('team', 'name')
    .populate('status', 'name category')
    .populate('status', 'name category')
    .limit(page * 10);

  totalResults = await Ticket.count({
    assignee: req.user._id,
    status: { $in: statusesIDs },
  });

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
