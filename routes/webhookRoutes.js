const express = require('express');
const webhookController = require('../controllers/webhookController');

const router = express.Router();

router
  .route('/')
  //to verify the callback url from the dashboard side - cloud api side
  .get(webhookController.verifyWebhook)
  .post(webhookController.listenToWebhook);

module.exports = router;
