const express = require('express');
const sessionController = require('./../controllers/sessionController');
const authController = require('./../controllers/authController');

const router = express.Router();

router
  .route('/all/:teamsIDs')
  .get(authController.protect, sessionController.getAllSessions);

router
  .route('/teams/:teamsIDs')
  .get(
    authController.protect,
    authController.restrictTo('admin'),
    sessionController.getTeamUsersSessions
  );

module.exports = router;
