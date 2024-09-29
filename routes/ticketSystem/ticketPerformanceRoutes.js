const express = require('express');

const authController = require('./../../controllers/authController');
const ticketPerformanceController = require('../../controllers/ticketSystem/ticketPerformanceController');

const router = express.Router();

router
  .route('/')
  .get(
    authController.protect,
    ticketPerformanceController.getTicketPerformance
  );

module.exports = router;
