const express = require('express');

const authController = require('../../controllers/authController');
const formController = require('../../controllers/ticketSystem/formController');

const router = express.Router();

router
  .route('/')
  .get(
    authController.protect,
    authController.restrictToTasks('tickets'),
    formController.getAllForms
  )
  .post(
    authController.protect,
    authController.restrictToTasks('tickets'),
    authController.restrictTo('admin'),
    formController.createForm
  );

router
  .route('/order')
  .patch(
    authController.protect,
    authController.restrictToTasks('tickets'),
    authController.restrictTo('admin'),
    formController.updateFormsOrder
  );

router
  .route('/:formID')
  .get(
    authController.protect,
    authController.restrictToTasks('tickets'),
    formController.getForm
  )
  .patch(
    authController.protect,
    authController.restrictToTasks('tickets'),
    authController.restrictTo('admin'),
    formController.updateForm
  );

module.exports = router;
