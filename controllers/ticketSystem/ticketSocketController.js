const Team = require('../../models/teamModel');
const Comment = require('../../models/ticketSystem/commentModel');
const Ticket = require('../../models/ticketSystem/ticketModel');
const TicketStatus = require('../../models/ticketSystem/ticketStatusModel');
const User = require('../../models/userModel');

exports.getAllTicketsFilters = async (user, teamsIDs) => {
  const userTickets = await Ticket.find({
    $or: [
      { creator: new mongoose.Types.ObjectId(user._id) },
      { assignee: new mongoose.Types.ObjectId(user._id) },
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

  return { teams };
};

exports.getAllTeamTickets = async (teamsIDs, status, ticketPage) => {
  let statuses = status.split(',');
  if (statuses.includes('all')) {
    statuses = ['open', 'new', 'pending', 'solved'];
  }

  let page = ticketPage || 1;
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

  return { totalResults, totalPages, page, chats };
};

exports.getAllUserTickets = async (user, status, ticketPage) => {
  let statuses = status.split(',');
  if (statuses.includes('all')) {
    statuses = ['open', 'new', 'pending', 'solved'];
  }

  let page = ticketPage || 1;
  let tickets, totalResults, totalPages;

  let statusesIDs = await TicketStatus.find({ category: { $in: statuses } });
  statusesIDs = statusesIDs.map(
    (item) => new mongoose.Types.ObjectId(item._id)
  );

  tickets = await Ticket.find({
    $or: [
      { creator: new mongoose.Types.ObjectId(user._id) },
      { assignee: new mongoose.Types.ObjectId(user._id) },
    ],
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
    assignee: user._id,
    status: { $in: statusesIDs },
  });

  totalPages = Math.ceil(totalResults / 10);

  if (page > totalPages) {
    page = totalPages;
  }

  return { totalResults, totalPages, page, tickets };
};

exports.getAllTeamUserTickets = async (teamUserID, ticketPage) => {
  let page = ticketPage || 1;
  let tickets, totalResults, totalPages;

  tickets = await Ticket.find({
    assignee: teamUserID,
  })
    .select('-updatedAt -questions -users -solvingTime -form')
    .populate('creator', 'firstName lastName photo')
    .populate('assignee', 'firstName lastName photo')
    .populate('team', 'name')
    .populate('status', 'name category')
    .populate('status', 'name category')
    .limit(page * 10);

  totalResults = await Ticket.count({
    assignee: teamUserID,
  });

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

  const comments = await Comment.find({ ticket: ticketID });

  return { ticket, comments };
};
