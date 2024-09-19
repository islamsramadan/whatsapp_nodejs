const mongoose = require('mongoose');
const json2xls = require('json2xls');
const ExcelJS = require('exceljs');
const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

const AppError = require('../../utils/appError');
const catchAsync = require('../../utils/catchAsync');
const ticketUtilsHandler = require('../../utils/ticketsUtils');

const User = require('../../models/userModel');
const TicketCategory = require('../../models/ticketSystem/ticketCategoryModel');
const Ticket = require('../../models/ticketSystem/ticketModel');
const TicketStatus = require('../../models/ticketSystem/ticketStatusModel');
const Form = require('../../models/ticketSystem/formModel');
const Field = require('../../models/ticketSystem/fieldModel');
const Team = require('../../models/teamModel');
const TicketLog = require('../../models/ticketSystem/ticketLogModel');

const filterObj = (obj, ...allowedFields) => {
  const newObj = {};
  Object.keys(obj).forEach((el) => {
    if (allowedFields.includes(el)) newObj[el] = obj[el];
  });
  return newObj;
};

const getPopulatedTicket = async (filterObj) => {
  return await Ticket.findOne(filterObj)
    .populate('category', 'name')
    .populate('creator', 'firstName lastName photo')
    .populate('assignee', 'firstName lastName photo')
    .populate('team', 'name')
    .populate('status', 'name category')
    .populate('form', 'name')
    .populate({
      path: 'questions.field',
      select: '-updatedAt -createdAt -forms -creator',
      populate: { path: 'type', select: 'name value description' },
    });
};

