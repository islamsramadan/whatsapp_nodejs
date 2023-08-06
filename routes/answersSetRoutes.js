const express = require('express');
const answersSetController = require('../controllers/answersSetController');
const authController = require('../controllers/authController');

const router = express.Router();

router
  .route('/')
  .get(authController.protect, answersSetController.getAllAnswersSet)
  .post(authController.protect, answersSetController.createAnswersSet);

router
  .route('/:id')
  .get(authController.protect, answersSetController.getAnswersSet)
  .patch(authController.protect, answersSetController.updateAnswersSet)
  .delete(authController.protect, answersSetController.deleteAnswersSet);

module.exports = router;
