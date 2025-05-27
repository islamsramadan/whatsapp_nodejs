const express = require('express');
const userController = require('./../controllers/userController');
const authController = require('./../controllers/authController');

const router = express.Router();

// router.post('/signup', authController.signup);

router.post('/login', authController.login);

router.post('/otp', authController.verifyOTP);

router.patch(
  '/updateMyPassword',
  authController.protect,
  authController.updatePassword
);

router.patch(
  '/updateMe',
  authController.protect,
  userController.uploadUserPhoto,
  userController.updateMe
);

router
  .route('/')
  .get(authController.protect, userController.getAllUsers)
  .post(
    authController.protect,
    authController.restrictTo('admin'),
    userController.createUser
  );

router
  .route('/:userID')
  .get(
    authController.protect,
    authController.restrictTo('admin'),
    userController.getUser
  )
  .patch(
    authController.protect,
    authController.restrictTo('admin'),
    userController.updateUser
  )
  .delete(
    authController.protect,
    authController.restrictTo('admin'),
    userController.deleteUser
  );

router
  .route('/status/:userID')
  .patch(
    authController.protect,
    authController.restrictTo('admin'),
    userController.updateUserStatus
  );

router
  .route('/recovery/:userID')
  .patch(
    authController.protect,
    authController.restrictTo('admin'),
    userController.recoverUser
  );

module.exports = router;
