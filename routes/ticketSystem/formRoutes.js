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
//   .delete(authController.protect, formController.deleteForm);

router
  .route('/:formID/default')
  .patch(authController.protect, formController.updateDefaultForm);

router
  .route('/:formID/status')
  .patch(authController.protect, formController.updateFormStatus);

module.exports = router;
