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
  .route('/:messageID')
  .patch(authController.protect, messageController.sendFailedMessage);

module.exports = router;
