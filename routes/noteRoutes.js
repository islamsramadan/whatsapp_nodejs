const express = require('express');
const noteController = require('../controllers/noteController');
const authController = require('../controllers/authController');

const router = express.Router({ mergeParams: true });

router
  .route('/')
  .get(authController.protect, noteController.getAllChatNotes)
  .post(authController.protect, noteController.createNote);

router
  .route('/:id')
  .get(authController.protect, noteController.getNote)
  .patch(authController.protect, noteController.updateNote)
  .delete(authController.protect, noteController.deleteNote);

module.exports = router;
