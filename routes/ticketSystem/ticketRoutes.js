const express = require('express');
const authController = require('./../../controllers/authController');
const ticketController = require('./../../controllers/ticketSystem/ticketController');
const commentRouter = require('./commentRoutes');
const ticketLogRouter = require('./ticketLogRoutes');

const router = express.Router();

router.use('/:ticketID/comments', commentRouter);
router.use('/:ticketID/ticket-logs', ticketLogRouter);

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
  );

router
  .route('/:ticketID/info')
  .patch(
    authController.protect,
    authController.restrictToTasks('tickets'),
    ticketController.updateTicketInfo
  );

router
  .route('/:ticketID/transfer')
  .patch(
    authController.protect,
    authController.restrictToTasks('tickets'),
    ticketController.transferTicket
  );

router
  .route('/:ticketID/take-ownership')
  .patch(
    authController.protect,
    authController.restrictToTasks('tickets'),
    ticketController.takeTicketOwnership
  );

router
  .route('/:ticketID/form')
  .patch(
    authController.protect,
    authController.restrictToTasks('tickets'),
    ticketController.updateTicketForm
  );

router
  .route('/:ticketID/client')
  .patch(
    authController.protect,
    authController.restrictToTasks('tickets'),
    ticketController.updateTicketClientData
  );

router
  .route('/:ticketID/past-tickets')
  .get(
    authController.protect,
    authController.restrictToTasks('tickets'),
    ticketController.getAllPastTickets
  );

module.exports = router;
