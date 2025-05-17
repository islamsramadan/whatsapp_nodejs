const mongoose = require('mongoose');
const dotenv = require('dotenv');
const http = require('http');
const socketio = require('socket.io');
const jwt = require('jsonwebtoken');
const { promisify, inspect } = require('util');
const cron = require('node-cron');

const socketController = require('./controllers/socketController');
const ticketSocketController = require('./controllers/ticketSystem/ticketSocketController');
const endUserSocketController = require('./controllers/endUser/endUserSocketController');
const endUserNotificationController = require('./controllers/endUser/endUserNotificationController');

const AppError = require('./utils/appError');
const User = require('./models/userModel');

const fs = require('fs');
const path = require('path');

if (process.env.NODE000_ENV === 'production') {
  // Create a write stream for the log file
  const logFile = fs.createWriteStream(path.join(__dirname, 'customLogs.log'), {
    flags: 'a',
  });

  const originalLog = console.log;
  const originalError = console.error;

  // Redirect console.log to write to the log file
  console.log = function (...messages) {
    messages.map((message) => {
      logFile.write(
        `${new Date().toISOString()} - LOG: ${inspect(message, {
          depth: null,
        })}\n`
      );
      originalLog(message); // preserve original behavior
    });
  };

  // Redirect console.error to write to the log file
  console.error = function (...messages) {
    messages.map((message) => {
      logFile.write(
        `${new Date().toISOString()} - ERROR: ${inspect(message, {
          depth: null,
        })}\n`
      );
      originalError(message);
    });
  };
}

