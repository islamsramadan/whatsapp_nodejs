const express = require('express');
const authController = require('../../controllers/authController');
const commentController = require('./../../controllers/ticketSystem/commentController');

const router = express.Router({ mergeParams: true });

router
  .route('/')
  .get(
    authController.protect,
    authController.restrictToTasks('tickets'),
    commentController.getAllTicketComments
  )
  .post(
    authController.protect,
    authController.restrictToTasks('tickets'),
    commentController.uploadMultiFiles,
    commentController.createComment
  );

router
  .route('/:commentID')
  .get(
    authController.protect,
    authController.restrictToTasks('tickets'),
    commentController.getComment
  );

module.exports = router;
