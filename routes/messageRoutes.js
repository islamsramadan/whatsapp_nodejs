const express = require('express');

const authController = require('./../controllers/authController');
const messageController = require('./../controllers/messageController');

const router = express.Router({ mergeParams: true });

router
  .route('/')
  .get(authController.protect, messageController.getAllChatMessages)
  .post(
    authController.protect,
    messageController.uploadMessageImage,
    messageController.sendMessage
  );

router
  .route('/:messageID/failedMessage')
  .patch(authController.protect, messageController.sendFailedMessage);

router
  .route('/:messageID/reaction')
  .patch(authController.protect, messageController.reactMessage);

module.exports = router;
