const express = require('express');
const sessionController = require('./../controllers/sessionController');
const authController = require('./../controllers/authController');

const router = express.Router();

router
  .route('/:teamsIDs')
  .get(authController.protect, sessionController.getAllSessions);

module.exports = router;
