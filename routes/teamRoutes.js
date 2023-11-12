const express = require('express');
const teamController = require('./../controllers/teamController');
const authController = require('./../controllers/authController');

const router = express.Router();

router
  .route('/')
  .get(authController.protect, teamController.getAllTeams)
  .post(
    authController.protect,
    authController.restrictTo('admin'),
    teamController.createTeam
  );

router
  .route('/:id')
  .get(authController.protect, teamController.getTeam)
  .patch(
    authController.protect,
    teamController.uploadTeamPhoto,
    // restrict with supervisor in update function
    teamController.updateTeam
  )
  .delete(
    authController.protect,
    authController.restrictTo('admin'),
    teamController.deleteTeam
  );

module.exports = router;
