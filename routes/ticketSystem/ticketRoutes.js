const express = require('express');
const authController = require('./../../controllers/authController');
const ticketController = require('./../../controllers/ticketSystem/ticketController');
const commentRouter = require('./commentRoutes');

const router = express.Router();

router.use('/:ticketID/comments', commentRouter);

router
  .route('/')
  .get(
    authController.protect,
    authController.restrictToTasks('tickets'),
    ticketController.getAllTickets
  )
  .post(
    authController.protect,
    authController.restrictToTasks('tickets'),
    // ticketController.uploadMultiFiles,
    ticketController.createTicket
  );

router
  .route('/user-tickets')
  .get(
    authController.protect,
    authController.restrictToTasks('tickets'),
    ticketController.getAllUserTickets
  );

router
  .route('/:ticketID')
  .get(
    authController.protect,
    authController.restrictToTasks('tickets'),
    ticketController.getTicket
  )
  .patch(
    authController.protect,
    authController.restrictToTasks('tickets'),
    ticketController.updateTicket
  );

module.exports = router;
