const express = require('express');

const authController = require('../controllers/authController');
const internalMessagesController = require('../controllers/internalMessagesController');

const router = express.Router({ mergeParams: true });

router
  .route('/')
  .get(
    authController.protect,
    internalMessagesController.getAllChatInternalMessages
  )
  .post(
    authController.protect,
    internalMessagesController.uploadMultiFiles,
    internalMessagesController.sendInternalMessage
  );

router
  .route('/templates')
  .post(
    authController.protect,
    internalMessagesController.uploadMessageImage,
    internalMessagesController.sendTemplateInternalMessage
  );

module.exports = router;
