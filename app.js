const express = require('express');
const morgan = require('morgan');
const bodyParser = require('body-parser');

const AppError = require('./utils/appError');
const globalErrorHandler = require('./controllers/errorController');

const webhookRouter = require('./routes/webhookRoutes');
const userRouter = require('./routes/userRoutes');
const answerRouter = require('./routes/answerRoutes');
const answersSetRouter = require('./routes/answersSetRoutes');
const conversationRouter = require('./routes/conversationRoutes');
const serviceRouter = require('./routes/serviceRoutes');
const departmentRouter = require('./routes/departmentRoutes');
const chatRouter = require('./routes/chatRoutes');
const messageRouter = require('./routes/messageRoutes');

const app = express();

// *********************** 1) MIDDLEWARES ***************************
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

app.use(bodyParser.json());
// Body parser, reading data from body into req.body
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

app.use(express.json());
app.use(express.static(`${__dirname}/public`));

app.use((req, res, next) => {
  req.requestTime = new Date().toISOString();
  next();
});

// *********************** 2) Routes ***************************

app.use('/webhook', webhookRouter);
app.use('/api/users', userRouter);
app.use('/api/answers', answerRouter);
app.use('/api/answers-sets', answersSetRouter);
app.use('/api/conversations', conversationRouter);
app.use('/api/services', serviceRouter);
app.use('/api/departments', departmentRouter);
app.use('/api/chats', chatRouter);
app.use('/api/messages', messageRouter);

// Not found route
app.all('*', (req, res, next) => {
  console.log(req);
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// global error middleware
app.use(globalErrorHandler);

module.exports = app;
