const mongoose = require('mongoose');

const dotenv = require('dotenv');
const http = require('http');
const socketio = require('socket.io');

process.on('uncaughtException', (err) => {
  console.log('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  console.log(err.name, err.message);
  process.exit(1);
});

dotenv.config({ path: './config.env' });

const app = require('./app');
const Message = require('./models/messageModel');
const Chat = require('./models/chatModel');
const appSocket = http.createServer(app);
const io = socketio(appSocket, {
  cors: { origin: '*' },
});

app.io = io;

io.on('connection', async (socket) => {
  socket.on('client_to_server', async (data) => {
    const chats = await Chat.find().sort('-updatedAt').populate('lastMessage');
    let messages = [];
    if (data.chatID) {
      messages = await Message.find({ chat: data.chatID })
        .sort('createdAt')
        .populate({
          path: 'user',
          select: { firstName: 1, lastName: 1, photo: 1 },
        })
        .populate('reply');
    }

    // Emit a response event back to the client
    socket.emit('server_to_client', { chats, messages });
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
  console.log(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});
