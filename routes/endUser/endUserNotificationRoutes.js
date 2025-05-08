const express = require('express');

const endUserAuthController = require('../../controllers/endUser/endUserAuthController');
const endUserNotificationController = require('../../controllers/endUser/endUserNotificationController');

const router = express.Router();

router
  .route('/')
  .get(
    endUserAuthController.protectEndUser,
    endUserNotificationController.getAllEndUserNotifications
  )
  .patch(
    endUserAuthController.protectEndUser,
    endUserNotificationController.readAllEndUserNotifications
  );

router
  .route('/new')
  .get(
    endUserAuthController.protectEndUser,
    endUserNotificationController.getAllEndUserNotificationsNumbers
  );

router
  .route('/:notificationID')
  .patch(
    endUserAuthController.protectEndUser,
    endUserNotificationController.readEndUserNotification
  );

router
  .route('/ticket/:ticketID')
  .patch(
    endUserAuthController.protectEndUser,
    endUserNotificationController.readAllEndUserTicketNotifications
  );

router
  .route('/chat/:chatID')
  .patch(
    endUserAuthController.protectEndUser,
    endUserNotificationController.readAllEndUserChatNotifications
  );

module.exports = router;