exports.getAllTickets = catchAsync(async (req, res, next) => {
  // ==========> Checking permission for export tickets
  const userTeam = await Team.findById(req.user.team);
  if (
    req.user.role !== 'admin' &&
    !userTeam.default &&
    // !userTeam.supervisor.equals(req.user._id) &&     // in export only
    userTeam.name.toLowerCase() !== 'qc'
  ) {
    return next(
      new AppError("You don't have permission to perform this action!", 403)
    );
  }

  const filteredBody = {};

  if (req.query.order) {
    filteredBody.order = req.query.order;
  }

  if (req.query.category) {
    filteredBody.category = req.query.category;
  }

  if (req.query.status) {
    filteredBody.status = req.query.status;
  }

  if (req.query.priority) {
    filteredBody.priority = req.query.priority;
  }

  if (req.query.startDate) {
    filteredBody.createdAt = { $gt: new Date(req.query.startDate) };
  }
  if (req.query.endDate) {
    const endDate = new Date(req.query.endDate);
    endDate.setDate(endDate.getDate() + 1);

    filteredBody.createdAt = {
      ...filteredBody.createdAt,
      $lt: endDate,
    };
  }

  if (req.query.assignee) {
    filteredBody.assignee = req.query.assignee;
  }

  if (req.query.team) {
    filteredBody.team = req.query.team;
  }

  if (req.query.refNo) {
    filteredBody.refNo = { $regex: req.query.refNo };
  }

  if (req.query.requestNature) {
    filteredBody.requestNature = req.query.requestNature;
  }

  if (req.query.requestType) {
    filteredBody.requestType = req.query.requestType;
  }

  if (req.query.type === 'download') {
    // ==========> Checking permission for export tickets
    const userTeam = await Team.findById(req.user.team);
    if (
      req.user.role !== 'admin' &&
      !userTeam.default &&
      !userTeam.supervisor.equals(req.user._id) &&
      userTeam.name.toLowerCase() !== 'qc'
    ) {
      return next(
        new AppError("You don't have permission to perform this action!", 403)
      );
    }

    let tickets = await Ticket.find(filteredBody)
      .sort('-createdAt')
      .populate('category', 'name')
      .populate('creator', 'firstName lastName photo')
      .populate('assignee', 'firstName lastName photo')
      .populate('team', 'name')
      .populate('status', 'name category')
      .populate('form', 'name')
      .populate({
        path: 'questions.field',
        select: '-updatedAt -createdAt -forms -creator',
        populate: { path: 'type', select: 'name value description' },
      });
    // .populate('questions.field', 'name')
    // .select('-questions -client -users -type');

    const keysReference = [
      'Reference No. / الرقم المرجعي', // =======> fixed
      'Date of receipt تاريخ الاستلام', // =======> fixed
      'Received byاستلم بواسطة', // =======> fixed
      'Received fromتم الاستلام من', // =======> fixed
      'Nature of request / طبيعة الطلب', // =======> fixed
      'Description in briefوصف الحالة بشكل مفصل /',
      'Correction / Quick fix taken (التصحيح المتخذ)',
      'Correction / Quick fix taken (التصحيح المتخذ)',
      'Analysis of complaint / appeal in brief (تحليل الشكوي / الاعتراض بشكل مفصل)',
      'Resolved byتم حل الحالة بواسطة ',
      'Is there need to initiate report هل هناك حاجة لعمل تقرير شكوي',
      'reason for reportsاسباب طلب عمل شكوي',
      'Date of resolvingتاريخ حل الشكوي',
      'approval of concerned managerاعتماد المدير المختص',
    ];

    const keys = [];
    tickets.map((ticket) => {
      const questions = ticket.questions.map((question) => ({
        [question.field.name]: question.answer[0],
      }));

      // console.log('questions', questions);
      const questionKeys = questions.map((item) => Object.keys(item));
      questionKeys.map((item) => {
        if (!keys.includes(item[0])) keys.push(item[0]);
      });
      // questionKeys = questionKeys.map((item) => item[0]);
      // console.log('questionKeys', questionKeys);
    });

    console.log('keys', keys);

    tickets = tickets.map((ticket) => {
      const fieldsNames = ticket.questions.map((item) => item.field.name);
      const questions = {};
      keys.map((key) => {
        if (fieldsNames.includes(key)) {
          const answer = ticket.questions.filter(
            (item) => item.field.name === key
          )[0].answer;

          console.log('answer', answer);

          questions[key] = answer && answer.length > 0 ? answer[0] : '';
        } else {
          questions[key] = '';
        }
      });

      // console.log('questions', questions);
      // return {
      //   id: ticket._id,
      //   order: ticket.order,
      //   category: ticket.category.name,
      //   priority: ticket.priority,
      //   creator: `${ticket.creator.firstName} ${ticket.creator.lastName}`,
      //   assignee: `${ticket.assignee.firstName} ${ticket.assignee.lastName}`,
      //   department: ticket.team.name,
      //   status: ticket.status.name,
      //   refNo: ticket.refNo,
      //   requestNature: ticket.requestNature,
      //   requestType: ticket.requestType,
      //   form: ticket.form.name,
      //   ...questions,
      // };
      return {
        'Reference No. / الرقم المرجعي': ticket.refNo,
        'Date of receipt تاريخ الاستلام': ticket.createdAt,
        'Received byاستلم بواسطة': '',
        'Received fromتم الاستلام من': `${ticket.creator.firstName} ${ticket.creator.lastName}`,
        'Nature of request / طبيعة الطلب': ticket.requestNature,
        ...questions,
      };
    });

    // console.log('tickets', tickets);

    // Generate a unique filename
    const fileName = `tickets_${Date.now()}.xlsx`;

    // Create a new workbook and add a worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sheet 1');

    // Add header row (keys of JSON objects)
    const headers = Object.keys(tickets[0]);
    worksheet.addRow(headers);

    // Add data rows
    tickets.forEach((data) => {
      worksheet.addRow(Object.values(data));
    });

    // const headerRow = worksheet.getRow(1);
    // headerRow.height = 40;
    // // headerRow.outlineLevel = 1;
    // headerRow.commit();

    // worksheet.columns = [
    //   { header: 'ID', key: 'id', width: 30 },
    //   { header: 'Order', key: 'order', width: 12 },
    //   { header: 'Category', key: 'category', width: 20 },
    //   { header: 'Priority', key: 'priority', width: 15 },
    //   { header: 'Creator', key: 'creator', width: 28 },
    //   { header: 'Assignee', key: 'assignee', width: 28 },
    //   { header: 'Department', key: 'department', width: 24 },
    //   { header: 'Status', key: 'status', width: 18 },
    //   { header: 'Refrence No', key: 'refNo', width: 34 },
    //   { header: 'Request Type', key: 'requestType', width: 24 },
    //   { header: 'Request Nature', key: 'requestNature', width: 26 },
    //   { header: 'Form', key: 'form', width: 20 },
    // ];

    worksheet.columns = [
      { header: 'Reference No. \n الرقم المرجعي', width: 18 },
      { header: 'Date of receipt \n تاريخ الاستلام', width: 20 },
      { header: 'Received by \n استلم بواسطة', width: 20 },
      { header: 'Received from \n تم الاستلام من', width: 20 },
      { header: 'Nature of request \n  طبيعة الطلب', width: 21 },

      { header: 'Description in brief \n وصف الحالة بشكل مفصل', width: 42 },
      { header: 'Correction / Quick fix taken \n (التصحيح المتخذ)', width: 57 },
      {
        header:
          'Analysis of complaint / appeal in brief \n (تحليل الشكوي / الاعتراض بشكل مفصل)',
        width: 51,
      },
      { header: 'Resolved by \n تم حل الحالة بواسطة ', width: 24 },
      {
        header:
          'Is there need to initiate report \n هل هناك حاجة لعمل تقرير شكوي',
        width: 22,
      },
      { header: 'reason for reports \n اسباب طلب عمل شكوي', width: 22 },
      { header: 'Date of resolving \n تاريخ حل الشكوي', width: 21 },
      {
        header: 'approval of concerned manager \n اعتماد المدير المختص',
        width: 24,
      },
    ];

    // Add custom row with placeholder text
    worksheet.insertRow(1, [
      '', // Empty cell for alignment
      'Client inquiry / complaint / appeal register (F_CSD_01)',
      '',
      '',
      '',
      '',
      '', // Empty cell for alignment
      // 'CPV ARABIA',
      '',
      '',
      '',
      'Rev. No.0 Issue Date: 01/10/2023',
    ]);

    // Define the range for merging cells
    const mergeRanges = [
      { start: 'B1', end: 'F1' },
      // { start: 'I1', end: 'J1' },
      // { start: 'L1', end: 'R1' },
    ];

    // Merge cells based on defined ranges
    mergeRanges.forEach((range) => {
      worksheet.mergeCells(`${range.start}:${range.end}`);
    });

    // Add the image to the workbook
    const imageId = workbook.addImage({
      filename: path.join(__dirname, 'cpvLogo.jpg'), // Path to the image
      extension: 'jpg', // Image format (can be jpg, jpeg, or png)
    });

    // Insert the image into the merged cells H1:J1
    worksheet.addImage(imageId, {
      tl: { col: 7.5, row: 0.3 }, // Top-left position (adjust for exact cell)
      ext: { width: 215, height: 35 }, // Image size in pixels
    });

    // Add auto-filter to all columns
    worksheet.autoFilter = {
      from: 'A2',
      to: `L${tickets.length + 2}`, // Adjust based on the number of data rows
    };

    // worksheet.views = [
    //   {
    //     state: 'frozen',
    //     ySplit: 2,
    //   },
    // ];

    // Apply middle and center alignment to all cells
    worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.alignment = {
          vertical: 'middle',
          horizontal: 'center',
          wrapText: true,
        };
      });
    });

    const headerRow = worksheet.getRow(1);
    headerRow.height = 40;
    headerRow.font = {
      name: 'Arial', // Font family
      size: 24, // Font size
      bold: true, // Bold text
    };
    headerRow.commit();

    const keysRow = worksheet.getRow(2);
    keysRow.height = 70;
    keysRow.font = {
      name: 'Arial', // Font family
      size: 12, // Font size
      bold: true, // Bold text
    };
    keysRow.commit();

    // Write to an Excel file
    await workbook.xlsx.writeFile(fileName);
    console.log('Excel file created successfully!');

    // Send the Excel file as a response
    res.download(fileName, () => {
      // Remove the file after sending
      fs.unlinkSync(fileName);
    });
  } else {
    const page = req.query.page || 1;

    const tickets = await Ticket.find(filteredBody)
      .sort('-createdAt')
      .populate('category', 'name')
      .populate('creator', 'firstName lastName photo')
      .populate('assignee', 'firstName lastName photo')
      .populate('team', 'name')
      .populate('status', 'name category')
      // .populate('form', 'name')
      // .populate('questions.field', 'name')
      .select('-questions -client -users -type')
      .skip((page - 1) * 20)
      .limit(20);

    const totalResults = await Ticket.count(filteredBody);
    const totalPages = Math.ceil(totalResults / 20);

    res.status(200).json({
      status: 'success',
      results: tickets.length,
      data: {
        totalResults,
        totalPages,
        page,
        tickets,
      },
    });
  }
});

