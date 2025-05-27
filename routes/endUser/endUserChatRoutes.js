const express = require('express');

const endUserAuthController = require('../../controllers/endUser/endUserAuthController');
const endUserChatController = require('../../controllers/endUser/endUserChatController');

const router = express.Router();

router
  .route('/')
  .get(
    endUserAuthController.protectEndUser,
    endUserChatController.getAllEndUserMessages
  )
  .post(
    endUserAuthController.protectEndUser,
    endUserChatController.uploadMessageFile,
    endUserChatController.sendEndUserMessage
  );

module.exports = router;
