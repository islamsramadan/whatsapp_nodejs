const express = require('express');

const authController = require('../../controllers/authController');
const fieldController = require('../../controllers/ticketSystem/fieldController');

const router = express.Router();

router
  .route('/')
  .get(
    authController.protect,
    authController.restrictToTasks('tickets'),
    authController.restrictTo('admin'),
    fieldController.getAllFields
  )
  .post(
    authController.protect,
    authController.restrictToTasks('tickets'),
    authController.restrictTo('admin'),
    fieldController.createField
  );

router
  .route('/:fieldID')
  .get(
    authController.protect,
    authController.restrictToTasks('tickets'),
    authController.restrictTo('admin'),
    fieldController.getField
  )
  .patch(
    authController.protect,
    authController.restrictToTasks('tickets'),
    authController.restrictTo('admin'),
    fieldController.updateField
  );

module.exports = router;
