const express = require('express');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const cors = require('cors');

const AppError = require('./utils/appError');
const globalErrorHandler = require('./controllers/errorController');

const routes = require('./routes/index');

const app = express();

// *********************** 1) MIDDLEWARES ***************************
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

app.use(cors());

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
app.use('/api/v1', routes);

// Not found route
app.all('*', (req, res, next) => {
  console.log(req);
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// global error middleware
app.use(globalErrorHandler);

module.exports = app;
