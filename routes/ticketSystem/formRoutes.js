const express = require('express');

const authController = require('../../controllers/authController');
const formController = require('../../controllers/ticketSystem/formController');

const router = express.Router();

router
  .route('/')
  .get(authController.protect, formController.getAllForms)
  .post(authController.protect, formController.createForm);

router
  .route('/order')
  .patch(authController.protect, formController.updateFormsOrder);

router
  .route('/:formID')
  .get(authController.protect, formController.getForm)
  .patch(authController.protect, formController.updateForm);

// router
//   .route('/:formID/default')
//   .patch(authController.protect, formController.updateDefaultForm);

module.exports = router;
