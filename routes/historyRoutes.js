const express = require('express');
const authController = require('./../controllers/authController');
const historyController = require('./../controllers/historyController');

const router = express.Router({ mergeParams: true });

router
  .route('/')
  .get(authController.protect, historyController.getAllChatHistory);

module.exports = router;
