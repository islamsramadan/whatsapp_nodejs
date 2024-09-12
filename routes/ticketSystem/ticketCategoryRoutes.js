const express = require('express');
const authController = require('../../controllers/authController');
const ticketCategoryController = require('../../controllers/ticketSystem/ticketCategoryController');

const router = express.Router();

router
  .route('/')
  .get(
    authController.protect,
    authController.restrictToTasks('tickets'),
    ticketCategoryController.getAllCategories
  )
  .post(
    authController.protect,
    authController.restrictToTasks('tickets'),
    authController.restrictTo('admin'),
    ticketCategoryController.createCategory
  );

router
  .route('/:categoryID')
  .get(
    authController.protect,
    authController.restrictToTasks('tickets'),
    authController.restrictTo('admin'),
    ticketCategoryController.getCategory
  )
  .patch(
    authController.protect,
    authController.restrictToTasks('tickets'),
    authController.restrictTo('admin'),
    ticketCategoryController.updateCategory
  );

module.exports = router;
