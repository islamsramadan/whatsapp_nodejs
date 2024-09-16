const express = require('express');

const clientTicketController = require('../../controllers/ticketSystem/clientTicketController');

const router = express.Router();

router
  .route('/')
  .get(
    clientTicketController.protectClientTicket,
    clientTicketController.getClientTicket
  );

router
  .route('/feedback')
  .patch(
    clientTicketController.protectClientTicket,
    clientTicketController.sendFeedback
  );

module.exports = router;
