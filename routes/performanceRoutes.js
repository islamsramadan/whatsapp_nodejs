const express = require('express');
const sessionController = require('./../controllers/sessionController');
const performanceController = require('./../controllers/performanceController');
const authController = require('./../controllers/authController');

const router = express.Router();

router
  .route('/')
  .get(authController.protect, performanceController.getAllPerformance);

module.exports = router;
