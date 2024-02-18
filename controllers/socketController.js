const jwt = require('jsonwebtoken');
const { promisify } = require('util');

const User = require('../models/userModel');
const Chat = require('../models/chatModel');
const Message = require('../models/messageModel');
const Session = require('../models/sessionModel');
const Team = require('../models/teamModel');

exports.protectSocket = async (socket, next) => {
  // 1) Getting token and check if it is there
  let token;
  if (
    socket.handshake.query.token &&
    socket.handshake.query.token.startsWith('Bearer')
  ) {
    token = socket.handshake.query.token.split(' ')[1];
  }
  console.log('token ===========================', token);

  if (!token) {
    return next(new AppError('Authentication error: Token missing!', 401));
  }

  // 2) Verification token
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
  // console.log('decoded', decoded);

  // 3) Check if user still exists
  const currentUser = await User.findById(decoded.id).select('+token');
  if (!currentUser) {
    return next(
      new AppError(
        'The user belonging to this token does no longer exist!',
        401
      )
    );
  }

  // 4) Check if user changed password after token had been issued
  if (currentUser.changedPasswordAfter(decoded.iat)) {
    return next(
      new AppError(
        'User recently changed password! Kindly login again to get access.',
        401
      )
    );
  }

  // 5) check if it is the same token in db as it is the last login
  if (currentUser.token && currentUser.token !== token) {
    return next(
      new AppError('User recently loged in with different token!', 401)
    );
  }

  // Remove token from the user to send it in the req
  currentUser.token = undefined;

  // GRANT ACCESS TO PROTECTED ROUTE
  socket.user = currentUser;
  console.log('currentUser', socket.user);
  next();
};

exports.getAllSessions = async (user, teamsIDs) => {
  let userSessions = await Session.find({
    user: req.user._id,
    // status: { $ne: 'finished' },
    end: { $exists: false },
  }).populate('chat');
  userSessions = userSessions.filter((session) =>
    session._id.equals(session.chat.lastSession)
  );
  const userSessionsfilters = {
    all: userSessions.length,
    onTime: userSessions.filter((session) => session.status === 'onTime')
      .length,
    danger: userSessions.filter((session) => session.status === 'danger')
      .length,
    tooLate: userSessions.filter((session) => session.status === 'tooLate')
      .length,
    open: userSessions.filter((session) => session.status === 'open').length,
  };

  let teamSessions = await Session.find({
    team: { $in: teamsIDs },
    // team: req.user.team,
    // status: { $ne: 'finished' },
    end: { $exists: false },
  }).populate('chat');

  teamSessions = teamSessions.filter((session) =>
    session._id.equals(session.chat.lastSession)
  );
  const teamSessionsfilters = {
    all: teamSessions.length,
    onTime: teamSessions.filter((session) => session.status === 'onTime')
      .length,
    danger: teamSessions.filter((session) => session.status === 'danger')
      .length,
    tooLate: teamSessions.filter((session) => session.status === 'tooLate')
      .length,
    open: teamSessions.filter((session) => session.status === 'open').length,
  };

  return {
    userSessions: userSessionsfilters,
    teamSessions: teamSessionsfilters,
  };
};

exports.getAllTeamUsersSessions = async (teamsIDs) => {
  const teams = await Promise.all(
    teamsIDs.map(async (teamID) => {
      const team = await Team.findById(teamID);

      const teamUsers = await Promise.all(
        team.users.map(async (userID) => {
          const user = await User.findById(userID);
          let userSessions = await Session.find({
            user: userID,
            // status: { $ne: 'finished' },
            end: { $exists: false },
          }).populate('chat');

          userSessions = userSessions.filter(
            (session) =>
              session._id.equals(session.chat.lastSession) &&
              session.chat.currentUser &&
              session.chat.currentUser.equals(userID)
          );

          const userSessionsfilters = {
            all: userSessions.length,
            onTime: userSessions.filter(
              (session) => session.status === 'onTime'
            ).length,
            danger: userSessions.filter(
              (session) => session.status === 'danger'
            ).length,
            tooLate: userSessions.filter(
              (session) => session.status === 'tooLate'
            ).length,
            open: userSessions.filter((session) => session.status === 'open')
              .length,
          };

          return {
            _id: userID,
            firstName: user.firstName,
            lastName: user.lastName,
            photo: user.photo,
            status: user.status,
            sessions: userSessionsfilters,
          };
        })
      );

      return { _id: teamID, teamName: team.name, users: teamUsers };
    })
  );

  return teams;
};

exports.getAllUserChats = async (user, status) => {
  let statuses = status.split(',');
  if (statuses.includes('all')) {
    statuses = ['open', 'onTime', 'danger', 'tooLate'];
  }

  let chats = await Chat.find({ currentUser: user._id })
    .sort('-updatedAt')
    .populate('lastMessage')
    .populate('contactName', 'name')
    .populate('lastSession', 'status');

  chats = chats.filter((chat) => statuses.includes(chat.lastSession?.status));

  return chats;
};

exports.getAllteamChats = async (user, status, teamsIDs) => {
  let statuses = status.split(',');
  if (statuses.includes('all')) {
    statuses = ['open', 'onTime', 'danger', 'tooLate'];
  }

  let chats = await Chat.find({
    team: { $in: teamsIDs },
    // team: user.team,
  })
    .sort('-updatedAt')
    .populate('lastMessage')
    .populate('contactName', 'name')
    .populate('lastSession', 'status');
  // console.log('chats', chats.length);

  chats = chats.filter((chat) => statuses.includes(chat.lastSession?.status));

  return chats;
};

exports.getAllArchivedChats = async () => {
  const chats = await Chat.find({ status: 'archived' })
    .sort('-updatedAt')
    .populate('lastMessage')
    .populate('lastSession', 'status')
    .populate('contactName', 'name');

  return chats;
};

exports.getAllChatMessages = async (chatNumber) => {
  const chat = await Chat.findOne({ client: chatNumber }).populate(
    'contactName',
    'name'
  );

  const messages = await Message.find({ chat: chat._id })
    .sort('createdAt')
    .populate('user', 'firstName lastName photo')
    .populate('reply');

  const chatSession = chat.session;
  const chatStatus = chat.status;
  const contactName = chat.contactName;
  const currentUser = chat.currentUser;

  return { messages, chatSession, chatStatus, contactName, currentUser };
};
