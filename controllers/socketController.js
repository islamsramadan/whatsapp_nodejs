const jwt = require('jsonwebtoken');
const { promisify } = require('util');

const User = require('../models/userModel');
const Chat = require('../models/chatModel');
const Message = require('../models/messageModel');
const Session = require('../models/sessionModel');
const Team = require('../models/teamModel');
const ChatHistory = require('../models/historyModel');

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
    user: user._id,
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
    .populate('lastSession', 'status secret')
    .lean();

  chats = chats.filter((chat) => statuses.includes(chat.lastSession?.status));

  chats = chats.map((chat) => {
    if (chat.lastMessage?.secret === true) {
      return {
        ...chat,
        lastMessage: {
          _id: chat.lastMessage._id,
          status: chat.lastMessage.status,
          received: chat.lastMessage.received,
          sent: chat.lastMessage.sent,
          delivered: chat.lastMessage.delivered,
          read: chat.lastMessage.read,
        },
      };
    } else {
      return chat;
    }
  });

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
    .populate('lastSession', 'status secret')
    .lean();

  chats = chats.filter((chat) => statuses.includes(chat.lastSession?.status));

  chats = chats.map((chat) => {
    if (chat.lastMessage?.secret === true) {
      return {
        ...chat,
        lastMessage: {
          _id: chat.lastMessage._id,
          status: chat.lastMessage.status,
          received: chat.lastMessage.received,
          sent: chat.lastMessage.sent,
          delivered: chat.lastMessage.delivered,
          read: chat.lastMessage.read,
        },
      };
    } else {
      return chat;
    }
  });

  return chats;
};

exports.getAllTeamUserChats = async (teamUserID) => {
  let chats = await Chat.find({ currentUser: teamUserID })
    .sort('-updatedAt')
    .populate('lastMessage')
    .populate('lastSession', 'status secret')
    .populate('contactName', 'name')
    .lean();

  chats = chats.map((chat) => {
    if (chat.lastMessage?.secret === true) {
      return {
        ...chat,
        lastMessage: {
          _id: chat.lastMessage._id,
          status: chat.lastMessage.status,
          received: chat.lastMessage.received,
          sent: chat.lastMessage.sent,
          delivered: chat.lastMessage.delivered,
          read: chat.lastMessage.read,
        },
      };
    } else {
      return chat;
    }
  });

  return chats;
};

exports.getAllArchivedChats = async (userID, startDate, endDate, chatPage) => {
  const page = chatPage || 1;
  let chats, totalResults, totalPages;

  if (userID) {
    const sessionFilterObj = {
      status: 'finished',
      end: { $exists: true },
      user: userID,
    };

    if (startDate) sessionFilterObj.end = { $gt: new Date(startDate) };

    if (endDate) {
      const endDateObj = new Date(endDate);
      endDateObj.setDate(endDateObj.getDate() + 1);

      sessionFilterObj.end = {
        ...sessionFilterObj.end,
        $lt: endDateObj,
      };
    }

    const sessions = await Session.find(sessionFilterObj);
    const chatsIDs = sessions.map((session) => session.chat);
    chats = await Chat.find({ _id: { $in: chatsIDs } })
      .sort('-updatedAt')
      .populate('lastMessage')
      .populate('lastSession', 'status secret')
      .populate('contactName', 'name')
      .limit(page * 10)
      .lean();

    chats = chats.map((chat) => {
      if (chat.lastMessage?.secret === true) {
        return {
          ...chat,
          lastMessage: {
            _id: chat.lastMessage._id,
            status: chat.lastMessage.status,
            received: chat.lastMessage.received,
            sent: chat.lastMessage.sent,
            delivered: chat.lastMessage.delivered,
            read: chat.lastMessage.read,
          },
        };
      } else {
        return chat;
      }
    });

    totalResults = await Chat.count({ _id: { $in: chatsIDs } });
    totalPages = Math.ceil(totalResults / 10);
  } else {
    const chatFilterObj = { status: 'archived' };

    if (startDate) chatFilterObj.updatedAt = { $gt: new Date(startDate) };

    if (endDate) {
      const endDateObj = new Date(endDate);
      endDateObj.setDate(endDateObj.getDate() + 1);

      chatFilterObj.updatedAt = {
        ...chatFilterObj.updatedAt,
        $lt: endDateObj,
      };
    }

    chats = await Chat.find(chatFilterObj)
      .sort('-updatedAt')
      .populate('lastMessage')
      .populate('lastSession', 'status secret')
      .populate('contactName', 'name')
      .limit(page * 10)
      .lean();

    chats = chats.map((chat) => {
      if (chat.lastMessage?.secret === true) {
        return {
          ...chat,
          lastMessage: {
            _id: chat.lastMessage._id,
            status: chat.lastMessage.status,
            received: chat.lastMessage.received,
            sent: chat.lastMessage.sent,
            delivered: chat.lastMessage.delivered,
            read: chat.lastMessage.read,
          },
        };
      } else {
        return chat;
      }
    });

    totalResults = await Chat.count(chatFilterObj);
    totalPages = Math.ceil(totalResults / 10);
  }

  // return chats;
  return { totalResults, totalPages, chats };
};