exports.getAllUserTickets = catchAsync(async (req, res, next) => {
  const team = await Team.findById(req.user.team);
  if (!team) {
    return next(
      new AppError('User must belong to a team to view ticket!', 400)
    );
  }

  const filteredBody = {
    $or: [{ creator: req.user._id }, { assignee: req.user._id }],
  };

  if (req.query.order) {
    filteredBody.order = req.query.order;
  }

  if (req.query.category) {
    filteredBody.category = req.query.category;
  }

  if (req.query.status) {
    filteredBody.status = req.query.status;
  }

  if (req.query.priority) {
    filteredBody.priority = req.query.priority;
  }

  if (req.query.startDate) {
    filteredBody.createdAt = { $gt: new Date(req.query.startDate) };
  }
  if (req.query.endDate) {
    const endDate = new Date(req.query.endDate);
    endDate.setDate(endDate.getDate() + 1);

    filteredBody.createdAt = {
      ...filteredBody.createdAt,
      $lt: endDate,
    };
  }

  if (req.query.team) {
    filteredBody.team = req.query.team;
  }

  if (req.query.refNo) {
    filteredBody.refNo = { $regex: req.query.refNo };
  }

  if (req.query.requestNature) {
    filteredBody.requestNature = req.query.requestNature;
  }

  if (req.query.requestType) {
    filteredBody.requestType = req.query.requestType;
  }

  if (req.query.type === 'download') {
    // ==========> Checking permission for export tickets
    const userTeam = await Team.findById(req.user.team);
    if (
      req.user.role !== 'admin' &&
      !userTeam.default &&
      !userTeam.supervisor.equals(req.user._id) &&
      userTeam.name.toLowerCase() !== 'qc'
    ) {
      return next(
        new AppError("You don't have permission to perform this action!", 403)
      );
    }

    let tickets = await Ticket.find(filteredBody)
      .sort('-createdAt')
      .populate('category', 'name')
      .populate('creator', 'firstName lastName photo')
      .populate('assignee', 'firstName lastName photo')
      .populate('team', 'name')
      .populate('status', 'name category')
      .populate('form', 'name')
      .populate({
        path: 'questions.field',
        select: '-updatedAt -createdAt -forms -creator',
        populate: { path: 'type', select: 'name value description' },
      });

    const keysReference = [
      'Reference No. / الرقم المرجعي', // =======> fixed
      'Date of receipt تاريخ الاستلام', // =======> fixed
      'Received byاستلم بواسطة', // =======> fixed
      'Received fromتم الاستلام من', // =======> fixed
      'Nature of request / طبيعة الطلب', // =======> fixed
      'Description in briefوصف الحالة بشكل مفصل /',
      'Correction / Quick fix taken (التصحيح المتخذ)',
      'Correction / Quick fix taken (التصحيح المتخذ)',
      'Analysis of complaint / appeal in brief (تحليل الشكوي / الاعتراض بشكل مفصل)',
      'Resolved byتم حل الحالة بواسطة ',
      'Is there need to initiate report هل هناك حاجة لعمل تقرير شكوي',
      'reason for reportsاسباب طلب عمل شكوي',
      'Date of resolvingتاريخ حل الشكوي',
      'approval of concerned managerاعتماد المدير المختص',
    ];

    const keys = [];
    tickets.map((ticket) => {
      const questions = ticket.questions.map((question) => ({
        [question.field.name]: question.answer[0],
      }));

      // console.log('questions', questions);
      const questionKeys = questions.map((item) => Object.keys(item));
      questionKeys.map((item) => {
        if (!keys.includes(item[0])) keys.push(item[0]);
      });
      // questionKeys = questionKeys.map((item) => item[0]);
      // console.log('questionKeys', questionKeys);
    });

    console.log('keys', keys);

    tickets = tickets.map((ticket) => {
      const fieldsNames = ticket.questions.map((item) => item.field.name);
      const questions = {};
      keys.map((key) => {
        if (fieldsNames.includes(key)) {
          const answer = ticket.questions.filter(
            (item) => item.field.name === key
          )[0].answer;

          console.log('answer', answer);

          questions[key] = answer && answer.length > 0 ? answer[0] : '';
        } else {
          questions[key] = '';
        }
      });

      // console.log('questions', questions);
      // return {
      //   id: ticket._id,
      //   order: ticket.order,
      //   category: ticket.category.name,
      //   priority: ticket.priority,
      //   creator: `${ticket.creator.firstName} ${ticket.creator.lastName}`,
      //   assignee: `${ticket.assignee.firstName} ${ticket.assignee.lastName}`,
      //   department: ticket.team.name,
      //   status: ticket.status.name,
      //   refNo: ticket.refNo,
      //   requestNature: ticket.requestNature,
      //   requestType: ticket.requestType,
      //   form: ticket.form.name,
      //   ...questions,
      // };
      return {
        'Reference No. / الرقم المرجعي': ticket.refNo,
        'Date of receipt تاريخ الاستلام': ticket.createdAt,
        'Received byاستلم بواسطة': '',
        'Received fromتم الاستلام من': `${ticket.creator.firstName} ${ticket.creator.lastName}`,
        'Nature of request / طبيعة الطلب': ticket.requestNature,
        ...questions,
      };
    });

    // console.log('tickets', tickets);

    // Generate a unique filename
    const fileName = `tickets_${Date.now()}.xlsx`;

    // Create a new workbook and add a worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sheet 1');

    // Add header row (keys of JSON objects)
    const headers = Object.keys(tickets[0]);
    worksheet.addRow(headers);

    // Add data rows
    tickets.forEach((data) => {
      worksheet.addRow(Object.values(data));
    });

    // const headerRow = worksheet.getRow(1);
    // headerRow.height = 40;
    // // headerRow.outlineLevel = 1;
    // headerRow.commit();

    // worksheet.columns = [
    //   { header: 'ID', key: 'id', width: 30 },
    //   { header: 'Order', key: 'order', width: 12 },
    //   { header: 'Category', key: 'category', width: 20 },
    //   { header: 'Priority', key: 'priority', width: 15 },
    //   { header: 'Creator', key: 'creator', width: 28 },
    //   { header: 'Assignee', key: 'assignee', width: 28 },
    //   { header: 'Department', key: 'department', width: 24 },
    //   { header: 'Status', key: 'status', width: 18 },
    //   { header: 'Refrence No', key: 'refNo', width: 34 },
    //   { header: 'Request Type', key: 'requestType', width: 24 },
    //   { header: 'Request Nature', key: 'requestNature', width: 26 },
    //   { header: 'Form', key: 'form', width: 20 },
    // ];

    worksheet.columns = [
      { header: 'Reference No. \n الرقم المرجعي', width: 18 },
      { header: 'Date of receipt \n تاريخ الاستلام', width: 20 },
      { header: 'Received by \n استلم بواسطة', width: 20 },
      { header: 'Received from \n تم الاستلام من', width: 20 },
      { header: 'Nature of request \n  طبيعة الطلب', width: 21 },

      { header: 'Description in brief \n وصف الحالة بشكل مفصل', width: 42 },
      { header: 'Correction / Quick fix taken \n (التصحيح المتخذ)', width: 57 },
      {
        header:
          'Analysis of complaint / appeal in brief \n (تحليل الشكوي / الاعتراض بشكل مفصل)',
        width: 51,
      },
      { header: 'Resolved by \n تم حل الحالة بواسطة ', width: 24 },
      {
        header:
          'Is there need to initiate report \n هل هناك حاجة لعمل تقرير شكوي',
        width: 22,
      },
      { header: 'reason for reports \n اسباب طلب عمل شكوي', width: 22 },
      { header: 'Date of resolving \n تاريخ حل الشكوي', width: 21 },
      {
        header: 'approval of concerned manager \n اعتماد المدير المختص',
        width: 24,
      },
    ];

    // Add custom row with placeholder text
    worksheet.insertRow(1, [
      '', // Empty cell for alignment
      'Client inquiry / complaint / appeal register (F_CSD_01)',
      '',
      '',
      '',
      '',
      '', // Empty cell for alignment
      // 'CPV ARABIA',
      '',
      '',
      '',
      'Rev. No.0 Issue Date: 01/10/2023',
    ]);

    // Define the range for merging cells
    const mergeRanges = [
      { start: 'B1', end: 'F1' },
      // { start: 'I1', end: 'J1' },
      // { start: 'L1', end: 'R1' },
    ];

    // Merge cells based on defined ranges
    mergeRanges.forEach((range) => {
      worksheet.mergeCells(`${range.start}:${range.end}`);
    });

    // Add the image to the workbook
    const imageId = workbook.addImage({
      filename: path.join(__dirname, 'cpvLogo.jpg'), // Path to the image
      extension: 'jpg', // Image format (can be jpg, jpeg, or png)
    });

    // Insert the image into the merged cells H1:J1
    worksheet.addImage(imageId, {
      tl: { col: 7.5, row: 0.3 }, // Top-left position (adjust for exact cell)
      ext: { width: 215, height: 35 }, // Image size in pixels
    });

    // Add auto-filter to all columns
    worksheet.autoFilter = {
      from: 'A2',
      to: `L${tickets.length + 2}`, // Adjust based on the number of data rows
    };

    // worksheet.views = [
    //   {
    //     state: 'frozen',
    //     ySplit: 2,
    //   },
    // ];

    // Apply middle and center alignment to all cells
    worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.alignment = {
          vertical: 'middle',
          horizontal: 'center',
          wrapText: true,
        };
      });
    });

    const headerRow = worksheet.getRow(1);
    headerRow.height = 40;
    headerRow.font = {
      name: 'Arial', // Font family
      size: 24, // Font size
      bold: true, // Bold text
    };
    headerRow.commit();

    const keysRow = worksheet.getRow(2);
    keysRow.height = 70;
    keysRow.font = {
      name: 'Arial', // Font family
      size: 12, // Font size
      bold: true, // Bold text
    };
    keysRow.commit();

    // Write to an Excel file
    await workbook.xlsx.writeFile(fileName);
    console.log('Excel file created successfully!');

    // Send the Excel file as a response
    res.download(fileName, () => {
      // Remove the file after sending
      fs.unlinkSync(fileName);
    });
  } else {
    const page = req.query.page || 1;

    const tickets = await Ticket.find(filteredBody)
      .sort('-createdAt')
      .populate('category', 'name')
      .populate('creator', 'firstName lastName photo')
      .populate('assignee', 'firstName lastName photo')
      .populate('team', 'name')
      .populate('status', 'name category')
      // .populate('form', 'name')
      // .populate('questions.field', 'name')
      .select('-questions -client -users -type')
      .skip((page - 1) * 20)
      .limit(20);

    const totalResults = await Ticket.count(filteredBody);
    const totalPages = Math.ceil(totalResults / 20);

    res.status(200).json({
      status: 'success',
      results: tickets.length,
      data: {
        totalResults,
        totalPages,
        page,
        tickets,
      },
    });
  }
});

