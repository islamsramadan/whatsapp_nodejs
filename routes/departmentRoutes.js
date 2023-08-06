const express = require('express');
const authController = require('./../controllers/authController');
const departmentController = require('./../controllers/departmentController');

const router = express.Router();

router
  .route('/')
  .get(authController.protect, departmentController.getAllDepartments)
  .post(authController.protect, departmentController.createDepartment);

router
  .route('/:id')
  .get(authController.protect, departmentController.getDepartment)
  .patch(authController.protect, departmentController.updateDepartment)
  .delete(authController.protect, departmentController.deleteDepartment);

module.exports = router;
