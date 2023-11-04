const express = require('express');
const sessionController = require('./../controllers/sessionController');
const authController = require('./../controllers/authController');

const router = express.Router();

router.route('/').get(authController.protect, sessionController.getAllSessions);
//   .post(authController.protect, teamController.createTeam);

// router
//   .route('/:id')
//   .get(authController.protect, teamController.getTeam)
//   .patch(
//     authController.protect,
//     teamController.uploadTeamPhoto,
//     teamController.updateTeam
//   )
//   .delete(authController.protect, teamController.deleteTeam);

module.exports = router;
