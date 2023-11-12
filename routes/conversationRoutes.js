const express = require('express');
const conversationController = require('./../controllers/conversationController');
const authController = require('./../controllers/authController');

const router = express.Router();

router
  .route('/')
  .get(
    authController.protect,
    authController.restrictTo('admin'),
    conversationController.getAllConversations
  )
  .post(
    authController.protect,
    authController.restrictTo('admin'),
    conversationController.createConversation
  );

router
  .route('/:id')
  .get(
    authController.protect,
    authController.restrictTo('admin'),
    conversationController.getConversation
  )
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
