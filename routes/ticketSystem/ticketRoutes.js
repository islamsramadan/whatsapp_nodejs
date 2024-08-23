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
  );

router
  .route('/:ticketID/info')
  .patch(
    authController.protect,
    authController.restrictToTasks('tickets'),
    ticketController.updateTicketInfo
  );

router
  .route('/:ticketID/reassign')
  .patch(
    authController.protect,
    authController.restrictToTasks('tickets'),
    ticketController.reassignTicket
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

module.exports = router;