exports.getAllChatMessages = async (user, chatNumber, chatPage) => {
  const chat = await Chat.findOne({ client: chatNumber })
    .populate('contactName', 'name')
    .populate('lastSession', 'status secret');

  const page = chatPage || 1;

  let messages = [];
  let histories = [];
  let historyMessages = [];
  let lastSession;

  const messageFilteredBody = { chat: chat ? chat._id : '' };
  if (chat) {
    if (!user.secret) {
      messageFilteredBody.$or = [
        { secret: false },
        { secret: { $exists: false } },
      ];
    }

    messages = await Message.find(messageFilteredBody)
      .sort('-createdAt')
      .populate('user', 'firstName lastName photo')
      .populate({
        path: 'reply',
        populate: {
          path: 'user',
          select: { firstName: 1, lastName: 1, photo: 1 },
        },
      })
      .populate({
        path: 'userReaction.user',
        select: 'firstName lastName photo',
      })
      .populate({
        path: 'session',
        select: 'team',
        populate: { path: 'team', select: 'name' },
      })
      .limit(page * 20);

    histories = await ChatHistory.find({ chat: chat._id })
      .populate('user', 'firstName lastName')
      .populate('transfer.from', 'firstName lastName')
      .populate('transfer.to', 'firstName lastName')
      .populate('transfer.fromTeam', 'name')
      .populate('transfer.toTeam', 'name')
      .populate('takeOwnership.from', 'firstName lastName')
      .populate('takeOwnership.to', 'firstName lastName')
      .populate('start', 'firstName lastName')
      .populate('archive', 'firstName lastName');

    historyMessages = [...messages, ...histories].sort(
      (a, b) => a.createdAt - b.createdAt
    );

    lastSession = chat.lastSession;
  }

  let historyMessagesCopy = [...historyMessages];

  for (let i = 0; i < historyMessagesCopy.length; i++) {
    if (
      historyMessagesCopy[i].actionType &&
      historyMessagesCopy[i + 1]?.actionType
    ) {
      // Remove history item from array
      historyMessages = historyMessages.filter(
        (item) => item._id !== historyMessagesCopy[i]._id
      );
    } else {
      break;
    }
  }

  const totalResults = chat ? await Message.count(messageFilteredBody) : 0;
  const totalPages = Math.ceil(totalResults / 20);

  const chatSession = chat ? chat.session : null;
  const chatStatus = chat ? chat.status : null;
  const contactName = chat ? chat.contactName : null;
  // const currentUser = chat.currentUser;
  const currentUser = chat
    ? { _id: chat.currentUser, teamID: chat.team }
    : null;
  const notification = chat ? chat.notification : false;

  return {
    totalPages,
    totalResults,
    // messages: messages.reverse(),
    messages: historyMessages.reverse(),
    chatSession,
    chatStatus,
    contactName,
    currentUser,
    notification,
    lastSession,
  };
};

exports.getTabsStatuses = async (tabs) => {
  const tabsStatus = await Promise.all(
    tabs.map(async (tab) => {
      let chat = await Chat.findOne({ client: tab })
        .populate('lastMessage')
        .populate('contactName', 'name')
        .populate('lastSession', 'status secret')
        .lean();

      if (chat.lastMessage?.secret === true) {
        chat = {
          ...chat,
          lastMessage: {
            _id: chat.lastMessage._id,
            status: chat.lastMessage.status,
            received: chat.lastMessage.received,
            sent: chat.lastMessage.sent,
            delivered: chat.lastMessage.delivered,
            read: chat.lastMessage.read,
          },
        };
      }

      return { tab, chat: chat || { client: tab } };
    })
  );

  return tabsStatus;
};
