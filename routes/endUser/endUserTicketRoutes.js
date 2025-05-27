const express = require('express');

const endUserAuthController = require('../../controllers/endUser/endUserAuthController');
const endUserTicketController = require('../../controllers/endUser/endUserTicketController');

const router = express.Router();

router
  .route('/')
  .get(
    endUserAuthController.protectEndUser,
    endUserTicketController.getAllEndUserTickets
  )
  .post(
    endUserAuthController.protectEndUser,
    endUserTicketController.createEndUserTicket
  );

router
  .route('/:ticketID')
  .get(
    endUserAuthController.protectEndUser,
    endUserTicketController.getEndUserTicket
  );

router
  .route('/:ticketID/past-tickets')
  .get(
    endUserAuthController.protectEndUser,
    endUserTicketController.getAllEndUserPastTickets
  );

router
  .route('/:ticketID/feedback')
  .patch(
    endUserAuthController.protectEndUser,
    endUserTicketController.sendFeedback
  );

router
  .route('/:ticketID/comment')
  .patch(
    endUserAuthController.protectEndUser,
    endUserTicketController.uploadMultiFiles,
    endUserTicketController.createEndUserComment
  );

module.exports = router;
