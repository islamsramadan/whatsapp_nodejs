const express = require('express');
const authController = require('../../controllers/authController');
const dashboardController = require('../../controllers/ticketSystem/ticketDashboardController');

const router = express.Router();

router
  .route('/numbers')
  .get(
    authController.protect,
    authController.restrictTo('admin'),
    authController.restrictToTasks('tickets'),
    dashboardController.getAllTicketsNumber
  );

router
  .route('/priority')
  .get(
    authController.protect,
    authController.restrictTo('admin'),
    authController.restrictToTasks('tickets'),
    dashboardController.getAllTicketsPriority
  );

router
  .route('/request-nature')
  .get(
    authController.protect,
    authController.restrictTo('admin'),
    authController.restrictToTasks('tickets'),
    dashboardController.getAllTicketRequestNature
  );

router
  .route('/request-type')
  .get(
    authController.protect,
    authController.restrictTo('admin'),
    authController.restrictToTasks('tickets'),
    dashboardController.getAllTicketRequestType
  );

router
  .route('/rating')
  .get(
    authController.protect,
    authController.restrictTo('admin'),
    authController.restrictToTasks('tickets'),
    dashboardController.getAllTicketsClientRating
  );

router
  .route('/average-solved')
  .get(
    authController.protect,
    authController.restrictTo('admin'),
    authController.restrictToTasks('tickets'),
    dashboardController.getWeeklySolvedTickets
  );

module.exports = router;
