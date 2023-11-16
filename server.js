const mongoose = require('mongoose');
const dotenv = require('dotenv');
const http = require('http');
const socketio = require('socket.io');
const jwt = require('jsonwebtoken');
const { promisify } = require('util');
const cron = require('node-cron');

const socketController = require('./controllers/socketController');
const sessionTimerUpdate = require('./utils/sessionTimerUpdate');

process.on('uncaughtException', (err) => {
  console.log('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  console.log(err.name, err.message);
  process.exit(1);
});

dotenv.config({ path: './config.env' });

const app = require('./app');
const Message = require('./models/messageModel');
const Chat = require('./models/chatModel');
const AppError = require('./utils/appError');
const User = require('./models/userModel');
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
  // console.log('currentUser', currentUser);
  next();
});

// To use socket io inside controller from req
app.io = io;
app.connectedUsers = {};

io.on('connection', async (socket) => {
  app.connectedUsers[socket.user._id] = socket;

  socket.on('client_to_server', async (data) => {
    // console.log('data ===================', data);

    let userSessions, teamSessions, chats, chatSession, messages;

    if (data.chatNumber) {
      let chatData = await socketController.getAllChatMessages(data.chatNumber);
      messages = chatData.messages;
      chatSession = chatData.chatSession;
      currentUser = chatData.currentUser;
    }
    if (data.chatsType === 'user') {
      chats = await socketController.getAllUserChats(
        socket.user,
        data.status || 'all'
      );
    }
    if (data.chatsType === 'team') {
      chats = await socketController.getAllteamChats(
        socket.user,
        data.status || 'all'
      );

      console.log('chats.length', chats.length);
    }
    if (data.sessions === true) {
      let sessions = await socketController.getAllSessions(socket.user);
      userSessions = sessions.userSessions;
      teamSessions = sessions.teamSessions;
    }
    // Emit a response event back to the client
    socket.emit('server_to_client', {
      userSessions,
      teamSessions,
      chats,
      messages,
      chatSession,
      currentUser,
    });
  });

  socket.on('disconnect', () => {
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
    const delay = 100;
    // Schedule the update task
    const cronExpression = `*/${delay / 60000} * * * * *`; // Your schedule
    cron.schedule(cronExpression, () => {
      sessionTimerUpdate.updateDocumentsBasedOnTimer(client);
    });
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
