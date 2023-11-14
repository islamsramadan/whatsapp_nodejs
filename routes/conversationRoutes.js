const express = require('express');
const conversationController = require('./../controllers/conversationController');
const authController = require('./../controllers/authController');

const router = express.Router();

router
  .route('/')
  .get(authController.protect, conversationController.getAllConversations)
  .post(
    authController.protect,
    authController.restrictTo('admin'),
    conversationController.createConversation
  );

router
  .route('/:id')
  .get(authController.protect, conversationController.getConversation)
  .patch(
    authController.protect,
    authController.restrictTo('admin'),
    conversationController.updateConversation
  )
  .delete(
    authController.protect,
    authController.restrictTo('admin'),
    conversationController.deleteConversation
  );

module.exports = router;
