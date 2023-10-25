const mongoose = require('mongoose');
const dotenv = require('dotenv');
const http = require('http');
const socketio = require('socket.io');
const jwt = require('jsonwebtoken');
const { promisify } = require('util');

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
  // 1) Getting token and check if it is there
  let token;
  if (
    socket.handshake.query.token &&
    socket.handshake.query.token.startsWith('Bearer')
  ) {
    token = socket.handshake.query.token.split(' ')[1];
  }
  // console.log('token', token);

  if (!token) {
    return next(new AppError('Authentication error: Token missing!', 401));
  }

  // 2) Verification token
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
  // console.log('decoded', decoded);

  // 3) Check if user still exists
  const currentUser = await User.findById(decoded.id);
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

  // GRANT ACCESS TO PROTECTED ROUTE
  socket.user = currentUser;
  // console.log('currentUser', currentUser);
  next();
});

// To use socket io inside controller from req
app.io = io;

io.on('connection', async (socket) => {
  socket.on('client_to_server', async (data) => {
    const chats = await Chat.find().sort('-updatedAt').populate('lastMessage');
    let messages = [];
    let chatSession;
    if (data.chatNumber) {
      const chat = await Chat.findOne({ client: data.chatNumber });
      messages = await Message.find({ chat: chat._id })
        .sort('createdAt')
        .populate({
          path: 'user',
          select: { firstName: 1, lastName: 1, photo: 1 },
        })
        .populate('reply');
      chatSession = chat.session;
    }

    // Emit a response event back to the client
    socket.emit('server_to_client', { chats, messages, chatSession });
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
  .then(() => {
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
