const express = require('express');

const authController = require('../../controllers/authController');
const fieldTypeController = require('../../controllers/ticketSystem/fieldTypeController');

const router = express.Router();

router
  .route('/')
  .get(authController.protect, fieldTypeController.getAllFieldTypes)
  .post(authController.protect, fieldTypeController.createFieldType);

router
  .route('/multi')
  .post(authController.protect, fieldTypeController.createMultiFieldTypes);

module.exports = router;
