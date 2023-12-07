const express = require('express');
const authController = require('../controllers/authController');
const contactController = require('../controllers/contactController');

const router = express.Router();

router
  .route('/:contactNumber')
  .patch(authController.protect, contactController.updateContact);

module.exports = router;
