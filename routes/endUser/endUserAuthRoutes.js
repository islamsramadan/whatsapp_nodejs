const express = require('express');

const endUserAuthController = require('../../controllers/endUser/endUserAuthController');

const router = express.Router();

router
  .route('/')
  .post(
    endUserAuthController.protectEndUserApp,
    endUserAuthController.getOrCreateEndUserToken
  );

module.exports = router;
