const express = require('express');
const conversationController = require('./../controllers/conversationController');
const authController = require('./../controllers/authController');

const router = express.Router();

router
  .route('/')
  .get(authController.protect, conversationController.getAllConversations)
  .post(authController.protect, conversationController.createConversation);

router
  .route('/:id')
  .get(authController.protect, conversationController.getConversation)
  .patch(authController.protect, conversationController.updateConversation)
  .delete(authController.protect, conversationController.deleteConversation);

module.exports = router;
