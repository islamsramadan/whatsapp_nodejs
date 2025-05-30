const express = require('express');

const chatController = require('./../controllers/chatController');
const authController = require('./../controllers/authController');
const messageRouter = require('./messageRoutes');
const noteRouter = require('./noteRoutes');
const historyRouter = require('./historyRoutes');

const router = express.Router();

router.use('/:chatID/messages', messageRouter);
router.use('/:chatID/notes', noteRouter);
router.use('/:chatID/histories', historyRouter);

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
  .route('/:chatID')
  .patch(authController.protect, chatController.updateChat);

module.exports = router;
