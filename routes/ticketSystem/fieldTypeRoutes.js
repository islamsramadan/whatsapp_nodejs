const express = require('express');

const authController = require('../../controllers/authController');
const fieldTypeController = require('../../controllers/ticketSystem/fieldTypeController');

const router = express.Router();

router
  .route('/')
  .get(
    authController.protect,
    authController.restrictToTasks('tickets'),
    authController.restrictTo('admin'),
    fieldTypeController.getAllFieldTypes
  )
  .post(
    authController.protect,
    authController.restrictToTasks('tickets'),
    authController.restrictTo('admin'),
    fieldTypeController.createFieldType
  );

router
  .route('/multi')
  .post(
    authController.protect,
    authController.restrictToTasks('tickets'),
    authController.restrictTo('admin'),
    fieldTypeController.createMultiFieldTypes
  );

module.exports = router;
