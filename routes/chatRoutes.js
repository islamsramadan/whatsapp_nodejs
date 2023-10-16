const express = require('express');

const chatController = require('./../controllers/chatController');
const authController = require('./../controllers/authController');
const messageRouter = require('./messageRoutes');

const router = express.Router();

router.use('/:chatNumber/messages', messageRouter);

router
  .route('/')
  .get(authController.protect, chatController.getAllChats)
  .post(authController.protect, chatController.createChat);

router
  .route('/:chatNumber')
  .patch(authController.protect, chatController.updateChatNotification);

module.exports = router;
