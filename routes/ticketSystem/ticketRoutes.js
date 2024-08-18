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

router
  .route('/:ticketID/client')
  .patch(
    authController.protect,
    authController.restrictToTasks('tickets'),
    ticketController.updateTicketClientData
  );

router
  .route('/:ticketID/form')
  .patch(
    authController.protect,
    authController.restrictToTasks('tickets'),
    ticketController.updateTicketForm
  );

module.exports = router;