exports.getAllPastTickets = catchAsync(async (req, res, next) => {
  const ticket = await Ticket.findById(req.params.ticketID);

  if (!ticket) {
    return next(new AppError('No ticket found with that ID!', 400));
  }

  const tickets = await Ticket.find({
    refNo: ticket.refNo,
    _id: { $ne: ticket._id },
  })
    .select('-questions -client -users -type')
    .populate('category', 'name')
    .populate('creator', 'firstName lastName photo')
    .populate('assignee', 'firstName lastName photo')
    .populate('team', 'name')
    .populate('status', 'name category');

  res.status(200).json({
    status: 'success',
    results: tickets.length,
    data: {
      tickets,
    },
  });
});

exports.getTicket = catchAsync(async (req, res, next) => {
  const ticket = await getPopulatedTicket({ _id: req.params.ticketID });

  if (!ticket) {
    return next(new AppError('No ticket found with that ID!', 404));
  }

  // ==========> Checking permission for export tickets
  const userTeam = await Team.findById(req.user.team);
  if (
    req.user.role !== 'admin' &&
    !userTeam.default &&
    // !userTeam.supervisor.equals(req.user._id) &&     // in export only
    userTeam.name.toLowerCase() !== 'qc' &&
    !ticket.assignee.equals(req.user._id) &&
    !ticket.creator.equals(req.user._id) &&
    !ticket.users.some((userId) => userId.equals(req.user._id))
  ) {
    return next(
      new AppError("You don't have permission to perform this action!", 403)
    );
  }

  res.status(200).json({
    status: 'success',
    data: {
      ticket,
    },
  });
});

