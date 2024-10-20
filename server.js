const mongoose = require('mongoose');
const dotenv = require('dotenv');
const http = require('http');
const socketio = require('socket.io');
const jwt = require('jsonwebtoken');
const { promisify } = require('util');

const socketController = require('./controllers/socketController');
const ticketSocketController = require('./controllers/ticketSystem/ticketSocketController');

const AppError = require('./utils/appError');
const User = require('./models/userModel');

const fs = require('fs');
const path = require('path');

if (process.env.NODE_ENV === 'production') {
  // Create a write stream for the log file
  const logFile = fs.createWriteStream(path.join(__dirname, 'app.log'), {
    flags: 'a',
  });

  // Redirect console.log to write to the log file
  console.log = function (message) {
    logFile.write(`${new Date().toISOString()} - LOG: ${message}\n`);
  };

  // Redirect console.error to write to the log file
  console.error = function (message) {
    logFile.write(`${new Date().toISOString()} - ERROR: ${message}\n`);
  };
}

process.on('uncaughtException', (err) => {
  console.log('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  console.log(err.name, err.message);
  process.exit(1);
});

dotenv.config({ path: './config.env' });

const app = require('./app');

const appSocket = http.createServer(app);
const io = socketio(appSocket, {
  cors: { origin: '*' },
});

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

// To use socket io inside controller from req
app.io = io;
app.connectedUsers = {};

io.on('connection', async (socket) => {
  console.log(
    // 'connecting =========================================',
    socket.user._id
  );
  app.connectedUsers[socket.user._id] = socket;

  socket.on('client_to_server', async (data) => {
    // console.log('data ==========================================', data);

    if (data) {
      let userSessions,
        teamSessions,
        teamUsersSessions,
        chats,
        session,
        chatStatus,
        totalResults,
        totalPages,
        page,
        messages,
        contactName,
        currentUser,
        notification,
        lastSession,
        tabs,
        // =======tickets
        userTicketsfilters,
        teamTicketsfilters,
        teamUsersTicketsFilters,
        tickets,
        ticket,
        comments,
        ticketLogs,
        pastTickets,
        // =======notifications
        newNotifications,
        notifications,
        notificationTotalResults,
        notificationTotalPages,
        notificationPage;

      if (data.chatNumber) {
        let chatData = await socketController.getAllChatMessages(
          socket.user,
          data.chatNumber,
          data.page
        );
        totalPages = chatData.totalPages;
        totalResults = chatData.totalResults;
        messages = chatData.messages;
        session = chatData.chatSession;
        chatStatus = chatData.chatStatus;
        contactName = chatData.contactName;
        currentUser = chatData.currentUser;
        notification = chatData.notification;
        lastSession = chatData.lastSession;
      }
      if (data.chatsType === 'user') {
        chats = await socketController.getAllUserChats(
          socket.user,
          data.status || 'all'
        );
      }
      if (data.chatsType === 'team' && data.teamsIDs) {
        chats = await socketController.getAllteamChats(
          socket.user,
          data.status || 'all',
          data.teamsIDs
        );

        // console.log('chats.length', chats.length);
      }

      // ==============> Archived Chats
      if (data.chatsType === 'archived') {
        archivedChatsData = await socketController.getAllArchivedChats(
          data.userID,
          data.startDate,
          data.endDate,
          data.page
        );

        totalPages = archivedChatsData.totalPages;
        totalResults = archivedChatsData.totalResults;
        chats = archivedChatsData.chats;
      }

      // ==============> Team User Chats
      if (data.chatsType === 'teamUser' && data.teamUserID) {
        chats = await socketController.getAllTeamUserChats(data.teamUserID);
      }

      // ==============> Team & users sessions
      if (data.sessions === true && data.teamsIDs) {
        let sessions = await socketController.getAllSessions(
          socket.user,
          data.teamsIDs
        );
        userSessions = sessions.userSessions;
        teamSessions = sessions.teamSessions;
      }
      // ==============> Team users sessions
      if (data.teamUsersSessions === true && data.teamsIDs) {
        teamUsersSessions = await socketController.getAllTeamUsersSessions(
          data.teamsIDs
        );
      }

      // ==============> chat tabs
      if (data.tabs && data.tabs.length > 0) {
        tabs = await socketController.getTabsStatuses(data.tabs);
      }

      //============================= TICKETS ====================================
      // ==============> All Tickets List
      if (data.type === 'ticketsList') {
        const ticketsList = await ticketSocketController.getAllTicketsList(
          data
        );

        totalResults = ticketsList.totalResults;
        totalPages = ticketsList.totalPages;
        page = ticketsList.page;
        tickets = ticketsList.tickets;
      }

      // ==============> All User Tickets List
      if (data.type === 'userTicketsList') {
        const userTicketsList =
          await ticketSocketController.getAllUserTicketsList(data, socket.user);

        totalResults = userTicketsList.totalResults;
        totalPages = userTicketsList.totalPages;
        page = userTicketsList.page;
        tickets = userTicketsList.tickets;
      }

      // ==============> Team & user ticket filters
      if (data.type === 'ticketFilters' && data.teamsIDs) {
        const ticketFilters = await ticketSocketController.getAllTicketsFilters(
          socket.user,
          data.teamsIDs
        );
        userTicketsfilters = ticketFilters.userTicketsfilters;
        teamTicketsfilters = ticketFilters.teamTicketsfilters;
      }

      // ==============> Team users ticket filters
      if (data.type === 'teamUsersTicketFilters' && data.teamsIDs) {
        teamUsersTicketsFilters =
          await ticketSocketController.getTeamUsersTicketsFilters(
            data.teamsIDs
          );
      }

      // ==============> User Tickets
      if (data.type === 'userTickets' && data.status) {
        const userTickets = await ticketSocketController.getAllUserTickets(
          socket.user,
          data.status,
          data.page
        );
        totalResults = userTickets.totalResults;
        totalPages = userTickets.totalPages;
        page = userTickets.page;
        tickets = userTickets.tickets;
      }

      // ==============> Teams Tickets
      if (data.type === 'teamTickets' && data.teamsIDs && data.status) {
        const teamTickets = await ticketSocketController.getAllTeamTickets(
          data.teamsIDs,
          data.status,
          data.page
        );

        totalResults = teamTickets.totalResults;
        totalPages = teamTickets.totalPages;
        page = teamTickets.page;
        tickets = teamTickets.tickets;
      }

      // ==============> Team Users Tickets
      if (data.type === 'teamUsersTickets' && data.teamUserID) {
        const teamUsersTickets =
          await ticketSocketController.getAllTeamUserTickets(
            data.teamUserID,
            data.page
          );

        totalResults = teamUsersTickets.totalResults;
        totalPages = teamUsersTickets.totalPages;
        page = teamUsersTickets.page;
        tickets = teamUsersTickets.tickets;
      }

      // ==============> Ticket Details
      if (data.type === 'ticket' && data.ticketID) {
        const getTicket = await ticketSocketController.getTicket(data.ticketID);
        ticket = getTicket.ticket;
        comments = getTicket.comments;
        ticketLogs = getTicket.ticketLogs;
        pastTickets = getTicket.pastTickets;
      }

      if (data.type === 'notifications') {
        const notificationsData =
          await socketController.getAllUserNotifications(
            socket.user,
            data.notificationPage
          );
        newNotifications = notificationsData.newNotifications;
        notifications = notificationsData.notifications;
        notificationTotalResults = notificationsData.totalResults;
        notificationTotalPages = notificationsData.totalPages;
        notificationPage = notificationsData.page;
      }

      if (data.type === 'newNotifications') {
        newNotifications =
          await socketController.getAllUserNotificationsNumbers(socket.user);
      }

      // Emit a response event back to the client
      socket.emit('server_to_client', {
        userSessions,
        teamSessions,
        teamUsersSessions,
        chats,
        totalResults,
        totalPages,
        page,
        messages,
        session,
        chatStatus,
        contactName,
        currentUser,
        notification,
        lastSession,
        tabs,

        //=======tickets
        userTicketsfilters,
        teamTicketsfilters,
        teamUsersTicketsFilters,
        tickets,
        ticket,
        comments,
        ticketLogs,
        pastTickets,

        //=======notifications
        newNotifications,
        notifications,
        notificationTotalResults,
        notificationTotalPages,
        notificationPage,
      });
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

process.on('unhandledRejection', (err) => {
  console.log('UNHANDLED REJECTION! 💥 Shutting down...');
  console.log(err.name, err.message, err);
  server.close(() => {
    process.exit(1);
  });
});
