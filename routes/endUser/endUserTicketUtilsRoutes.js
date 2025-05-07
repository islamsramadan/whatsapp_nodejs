const express = require('express');

const endUserAuthController = require('../../controllers/endUser/endUserAuthController');
const endUserTicketController = require('../../controllers/endUser/endUserTicketController');

const router = express.Router();

router
  .route('/ticket-categories')
  .get(
    endUserAuthController.protectEndUser,
    endUserTicketController.getAllEndUserTicketCategories
  );

router
  .route('/ticket-statuses')
  .get(
    endUserAuthController.protectEndUser,
    endUserTicketController.getAllEndUserTicketStatuses
  );

router
  .route('/teams')
  .get(
    endUserAuthController.protectEndUser,
    endUserTicketController.getAllTicketsTeams
  );

module.exports = router;
