const express = require('express');
const logController = require('../controllers/logController');
const authController = require('../controllers/authController');

const router = express.Router({ mergeParams: true });

router
  .route('/users')
  .get(authController.protect, logController.getAllStatusLogs);
//   .post(authController.protect, logController.createCreateLog);

router.route('/:id');
//   .get(authController.protect, noteController.getNote)
//   .patch(authController.protect, noteController.updateNote)
//   .delete(authController.protect, noteController.deleteNote);

module.exports = router;
