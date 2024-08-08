const express = require('express');

const authController = require('../../controllers/authController');
const ticketStatusController = require('../../controllers/ticketSystem/ticketStatusController');

const router = express.Router();

router
  .route('/')
  .get(authController.protect, ticketStatusController.getAllStatuses)
  .post(authController.protect, ticketStatusController.createStatus);

router
  .route('/statusID')
  .get(authController.protect, ticketStatusController.getStatus)
  .patch(authController.protect, ticketStatusController.updateStatus);
//   .delete(authController.protect, ticketStatusController.deleteStatus);

module.exports = router;
