const jwt = require('jsonwebtoken');
const { promisify } = require('util');

const User = require('../models/userModel');
const Chat = require('../models/chatModel');
const Message = require('../models/messageModel');
const Session = require('../models/sessionModel');

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

exports.getAllSessions = async (user) => {
  const userSessions = await Session.find({
    user: user._id,
    status: { $ne: 'finished' },
  });
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

  const teamSessions = await Session.find({
    team: user.team,
    status: { $ne: 'finished' },
  });
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

exports.getAllUserChats = async (user, status) => {
  let statuses = status.split(',');
  if (statuses.includes('all')) {
    statuses = ['open', 'onTime', 'danger', 'tooLate'];
  }

  let chats = await Chat.find({ currentUser: user._id })
    .sort('-updatedAt')
    .populate('lastMessage')
    .populate('lastSession', 'status');

  chats = chats.filter((chat) => statuses.includes(chat.lastSession?.status));

  return chats;
};

exports.getAllteamChats = async (user, status) => {
  let statuses = status.split(',');
  if (statuses.includes('all')) {
    statuses = ['open', 'onTime', 'danger', 'tooLate'];
  }

  let chats = await Chat.find({ team: user.team })
    .sort('-updatedAt')
    .populate('lastMessage')
    .populate('lastSession', 'status');
  // console.log('chats', chats.length);

  chats = chats.filter((chat) => statuses.includes(chat.lastSession?.status));

  return chats;
};

exports.getAllChatMessages = async (chatNumber) => {
  const chat = await Chat.findOne({ client: chatNumber });

  const messages = await Message.find({ chat: chat._id })
    .sort('createdAt')
    .populate('user', 'firstName lastName photo')
    .populate('reply');

  const chatSession = chat.session;

  const currentUser = chat.currentUser;

  return { messages, chatSession, currentUser };
};