process.on('uncaughtException', (err) => {
  console.log('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  console.log(err.name, err.message);
  process.exit(1);
});

dotenv.config({ path: './config.env' });

const app = require('./app');
const EndUser = require('./models/endUser/endUserModel');

const appSocket = http.createServer(app);
const io = socketio(appSocket, {
  cors: { origin: '*' },
});

// To use socket io inside controller from req
app.io = io;
app.connectedUsers = {};
app.connectedEndUsers = {};

const chatSocketHandler = async (socket, data) => {
  let response = {};

  // ==============> All Chat Messages
  if (data.chatID) {
    const chatData = await socketController.getAllChatMessages(
      socket.user,
      data.chatID,
      data.page
    );

    response = {
      totalPages: chatData.totalPages,
      totalResults: chatData.totalResults,
      messages: chatData.messages,
      session: chatData.chatSession,
      chatStatus: chatData.chatStatus,
      contactName: chatData.contactName,
      currentUser: chatData.currentUser,
      notification: chatData.notification,
      lastSession: chatData.lastSession,
    };
  }

  // ==============> User Chats
  else if (data.chatsType === 'user') {
    const chats = await socketController.getAllUserChats(
      socket.user,
      data.status || 'all'
    );

    response = { chats };
  }

  // ==============> Team Chats
  else if (data.chatsType === 'team' && data.teamsIDs) {
    const chats = await socketController.getAllteamChats(
      socket.user,
      data.status || 'all',
      data.teamsIDs
    );

    response = { chats };
  }

  // ==============> Archived Chats
  else if (data.chatsType === 'archived') {
    const archivedChatsData = await socketController.getAllArchivedChats(
      data.userID,
      data.startDate,
      data.endDate,
      data.page
    );

    response = {
      totalPages: archivedChatsData.totalPages,
      totalResults: archivedChatsData.totalResults,
      chats: archivedChatsData.chats,
    };
  }

  // ==============> Team User Chats
  else if (data.chatsType === 'teamUser' && data.teamUserID) {
    const chats = await socketController.getAllTeamUserChats(data.teamUserID);

    response = { chats };
  }

  // ==============> Team & users sessions
  else if (data.sessions === true && data.teamsIDs) {
    const sessions = await socketController.getAllSessions(
      socket.user,
      data.teamsIDs
    );

    response = {
      userSessions: sessions.userSessions,
      teamSessions: sessions.teamSessions,
    };
  }

  // ==============> Team users sessions
  else if (data.teamUsersSessions === true && data.teamsIDs) {
    const teamUsersSessions = await socketController.getAllTeamUsersSessions(
      data.teamsIDs
    );

    response = { teamUsersSessions };
  }

  // ==============> chat tabs
  else if (data.tabs && data.tabs.length > 0) {
    const tabs = await socketController.getTabsStatuses(data.tabs);

    response = { tabs };
  }

  return response;
};

const ticketSocketHandler = async (socket, data) => {
  let response = {};

  // ==============> All Tickets List
  if (data.type === 'ticketsList') {
    const ticketsList = await ticketSocketController.getAllTicketsList(data);

    response = {
      totalResults: ticketsList.totalResults,
      totalPages: ticketsList.totalPages,
      page: ticketsList.page,
      tickets: ticketsList.tickets,
    };
  }

  // ==============> All User Tickets List
  else if (data.type === 'userTicketsList') {
    const userTicketsList = await ticketSocketController.getAllUserTicketsList(
      data,
      socket.user
    );

    response = {
      totalResults: userTicketsList.totalResults,
      totalPages: userTicketsList.totalPages,
      page: userTicketsList.page,
      tickets: userTicketsList.tickets,
    };
  }

  // ==============> Team & user ticket filters
  else if (data.type === 'ticketFilters' && data.teamsIDs) {
    const ticketFilters = await ticketSocketController.getAllTicketsFilters(
      socket.user,
      data.teamsIDs
    );

    response = {
      userTicketsfilters: ticketFilters.userTicketsfilters,
      teamTicketsfilters: ticketFilters.teamTicketsfilters,
    };
  }

  // ==============> Team users ticket filters
  else if (data.type === 'teamUsersTicketFilters' && data.teamsIDs) {
    teamUsersTicketsFilters =
      await ticketSocketController.getTeamUsersTicketsFilters(data.teamsIDs);

    response = { teamUsersTicketsFilters };
  }

  // ==============> User Tickets
  else if (data.type === 'userTickets' && data.status) {
    const userTickets = await ticketSocketController.getAllUserTickets(
      socket.user,
      data.status,
      data.page
    );

    response = {
      totalResults: userTickets.totalResults,
      totalPages: userTickets.totalPages,
      page: userTickets.page,
      tickets: userTickets.tickets,
    };
  }

  // ==============> Teams Tickets
  else if (data.type === 'teamTickets' && data.teamsIDs && data.status) {
    const teamTickets = await ticketSocketController.getAllTeamTickets(
      data.teamsIDs,
      data.status,
      data.page
    );

    response = {
      totalResults: teamTickets.totalResults,
      totalPages: teamTickets.totalPages,
      page: teamTickets.page,
      tickets: teamTickets.tickets,
    };
  }

  // ==============> Team Users Tickets
  else if (data.type === 'teamUsersTickets' && data.teamUserID) {
    const teamUsersTickets = await ticketSocketController.getAllTeamUserTickets(
      data.teamUserID,
      data.page
    );

    response = {
      totalResults: teamUsersTickets.totalResults,
      totalPages: teamUsersTickets.totalPages,
      page: teamUsersTickets.page,
      tickets: teamUsersTickets.tickets,
    };
  }

  // ==============> Ticket Details
  else if (data.type === 'ticket' && data.ticketID) {
    const getTicket = await ticketSocketController.getTicket(data.ticketID);

    response = {
      ticket: getTicket.ticket,
      comments: getTicket.comments,
      ticketLogs: getTicket.ticketLogs,
      pastTickets: getTicket.pastTickets,
    };
  }

  return response;
};

const notificationSocketHandler = async (socket, data) => {
  let response = {};

  if (data.type === 'notifications') {
    const notificationsData = await socketController.getAllUserNotifications(
      socket.user,
      data.notificationPage
    );
    response = {
      newNotifications: notificationsData.newNotifications,
      notifications: notificationsData.notifications,
      notificationTotalResults: notificationsData.totalResults,
      notificationTotalPages: notificationsData.totalPages,
      notificationPage: notificationsData.page,
    };
  } else if (data.type === 'newNotifications') {
    const newNotifications =
      await socketController.getAllUserNotificationsNumbers(socket.user);
    response = { newNotifications };
  }

  return response;
};

// const userNamespace = io.of('/user');
const endUserNamespace = io.of('/endUser');

// app.io.user = userNamespace;
app.io.endUser = endUserNamespace;

// Authenticating socket request
io.use(async (socket, next) => {
  // console.log('socket ===========', socket);
  // 1) Getting token and check if it is there
  let token;
  if (
    socket.handshake.query.token &&
    socket.handshake.query.token.startsWith('Bearer')
  ) {
    token = socket.handshake.query.token.split(' ')[1];
  }
  // console.log('token ===========================', token);

  if (!token) {
    return next(new AppError('Authentication error: Token missing!', 401));
  }

  // 2) Verification token
  // const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
  // // console.log('decoded', decoded);

  let decoded;
  try {
    decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
    console.log('decoded', decoded);
  } catch (error) {
    console.error('Error verifying token:', error);
    return;
  }

  // 3) Check if user still exists
  const currentUser = await User.findOne({
    _id: decoded.id,
    deleted: false,
  }).select('+token');

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
  // console.log('currentUser', currentUser);
  next();
});

io.on('connection', async (socket) => {
  console.log(
    // 'connecting =========================================',
    socket.user._id
  );
  app.connectedUsers[socket.user._id] = socket;

  socket.on('client_to_server', async (data) => {
    console.log('data ==========================================', data);

    if (data) {
      let response = {};

      if (data.category === 'chats') {
        response = await chatSocketHandler(socket, data);
      } else if (data.category === 'tickets') {
        response = await ticketSocketHandler(socket, data);
      } else if (data.category === 'notifications') {
        response = await notificationSocketHandler(socket, data);
      } else if (data.category === 'endUser') {
      }

      console.log('response', response);

      // Emit a response event back to the client
      socket.emit('server_to _client', response);
    }
  });

  socket.on('disconnect', () => {
    // console.log(
    //   'disconnect =========================================',
    //   socket.user._id
    // );
    delete app.connectedUsers[socket.user._id];
  });
});

endUserNamespace.use(async (socket, next) => {
  // console.log('socket ===========', socket);
  // 1) Getting token and check if it is there
  let token;
  if (
    socket.handshake.query.token &&
    socket.handshake.query.token.startsWith('Bearer')
  ) {
    token = socket.handshake.query.token.split(' ')[1];
  }
  // console.log('token ===========================', token);

  if (!token) {
    return next(new AppError('Authentication error: Token missing!', 401));
  }

  // 2) Verification token
  // const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
  // // console.log('decoded', decoded);

  let decoded;
  try {
    decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
    console.log('decoded', decoded);
  } catch (error) {
    console.error('Error verifying token:', error);
    return;
  }

  // 3) Check if user still exists
  const currentEndUser = await EndUser.findById(decoded.id).select('+token');
  if (!currentEndUser) {
    return next(
      new AppError(
        'The End user belonging to this token does no longer exist!',
        401
      )
    );
  }

  // 4) check if it is the same token in db as it is the last login
  if (currentEndUser.token && currentEndUser.token !== token) {
    return next(new AppError('Invalid token!', 401));
  }

  // Remove token from the user to send it in the req
  currentEndUser.token = undefined;

  // GRANT ACCESS TO PROTECTED ROUTE
  socket.endUser = currentEndUser;
  // console.log('currentEndUser', currentEndUser);
  next();
});

endUserNamespace.on('connection', (socket) => {
  console.log(
    'connecting =========================================',
    socket.endUser
  );
  app.connectedEndUsers[socket.endUser._id] = socket;

  socket.on('client_to_server', async (data) => {
    console.log('data ==========================================', data);

    if (data) {
      let response = {};

      if (data.type === 'ticketsList') {
        response = await endUserSocketController.getAllEndUserTickets(
          socket,
          data
        );
      } else if (data.type === 'ticket' && data.ticketID) {
        response = await endUserSocketController.getEndUserTicket(socket, data);
      } else if (data.type === 'messagesList') {
        response = await endUserSocketController.getAllEndUserMessages(
          socket,
          data
        );
      } else if (data.type === 'newNotifications') {
        response = await endUserSocketController.getAllEndUserNewNotifications(
          socket,
          data
        );
      } else if (data.type === 'notifications') {
        response = await endUserSocketController.getAllEndUserNotifications(
          socket,
          data
        );
      }

      console.log('response', response);

      // Emit a response event back to the client
      socket.emit('server_to _client', response);
    }
  });

  socket.on('disconnect', () => {
    console.log(
      'disconnect =========================================',
      socket.endUser._id
    );
    delete app.connectedEndUsers[socket.endUser._id];
  });
});

const DB = process.env.DATABASE.replace(
  '<PASSWORD>',
  process.env.DATABASE_PASSWORD
);
mongoose
  .connect(DB, {
    useNewUrlParser: true,
    // useCreateIndex: true,
    // useFindAndModify: false,
  })
  .then((client) => {
    console.log('DB connected successfully!!');
  });

const port = process.env.PORT || 8080;
const server = appSocket.listen(port, () => {
  console.log(`server is running on port: ${port} ...`);
});

// Send end user notifications
cron.schedule('*/1 * * * *', async () => {
  try {
    await endUserNotificationController.sendEndUserNotifications();
  } catch (err) {
    console.error('Error in scheduled task:', err);
  }
});

process.on('unhandledRejection', (err) => {
  console.log('UNHANDLED REJECTION! 💥 Shutting down...');
  console.log(err.name, err.message, err);
  server.close(() => {
    process.exit(1);
  });
});
