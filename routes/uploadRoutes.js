const express = require('express');
const authController = require('../controllers/authController');
const uploadController = require('../controllers/uploadController');

const router = express.Router();

router.route('/single').post(
  authController.protect,
  // authController.restrictTo('admin'),
  uploadController.uploadSingleFile,
  uploadController.resFileName
);

router.route('/multi').post(
  authController.protect,
  // authController.restrictTo('admin'),
  uploadController.uploadMultiFiles,
  uploadController.resFilesNames
);

module.exports = router;
