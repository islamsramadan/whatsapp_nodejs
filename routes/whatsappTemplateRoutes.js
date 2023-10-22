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

module.exports = router;
