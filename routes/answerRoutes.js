const express = require('express');
const answerController = require('./../controllers/answerController');
const authController = require('./../controllers/authController');

const router = express.Router();

router
  .route('/')
  .get(authController.protect, answerController.getAllAnswers)
  .post(authController.protect, answerController.createAnswer)
  .delete(authController.protect, answerController.deleteMultiAnswers);

router
  .route('/:id')
  .get(authController.protect, answerController.getAnswer)
  .patch(authController.protect, answerController.updateAnswer)
  .delete(authController.protect, answerController.deleteAnswer);

module.exports = router;
