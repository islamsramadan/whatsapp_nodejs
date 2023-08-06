const express = require('express');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const axios = require('axios');

const AppError = require('./utils/appError');
const globalErrorHandler = require('./controllers/errorController');
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

//to verify the callback url from the dashboard side - cloud api side
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const challenge = req.query['hub.challenge'];
  const token = req.query['hub.verify_token'];

  const myToken = 'islamlaam';

  console.log('mode', mode);
  console.log('token', token);

  if (mode && token) {
    if (mode === 'subscribe' && token === myToken) {
      res.status(200).send(challenge);
    } else {
      res.status(403);
    }
  }
});

app.post('/webhook', (req, res) => {
  console.log(JSON.stringify(req.body));

  if (req.body.object) {
    if (
      req.body.entery &&
      req.body.entery[0].changes &&
      req.body.entery[0].changes[0].value.messages &&
      req.body.entery[0].changes[0].value.messages[0]
    ) {
      const phoneNumberID =
        req.body.entery[0].changes[0].value.metadata.phone_number_id;
      const from = req.body.entery[0].changes[0].value.messages[0].from;
      const msgBody = req.body.entery[0].changes[0].value.messages[0].text.body;

      axios.post(
        `https://graph.facebook.com/v17.0/${phoneNumberID}/messages`,
        {
          messaging_product: 'whatsapp',
          to: from,
          text: {
            body: "hello it's me",
          },
        },
        {
          Headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          },
        }
      );

      res.status(200);
    } else {
      res.status(404);
    }
  }
});

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
