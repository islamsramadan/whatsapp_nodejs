const express = require('express');
const authController = require('../controllers/authController');
const broadcastController = require('../controllers/broadcastController');
const uploadController = require('../controllers/uploadController');

const router = express.Router();

router
  .route('/')
  .get(
    authController.protect,
    // authController.restrictTo('admin'),
    broadcastController.getAllBroadcasts
  )
  .post(
    authController.protect,
    // authController.restrictTo('admin'),
    uploadController.uploadSingleFile,
    broadcastController.sendBroadcast
  );

router
  .route('/rd')
  .post(
    authController.protect,
    uploadController.uploadFields,
    broadcastController.sendRDBroadcast
  );

router.route('/grouped').get(
  authController.protect,
  // authController.restrictTo('admin'),
  broadcastController.getAllBroadcastsByMonth
);

router.route('/:broadcastID').get(
  authController.protect,
  // authController.restrictTo('admin'),
  broadcastController.getOneBroadcast
);

module.exports = router;
