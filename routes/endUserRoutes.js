const express = require('express');
const endUserController = require('./../controllers/endUserController');

const router = express.Router();

router
  .route('/token')
  .post(
    endUserController.protectEndUserApp,
    endUserController.getOrCreateEndUserToken
  );

router
  .route('/messages')
  .get(
    endUserController.protectEndUser,
    endUserController.getAllEndUserMessages
  )
  .post(endUserController.protectEndUser, endUserController.sendEndUserMessage);

router.route('/messages/:messageID').post(endUserController.protectEndUser);

module.exports = router;
