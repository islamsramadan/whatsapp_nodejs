const express = require('express');

const authController = require('./../controllers/authController');
const notificationController = require('./../controllers/notificationController');

const router = express.Router();

router
  .route('/')
  .get(authController.protect, notificationController.getAllUserNotifications)
  .patch(
    authController.protect,
    notificationController.readAllUserNotifications
  );

router
  .route('/new')
  .get(
    authController.protect,
    notificationController.getAllUserNotificationsNumbers
  );

router
  .route('/:notificationID')
  .patch(authController.protect, notificationController.readNotification);

router
  .route('/ticket/:ticketID')
  .patch(
    authController.protect,
    notificationController.readAllUserTicketNotifications
  );

router
  .route('/chat/:chatID')
  .patch(
    authController.protect,
    notificationController.readAllUserChatNotifications
  );

module.exports = router;
