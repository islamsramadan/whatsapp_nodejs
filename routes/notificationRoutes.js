const express = require('express');

const authController = require('./../controllers/authController');
const notificationController = require('./../controllers/notificationController');

const router = express.Router();

router
  .route('/')
  .get(authController.protect, notificationController.getAllUserNotifications);

router
  .route('/ticket/:ticketID')
  .patch(
    authController.protect,
    notificationController.readAllUserTicketNotification
  );

router
  .route('/:notificationID')
  .patch(authController.protect, notificationController.readNotification);

module.exports = router;
