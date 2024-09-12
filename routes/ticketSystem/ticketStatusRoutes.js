const express = require('express');

const authController = require('../../controllers/authController');
const ticketStatusController = require('../../controllers/ticketSystem/ticketStatusController');

const router = express.Router();

router
  .route('/')
  .get(
    authController.protect,
    authController.restrictToTasks('tickets'),
    ticketStatusController.getAllStatuses
  )
  .post(
    authController.protect,
    authController.restrictToTasks('tickets'),
    authController.restrictTo('admin'),
    ticketStatusController.createStatus
  );

router
  .route('/:statusID')
  .get(
    authController.protect,
    authController.restrictToTasks('tickets'),
    authController.restrictTo('admin'),
    ticketStatusController.getStatus
  )
  .patch(
    authController.protect,
    authController.restrictToTasks('tickets'),
    authController.restrictTo('admin'),
    ticketStatusController.updateStatus
  );

module.exports = router;