exports.createTicket = catchAsync(async (req, res, next) => {
  let {
    category,
    team,
    assignee,
    client,
    priority,
    status,
    refNo,
    requestNature,
    requestType,
    complaintReport,
    form,
    questions,
  } = req.body;

  if (
    !category ||
    !team ||
    !client ||
    (!client.email && !client.number) ||
    !priority ||
    !refNo ||
    !requestNature ||
    !requestType ||
    !form ||
    !questions ||
    questions.length === 0
  ) {
    return next(new AppError('Ticket details are required!', 400));
  }

  // =======> Checking and selecting the assignee
  if (assignee) {
    const assignedUser = await User.findById(assignee);

    if (!assignedUser) {
      return next(new AppError('No assigned user found with that ID!', 400));
    }

    if (!assignedUser.team.equals(team)) {
      return next(new AppError('Assignee must belong to the team!', 400));
    }

    if (!assignedUser.tasks.includes('tickets')) {
      return next(
        new AppError(
          "Couldn't assign to a user with no permission to tickets",
          400
        )
      );
    }
  } else {
    // --------> Selecting the assignee
    const teamDoc = await Team.findById(team);

    let teamUsers = [];
    for (let i = 0; i < teamDoc.users.length; i++) {
      let teamUser = await User.findOne({
        _id: teamDoc.users[i],
        deleted: false,
      });

      if (teamUser.tasks.includes('tickets')) {
        teamUsers = [...teamUsers, teamUser];
      }
    }

    if (teamUsers.length === 0) {
      return next(
        new AppError(
          "This team doesn't have any user to deal with tickets!",
          400
        )
      );
    }

    // status sorting order
    const statusSortingOrder = ['Online', 'Service hours', 'Offline', 'Away'];

    // teamUsers = teamUsers.sort((a, b) => a.chats.length - b.chats.length);
    teamUsers = teamUsers.sort((a, b) => {
      const orderA = statusSortingOrder.indexOf(a.status);
      const orderB = statusSortingOrder.indexOf(b.status);

      // If 'status' is the same, then sort by chats length
      if (orderA === orderB) {
        return a.tickets.length - b.tickets.length;
      }

      // Otherwise, sort by 'status'
      return orderA - orderB;
    });

    // console.log('teamUsers=============', teamUsers);
    assignee = teamUsers[0];
  }

  const newTicketData = {
    creator: req.user._id,
    category,
    assignee,
    team,
    users: [],
    client,
    priority,
    // status,
    refNo,
    requestNature,
    requestType,
    form,
    tags: [],
  };

  // ----------> Adding complaint report ability
  if (newTicketData.requestNature === 'Complaint') {
    newTicketData.complaintReport = complaintReport;
  }

  // ----------> Adding status
  if (status) {
    const statusDoc = await TicketStatus.findById(status);
    if (!statusDoc || statusDoc.status === 'inactive') {
      return next(new AppError('Invalid Status!', 400));
    }

    if (status.category === 'solved') {
      return next(
        new AppError("Couldn't create ticket with {{solved}} status!", 400)
      );
    }
    newTicketData.status = status;
  } else {
    const statusDoc = await TicketStatus.findOne({ default: true });
    newTicketData.status = statusDoc._id;
  }

  // ----------> Adding questions
  const formDoc = await Form.findById(form);
  if (questions.length !== formDoc.fields.length) {
    return next(
      new AppError('Invalid questions depending on form fields!', 400)
    );
  }

  newTicketData.questions = questions;

  // ----------> Field validation and Adding Tags
  await Promise.all(
    questions.map(async (item) => {
      const field = await Field.findById(item.field);
      if (!field || field.status === 'inactive') {
        return next(new AppError('Invalid field!', 400));
      }

      if (field.required && (!item.answer || item.answer.length === 0)) {
        return next(new AppError('Answer is required!', 400));
      }

      // ----------> Adding tags
      if (field.tag && !newTicketData.tags.includes(item.answer[0])) {
        newTicketData.tags.push(item.answer[0]);
      }
    })
  );

  // ----------> Add ticket order
  const ticketsTotalNumber = await Ticket.count();
  newTicketData.order = ticketsTotalNumber + 1;

  // ----------> Add ticket users array
  newTicketData.users.push(req.user._id);
  if (!req.user._id.equals(assignee)) {
    newTicketData.users.push(assignee);
  }

  // ===============================> Create ticket in transaction session

  const transactionSession = await mongoose.startSession();
  transactionSession.startTransaction();

  let newTicket;
  try {
    // =====================> Create Ticket
    const ticket = await Ticket.create([newTicketData], {
      session: transactionSession,
    });
    // console.log('ticket', ticket);

    // =====================> Add ticket to the assigned user tickets
    await User.findByIdAndUpdate(
      assignee,
      { $push: { tickets: ticket[0]._id } },
      { new: true, runValidators: true, session: transactionSession }
    );

    // =====================> Add ticket to the category
    await TicketCategory.findByIdAndUpdate(
      category,
      { $push: { tickets: ticket[0]._id } },
      { new: true, runValidators: true, session: transactionSession }
    );

    // =====================> Create Ticket Log
    await TicketLog.create(
      [
        {
          ticket: ticket[0]._id,
          log: 'create',
          user: req.user._id,
          status: newTicketData.status,
        },
      ],
      {
        session: transactionSession,
      }
    );

    // =====================> Assign Ticket Log
    await TicketLog.create(
      [
        {
          ticket: ticket[0]._id,
          log: 'assign',
          user: req.user._id,
          assignee: newTicketData.assignee,
        },
      ],
      {
        session: transactionSession,
      }
    );

    newTicket = ticket[0];

    await transactionSession.commitTransaction(); // Commit the transaction

    // console.log('New ticket created: ============', ticket[0]._id);
  } catch (error) {
    await transactionSession.abortTransaction();

    console.error(
      'Transaction aborted due to an error: ===========================',
      error
    );
  } finally {
    transactionSession.endSession();
  }

  if (newTicket) {
    // req.body.ticketID = newTicket._id;
    // req.body.link = 'Not found!';
    // await ticketUtilsHandler.notifyClientHandler(req, newTicket);

    const updatedTicket = await getPopulatedTicket({ _id: newTicket._id });

    res.status(201).json({
      status: 'success',
      data: {
        ticket: updatedTicket,
      },
    });
  } else {
    res.status(400).json({
      status: 'fail',
      message: "Couldn't create the ticket! Kindly try again.",
    });
  }
});

