const express = require('express');
const authController = require('../../controllers/authController');
const ticketController = require('../../controllers/ticketSystem/ticketController');
const endUserTicketController = require('../../controllers/endUser/endUserTicketController');
const endUserAuthController = require('../../controllers/endUser/endUserAuthController');
// const commentRouter = require('./commentRoutes');
// const ticketLogRouter = require('./ticketLogRoutes');

const router = express.Router();

// router.use('/:ticketID/comments', commentRouter);
// router.use('/:ticketID/ticket-logs', ticketLogRouter);

router
  .route('/token')
  .post(
    endUserAuthController.protectEndUserApp,
    endUserAuthController.getOrCreateEndUserToken
  );

router
  .route('/tickets')
  .get(
    endUserAuthController.protectEndUser,
    endUserTicketController.getAllEndUserTickets
  )
  .post(
    endUserAuthController.protectEndUser,
    endUserTicketController.createEndUserTicket
  );

router
  .route('/ticket-categories')
  .get(
    endUserAuthController.protectEndUser,
    endUserTicketController.getAllEndUserTicketCategories
  );

router
  .route('/tickets/:ticketID')
  .get(
    endUserAuthController.protectEndUser,
    endUserTicketController.getEndUserTicket
  );

router
  .route('/tickets/:ticketID/past-tickets')
  .get(
    endUserAuthController.protectEndUser,
    endUserTicketController.getAllEndUserPastTickets
  );

router
  .route('/tickets/:ticketID/feedback')
  .patch(
    endUserAuthController.protectEndUser,
    endUserTicketController.sendFeedback
  );

router
  .route('/tickets/:ticketID/comment')
  .patch(
    endUserAuthController.protectEndUser,
    endUserTicketController.uploadMultiFiles,
    endUserTicketController.createEndUserComment
  );

module.exports = router;
