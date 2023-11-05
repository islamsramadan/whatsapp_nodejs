const express = require('express');
const sessionController = require('./../controllers/sessionController');
const authController = require('./../controllers/authController');

const router = express.Router();

router.route('/').get(authController.protect, sessionController.getAllSessions);

module.exports = router;