exports.updateTicketInfo = catchAsync(async (req, res, next) => {
  const ticket = await Ticket.findById(req.params.ticketID).populate(
    'status',
    'category'
  );

  if (!ticket) {
    return next(new AppError('No ticket found with that ID!', 404));
  }

  if (ticket.status.category === 'solved') {
    return next(new AppError("Couldn't update solved ticket!", 400));
  }

  // ==========> Checking permission
  const ticketTeam = await Team.findById(ticket.team);
  if (
    req.user.role !== 'admin' &&
    !ticketTeam.supervisor.equals(req.user._id) &&
    !ticket.assignee.equals(req.user._id) &&
    !ticket.creator.equals(req.user._id)
  ) {
    return next(
      new AppError("You don't have permission to perform this action!", 403)
    );
  }

  // -----> Category validation
  if (req.body.category && !ticket.category.equals(req.body.category)) {
    const category = await TicketCategory.findById(req.body.category);
    if (!category || category.status === 'inactive') {
      return next(new AppError('Invalid category!', 400));
    }
  }

  const updatedBody = filterObj(req.body, 'priority', 'category');

  // ----------> Status validation
  let status;
  if (req.body.status && !ticket.status.equals(req.body.status)) {
    status = await TicketStatus.findById(req.body.status);

    if (!status || status.status === 'inactive') {
      return next(new AppError('Invalid status!', 400));
    }

    // ------> Adding status to updated body
    updatedBody.status = status;
  }

  // ------> field required answer for solved status
  if (status && status.category === 'solved') {
    await Promise.all(
      ticket.questions.map(async (item) => {
        const field = await Field.findById(item.field);
        if (!field) {
          return next(new AppError('Invalid field!', 400));
        }

        if (
          (field.required || field.solveRequired) &&
          (!item.answer || item.answer.length === 0)
        ) {
          return next(new AppError('Field answer is required!', 400));
        }
      })
    );

    updatedBody.solvingTime = new Date();
    updatedBody.solvingUser = req.user._id;
  }

  const transactionSession = await mongoose.startSession();
  transactionSession.startTransaction();

  let newUpdatedTicket;
  try {
    // =====================> Update Ticket Info
    newUpdatedTicket = await Ticket.findByIdAndUpdate(
      req.params.ticketID,
      updatedBody,
      {
        new: true,
        runValidators: true,
        session: transactionSession,
      }
    );

    // =====================> Priority Ticket Log
    if (req.body.priority && ticket.priority !== req.body.priority) {
      await TicketLog.create(
        [
          {
            ticket: req.params.ticketID,
            log: 'priority',
            user: req.user._id,
            priority: req.body.priority,
          },
        ],
        {
          session: transactionSession,
        }
      );
    }

    // =====================> Status Ticket Log
    if (status) {
      await TicketLog.create(
        [
          {
            ticket: req.params.ticketID,
            log: 'status',
            user: req.user._id,
            status: status._id,
          },
        ],
        {
          session: transactionSession,
        }
      );
    }

    // =====================> Close Ticket Log
    if (status && status.category === 'solved') {
      await TicketLog.create(
        [
          {
            ticket: req.params.ticketID,
            log: 'close',
            user: req.user._id,
          },
        ],
        {
          session: transactionSession,
        }
      );
    }

    await transactionSession.commitTransaction(); // Commit the transaction
  } catch (error) {
    await transactionSession.abortTransaction();

    console.error(
      'Transaction aborted due to an error: ===========================',
      error
    );

    return next(new AppError("Couldn't update the ticket! Try later.", 400));
  } finally {
    transactionSession.endSession();
  }

  if (newUpdatedTicket) {
    const updatedTicket = await getPopulatedTicket({
      _id: req.params.ticketID,
    });

    res.status(200).json({
      status: 'success',
      message: 'Ticket updated successfully!',
      data: {
        ticket: updatedTicket,
      },
    });
  } else {
    res.status(400).json({
      status: 'fail',
      message: "Couldn't update the ticket! Try later.",
    });
  }
});

