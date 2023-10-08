const express = require('express');
const authController = require('./../controllers/authController');
const whatsappTemplateController = require('./../controllers/whatsappTemplateController');

const router = express.Router();

router
  .route('/')
  .get(
    authController.protect,
    whatsappTemplateController.getAllWhatsappTemplates
  )
  .post(
    authController.protect,
    whatsappTemplateController.createWhatsappTemplate
  );

// router
//   .route('/')
//   .get(authController.protect, teamController.getAllTeams)
//   .post(authController.protect, teamController.createTeam);

// router
//   .route('/:id')
//   .get(authController.protect, teamController.getTeam)
//   .patch(authController.protect, teamController.updateTeam)
//   .delete(authController.protect, teamController.deleteTeam);

module.exports = router;
