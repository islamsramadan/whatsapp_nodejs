const express = require('express');

const chatController = require('./../controllers/chatController');
const authController = require('./../controllers/authController');
const messageRouter = require('./messageRoutes');
const internalMessageRouter = require('./internalMessageRoutes');
const noteRouter = require('./noteRoutes');

const router = express.Router();

router.use('/:chatNumber/messages', messageRouter);
router.use('/:chatID/internal-messages', internalMessageRouter);
router.use('/:chatNumber/notes', noteRouter);

router
  .route('/')
  .get(authController.protect, chatController.getAllChats)
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
  '/teamUserChats/:userID',
  authController.protect,
  chatController.getAllTeamUserChats
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
