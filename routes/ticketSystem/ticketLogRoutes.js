const express = require('express');

const authController = require('../../controllers/authController');
const ticketLogController = require('../../controllers/ticketSystem/ticketLogController');

const router = express.Router({ mergeParams: true });

router
  .route('/')
  .get(
    authController.protect,
    authController.restrictToTasks('tickets'),
    ticketLogController.getAllTicketLogs
  );

module.exports = router;
