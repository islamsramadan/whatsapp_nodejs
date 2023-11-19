const express = require('express');

const chatController = require('./../controllers/chatController');
const authController = require('./../controllers/authController');
const messageRouter = require('./messageRoutes');

const router = express.Router();

router.use('/:chatNumber/messages', messageRouter);

router
  .route('/')
  // .get(authController.protect, chatController.getAllChats)
  .post(authController.protect, chatController.createChat);

router.get(
  '/userChats',
  authController.protect,
  chatController.getAllUserChats
);

router.get(
  '/teamChats',
  authController.protect,
  chatController.getAllTeamChats
);

router.get(
  '/archivedChats',
  authController.protect,
  chatController.getAllArchivedChats
);

router
  .route('/:chatNumber')
  .patch(authController.protect, chatController.updateChat);

module.exports = router;
