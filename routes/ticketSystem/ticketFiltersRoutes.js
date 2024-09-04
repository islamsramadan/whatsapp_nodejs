const express = require('express');

const authController = require('./../../controllers/authController');
const ticketFiltersController = require('./../../controllers/ticketSystem/ticketFiltersController');

const router = express.Router();

router
  .route('/filters/:teamsIDs')
  .get(
    authController.protect,
    authController.restrictToTasks('tickets'),
    ticketFiltersController.getAllTicketsFilters
  );

router
  .route('/filters/:teamsIDs/team-users')
  .get(
    authController.protect,
    authController.restrictToTasks('tickets'),
    authController.restrictTo('admin'),
    ticketFiltersController.getTeamUsersTicketsFilters
  );

router
  .route('/tickets/user')
  .get(
    authController.protect,
    authController.restrictToTasks('tickets'),
    ticketFiltersController.getAllUserTickets
  );

router
  .route('/tickets/teams/:teamsIDs')
  .get(
    authController.protect,
    authController.restrictToTasks('tickets'),
    ticketFiltersController.getAllTeamTickets
  );

module.exports = router;