exports.transferTicket = catchAsync(async (req, res, next) => {
  const ticket = await Ticket.findById(req.params.ticketID).populate(
    'status',
    'category'
  );

  if (!ticket) {
    return next(new AppError('No ticket found with that ID!', 404));
  }

  if (ticket.status.category === 'solved') {
    return next(new AppError("Couldn't update solved ticket!", 400));
  }

  // ==========> Checking permission
  const ticketTeam = await Team.findById(ticket.team);
  if (
    req.user.role !== 'admin' &&
    !ticketTeam.supervisor.equals(req.user._id) &&
    !ticket.assignee.equals(req.user._id) &&
    !ticket.creator.equals(req.user._id)
  ) {
    return next(
      new AppError("You don't have permission to perform this action!", 403)
    );
  }

  let { assignee, team } = req.body;

  if (!team) {
    return next(new AppError('No team provided', 400));
  }

  const updatedBody = {};

  if (assignee) {
    if (ticket.assignee.equals(assignee)) {
      return next(
        new AppError('Ticket is already assigned to the same user!', 400)
      );
    }

    const assignedUser = await User.findById(assignee);
    if (!assignedUser) {
      return next(new AppError('No user found with that ID!', 404));
    }

    if (!assignedUser.team.equals(team)) {
      return next(new AppError('Assignee must belong to the team!', 400));
    }

    if (!assignedUser.tasks.includes('tickets')) {
      return next(
        new AppError(
          "Couldn't assign ticket to a user with no tickets task!",
          400
        )
      );
    }

    updatedBody.assignee = assignee;
    updatedBody.team = team;
  } else {
    if (ticket.team.equals(team)) {
      return next(
        new AppError('Ticket is already assigned to that team!', 400)
      );
    }

    // --------> Selecting the assignee
    const teamDoc = await Team.findById(team);

    let teamUsers = [];
    for (let i = 0; i < teamDoc.users.length; i++) {
      let teamUser = await User.findOne({
        _id: teamDoc.users[i],
        deleted: false,
      });

      if (teamUser.tasks.includes('tickets')) {
        teamUsers = [...teamUsers, teamUser];
      }
    }

    if (teamUsers.length === 0) {
      return next(
        new AppError(
          "This team doesn't have any user to deal with tickets!",
          400
        )
      );
    }

    // status sorting order
    const statusSortingOrder = ['Online', 'Service hours', 'Offline', 'Away'];

    // teamUsers = teamUsers.sort((a, b) => a.chats.length - b.chats.length);
    teamUsers = teamUsers.sort((a, b) => {
      const orderA = statusSortingOrder.indexOf(a.status);
      const orderB = statusSortingOrder.indexOf(b.status);

      // If 'status' is the same, then sort by chats length
      if (orderA === orderB) {
        return a.tickets.length - b.tickets.length;
      }

      // Otherwise, sort by 'status'
      return orderA - orderB;
    });

    // console.log('teamUsers=============', teamUsers);
    assignee = teamUsers[0]._id;

    updatedBody.assignee = assignee;
    updatedBody.team = team;
  }

  if (!ticket.users.includes(assignee)) {
    updatedBody.$push = { users: assignee };
  }

  // ----------> Status validation
  let status;
  if (req.body.status && !ticket.status.equals(req.body.status)) {
    status = await TicketStatus.findById(req.body.status);

    if (!status || status.status === 'inactive') {
      return next(new AppError('Invalid status!', 400));
    }

    // ------> Adding status to updated body
    updatedBody.status = status._id;
  }

  // ------> field required answer for solved status
  if (status && status.category === 'solved') {
    return next(
      new AppError("Couldn't transfer ticket with {{solved}} status!", 400)
    );
  }

  const previousAssignee = await User.findById(ticket.assignee);

  const transactionSession = await mongoose.startSession();
  transactionSession.startTransaction();

  let newUpdatedTicket;
  try {
    newUpdatedTicket = await Ticket.findByIdAndUpdate(
      req.params.ticketID,
      updatedBody,
      {
        runValidators: true,
        new: true,
        session: transactionSession,
      }
    );

    // ======> Remove ticket from the previous assignee tickets array
    await User.findByIdAndUpdate(
      previousAssignee._id,
      { $pull: { tickets: ticket._id } },
      { new: true, runValidators: true, session: transactionSession }
    );

    // ======> Add ticket to the new assignee tickets array
    await User.findByIdAndUpdate(
      assignee,
      { $push: { tickets: ticket._id } },
      { new: true, runValidators: true, session: transactionSession }
    );

    // ======> Status Ticket Log
    if (updatedBody.status) {
      await TicketLog.create(
        [
          {
            ticket: req.params.ticketID,
            log: 'status',
            user: req.user._id,
            status: updatedBody.status,
          },
        ],
        {
          session: transactionSession,
        }
      );
    }

    // ======> Transfer Ticket Log
    await TicketLog.create(
      [
        {
          ticket: req.params.ticketID,
          log: 'transfer',
          user: req.user._id,
          transfer: {
            from: { user: previousAssignee._id, team: ticket.team },
            to: { user: assignee, team },
          },
        },
      ],
      {
        session: transactionSession,
      }
    );

    await transactionSession.commitTransaction();
  } catch (err) {
    await transactionSession.abortTransaction();

    console.error(
      'Transaction aborted due to an error: ===========================',
      err
    );

    return next(new AppError("Couldn't update the ticket! Try later.", 400));
  } finally {
    transactionSession.endSession();
  }

  if (newUpdatedTicket) {
    const updatedTicket = await getPopulatedTicket({
      _id: req.params.ticketID,
    });

    res.status(200).json({
      status: 'success',
      messgae: 'Ticket has been reassigned successully!',
      data: {
        ticket: updatedTicket,
      },
    });
  } else {
    res.status(400).json({
      status: 'fail',
      message: "Couldn't update the ticket! Try later.",
    });
  }
});

exports.takeTicketOwnership = catchAsync(async (req, res, next) => {
  const ticket = await Ticket.findById(req.params.ticketID).populate(
    'status',
    'category'
  );

  if (!ticket) {
    return next(new AppError('No ticket found with that ID!', 404));
  }

  if (ticket.status.category === 'solved') {
    return next(new AppError("Couldn't update solved ticket!", 400));
  }

  // ==========> Checking permission
  if (req.user.role !== 'admin' && !ticket.team.equals(req.user.team)) {
    return next(
      new AppError("You don't have permission to perform this action!", 403)
    );
  }

  const team = await Team.findById(req.user.team);
  if (!team) {
    return next(
      new AppError("Ticket couldn't transfer to a user with no team!", 400)
    );
  }

  const previousAssignee = await User.findById(ticket.assignee);

  const updatedBody = {
    assignee: req.user._id,
    team: req.user.team,
  };

  const transactionSession = await mongoose.startSession();
  transactionSession.startTransaction();

  let newUpdatedTicket;
  try {
    newUpdatedTicket = await Ticket.findByIdAndUpdate(
      req.params.ticketID,
      updatedBody,
      {
        runValidators: true,
        new: true,
        session: transactionSession,
      }
    );

    // ======> Remove ticket from the previous assignee tickets array
    await User.findByIdAndUpdate(
      previousAssignee._id,
      { $pull: { tickets: ticket._id } },
      { new: true, runValidators: true, session: transactionSession }
    );

    // ======> Add ticket to the new assignee tickets array
    await User.findByIdAndUpdate(
      req.user._id,
      { $push: { tickets: ticket._id } },
      { new: true, runValidators: true, session: transactionSession }
    );

    // ======> Transfer Ticket Log
    await TicketLog.create(
      [
        {
          ticket: req.params.ticketID,
          log: 'takeOwnership',
          user: req.user._id,
        },
      ],
      {
        session: transactionSession,
      }
    );

    await transactionSession.commitTransaction();
  } catch (err) {
    await transactionSession.abortTransaction();

    console.error(
      'Transaction aborted due to an error: ===========================',
      err
    );

    return next(new AppError("Couldn't update the ticket! Try later.", 400));
  } finally {
    transactionSession.endSession();
  }

  if (newUpdatedTicket) {
    const updatedTicket = await getPopulatedTicket({
      _id: req.params.ticketID,
    });

    res.status(200).json({
      status: 'success',
      messgae: 'Ticket has been reassigned successully!',
      data: {
        ticket: updatedTicket,
      },
    });
  } else {
    res.status(400).json({
      status: 'fail',
      message: "Couldn't update the ticket! Try later.",
    });
  }
});

