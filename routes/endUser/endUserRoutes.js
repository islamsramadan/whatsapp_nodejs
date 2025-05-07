const express = require('express');
const authController = require('../../controllers/authController');
const ticketController = require('../../controllers/ticketSystem/ticketController');
const endUserAuthController = require('../../controllers/endUser/endUserAuthController');
const endUserTicketController = require('../../controllers/endUser/endUserTicketController');
const endUserChatController = require('../../controllers/endUser/endUserChatController');
const endUserNotificationController = require('../../controllers/endUser/endUserNotificationController');

// const commentRouter = require('./commentRoutes');
// const ticketLogRouter = require('./ticketLogRoutes');

const router = express.Router();

// router.use('/:ticketID/comments', commentRouter);
// router.use('/:ticketID/ticket-logs', ticketLogRouter);

router
  .route('/token')
  .post(
    endUserAuthController.protectEndUserApp,
    endUserAuthController.getOrCreateEndUserToken
  );

router
  .route('/tickets')
  .get(
    endUserAuthController.protectEndUser,
    endUserTicketController.getAllEndUserTickets
  )
  .post(
    endUserAuthController.protectEndUser,
    endUserTicketController.createEndUserTicket
  );

router
  .route('/tickets/:ticketID')
  .get(
    endUserAuthController.protectEndUser,
    endUserTicketController.getEndUserTicket
  );

router
  .route('/tickets/:ticketID/past-tickets')
  .get(
    endUserAuthController.protectEndUser,
    endUserTicketController.getAllEndUserPastTickets
  );

router
  .route('/tickets/:ticketID/feedback')
  .patch(
    endUserAuthController.protectEndUser,
    endUserTicketController.sendFeedback
  );

router
  .route('/tickets/:ticketID/comment')
  .patch(
    endUserAuthController.protectEndUser,
    endUserTicketController.uploadMultiFiles,
    endUserTicketController.createEndUserComment
  );

router
  .route('/ticket-categories')
  .get(
    endUserAuthController.protectEndUser,
    endUserTicketController.getAllEndUserTicketCategories
  );

router
  .route('/ticket-statuses')
  .get(
    endUserAuthController.protectEndUser,
    endUserTicketController.getAllEndUserTicketStatuses
  );

router
  .route('/messages')
  .get(
    endUserAuthController.protectEndUser,
    endUserChatController.getAllEndUserMessages
  )
  .post(
    endUserAuthController.protectEndUser,
    endUserChatController.uploadMessageFile,
    endUserChatController.sendEndUserMessage
  );

router
  .route('/teams')
  .get(
    endUserAuthController.protectEndUser,
    endUserTicketController.getAllTicketsTeams
  );

router
  .route('/notifications')
  .get(
    endUserAuthController.protectEndUser,
    endUserNotificationController.getAllEndUserNotifications
  );

router
  .route('/notifications/new')
  .get(
    endUserAuthController.protectEndUser,
    endUserNotificationController.getAllEndUserNotificationsNumbers
  );

router
  .route('/notifications/:notificationID')
  .patch(
    endUserAuthController.protectEndUser,
    endUserNotificationController.readEndUserNotification
  );

router
  .route('/notifications/ticket/:ticketID')
  .patch(
    endUserAuthController.protectEndUser,
    endUserNotificationController.readAllEndUserTicketNotifications
  );

router
  .route('/notifications/chat/:chatNumber')
  .patch(
    endUserAuthController.protectEndUser,
    endUserNotificationController.readAllEndUserChatNotifications
  );

module.exports = router;
