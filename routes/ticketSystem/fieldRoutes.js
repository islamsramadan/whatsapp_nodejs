const express = require('express');

const authController = require('../../controllers/authController');
const fieldController = require('../../controllers/ticketSystem/fieldController');

const router = express.Router();

router
  .route('/')
  .get(authController.protect, fieldController.getAllFields)
  .post(authController.protect, fieldController.createField);

router
  .route('/:fieldID')
  .get(authController.protect, fieldController.getField)
  .patch(authController.protect, fieldController.updateField);

module.exports = router;
