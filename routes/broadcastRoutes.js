const express = require('express');
const authController = require('../controllers/authController');
const broadcastController = require('../controllers/broadcastController');
const uploadController = require('../controllers/uploadController');

const router = express.Router();

router
  .route('/')
  .post(
    authController.protect,
    authController.restrictTo('admin'),
    uploadController.uploadSingleFile,
    broadcastController.sendBroadcast
  );

module.exports = router;