exports.updateTicketForm = catchAsync(async (req, res, next) => {
  const ticket = await Ticket.findById(req.params.ticketID).populate(
    'status',
    'category'
  );

  if (!ticket) {
    return next(new AppError('No ticket found with that ID!', 404));
  }

  if (ticket.status.category === 'solved') {
    return next(new AppError("Couldn't update solved ticket!", 400));
  }

  // ==========> Checking permission
  const ticketTeam = await Team.findById(ticket.team);
  if (
    req.user.role !== 'admin' &&
    !ticketTeam.supervisor.equals(req.user._id) &&
    !ticket.assignee.equals(req.user._id) &&
    !ticket.creator.equals(req.user._id)
  ) {
    return next(
      new AppError("You don't have permission to perform this action!", 403)
    );
  }

  const { questions } = req.body;

  if (questions.length !== ticket.questions.length) {
    return next(
      new AppError('Invalid questions depending on form fields!', 400)
    );
  }

  const tags = [];

  // ----------> Status validation
  let status;
  if (req.body.status && !ticket.status.equals(req.body.status)) {
    status = await TicketStatus.findById(req.body.status);
    if (!status || status.status === 'inactive') {
      return next(new AppError('Invalid status!', 400));
    }
  }

  // ----------> Field validation and Adding Tags
  await Promise.all(
    questions.map(async (item) => {
      const field = await Field.findById(item.field);
      if (!field) {
        return next(new AppError('Invalid field!', 400));
      }

      // ------> field required answer
      if (field.required && (!item.answer || item.answer.length === 0)) {
        return next(new AppError('Field answer is required!', 400));
      }

      // ------> field required answer for solved status
      if (
        status &&
        status.category === 'solved' &&
        field.solveRequired &&
        (!item.answer || item.answer.length === 0)
      ) {
        return next(new AppError('Field answer is required!', 400));
      }

      // ----------> Adding tags
      if (field.tag && !tags.includes(item.answer[0])) {
        tags.push(item.answer[0]);
      }
    })
  );

  const updatedBody = { questions, tags };

  if (status) {
    updatedBody.status = status._id;

    if (status.category === 'solved') {
      updatedBody.solvingTime = new Date();
      updatedBody.solvingUser = req.user._id;
    }
  }

  const transactionSession = await mongoose.startSession();
  transactionSession.startTransaction();

  let newUpdatedTicket;
  try {
    // =====================> Update Ticket Info
    newUpdatedTicket = await Ticket.findByIdAndUpdate(
      req.params.ticketID,
      updatedBody,
      {
        new: true,
        runValidators: true,
        session: transactionSession,
      }
    );

    // =====================> Form Ticket Log
    await TicketLog.create(
      [
        {
          ticket: req.params.ticketID,
          log: 'form',
          user: req.user._id,
        },
      ],
      {
        session: transactionSession,
      }
    );

    // =====================> Status Ticket Log
    if (status) {
      await TicketLog.create(
        [
          {
            ticket: req.params.ticketID,
            log: 'status',
            user: req.user._id,
            status: status._id,
          },
        ],
        {
          session: transactionSession,
        }
      );
    }

    // =====================> Close Ticket Log
    if (status && status.category === 'solved') {
      await TicketLog.create(
        [
          {
            ticket: req.params.ticketID,
            log: 'close',
            user: req.user._id,
          },
        ],
        {
          session: transactionSession,
        }
      );
    }

    await transactionSession.commitTransaction(); // Commit the transaction
  } catch (error) {
    await transactionSession.abortTransaction();

    console.error(
      'Transaction aborted due to an error: ===========================',
      error
    );

    return next(new AppError("Couldn't update the ticket! Try later.", 400));
  } finally {
    transactionSession.endSession();
  }

  if (newUpdatedTicket) {
    const updatedTicket = await getPopulatedTicket({
      _id: req.params.ticketID,
    });

    res.status(200).json({
      status: 'success',
      message: 'Ticket form updated successfully!',
      data: {
        ticket: updatedTicket,
      },
    });
  } else {
    res.status(400).json({
      status: 'fail',
      message: "Couldn't update the ticket! Try later.",
    });
  }
});

exports.updateTicketClientData = catchAsync(async (req, res, next) => {
  const ticket = await Ticket.findById(req.params.ticketID).populate(
    'status',
    'category'
  );

  if (!ticket) {
    return next(new AppError('No ticket found with that ID!', 404));
  }

  if (ticket.status.category === 'solved') {
    return next(new AppError("Couldn't update solved ticket!", 400));
  }

  // ==========> Checking permission
  const ticketTeam = await Team.findById(ticket.team);
  if (
    req.user.role !== 'admin' &&
    !ticketTeam.supervisor.equals(req.user._id) &&
    !ticket.assignee.equals(req.user._id) &&
    !ticket.creator.equals(req.user._id)
  ) {
    return next(
      new AppError("You don't have permission to perform this action!", 403)
    );
  }

  const { client } = req.body;
  if (!client || (!client.email && !client.number)) {
    return next(new AppError('Client data is required!', 400));
  }

  await Ticket.findByIdAndUpdate(
    req.params.ticketID,
    { client },
    { runValidators: true, new: true }
  );

  const transactionSession = await mongoose.startSession();
  transactionSession.startTransaction();

  let newUpdatedTicket;
  try {
    // =====================> Update Ticket Info
    newUpdatedTicket = await Ticket.findByIdAndUpdate(
      req.params.ticketID,
      { client },
      {
        new: true,
        runValidators: true,
        session: transactionSession,
      }
    );

    // =====================> Client Data Ticket Log
    const clientDataUpdate = {};
    if (client.name !== ticket.client.name) clientDataUpdate.name = client.name;
    if (client.email !== ticket.client.email)
      clientDataUpdate.email = client.email;
    if (client.number !== ticket.client.number)
      clientDataUpdate.number = client.number;

    if (Object.entries(clientDataUpdate).length > 0) {
      await TicketLog.create(
        [
          {
            ticket: req.params.ticketID,
            log: 'client',
            user: req.user._id,
            client,
            // client: clientDataUpdate,
          },
        ],
        {
          session: transactionSession,
        }
      );
    }

    await transactionSession.commitTransaction(); // Commit the transaction
  } catch (error) {
    await transactionSession.abortTransaction();

    console.error(
      'Transaction aborted due to an error: ===========================',
      error
    );

    return next(new AppError("Couldn't update the ticket! Try later.", 400));
  } finally {
    transactionSession.endSession();
  }

  if (newUpdatedTicket) {
    const updatedTicket = await getPopulatedTicket({
      _id: req.params.ticketID,
    });

    res.status(200).json({
      status: 'success',
      message: 'Client data updated successully!',
      data: {
        ticket: updatedTicket,
      },
    });
  } else {
    res.status(400).json({
      status: 'fail',
      message: "Couldn't update client data! Try later.",
    });
  }
});
