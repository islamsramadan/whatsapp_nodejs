const mongoose = require('mongoose');
const multer = require('multer');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

const AppError = require('../../utils/appError');
const catchAsync = require('../../utils/catchAsync');
const ticketUtilsHandler = require('../../utils/ticketsUtils');
const { mailerSendEmail } = require('../../utils/emailHandler');

const User = require('../../models/userModel');
const TicketCategory = require('../../models/ticketSystem/ticketCategoryModel');
const Ticket = require('../../models/ticketSystem/ticketModel');
const TicketStatus = require('../../models/ticketSystem/ticketStatusModel');
const Form = require('../../models/ticketSystem/formModel');
const Field = require('../../models/ticketSystem/fieldModel');
const Team = require('../../models/teamModel');
const TicketLog = require('../../models/ticketSystem/ticketLogModel');
const Notification = require('../../models/notificationModel');
const Comment = require('../../models/ticketSystem/commentModel');
const EndUserNotification = require('../../models/endUser/endUserNotificationModel');

const getPopulatedTicket = async (filterObj) => {
  return await Ticket.findOne(filterObj)
    .populate('category', 'name')
    .populate('creator', 'firstName lastName photo')
    .populate('endUser', 'nationalID name phone')
    .populate('assignee', 'firstName lastName photo email')
    // .populate('solvingUser', 'firstName lastName photo')
    .populate('team', 'name')
    .populate('status', 'endUserDisplayName category')
    .populate('form', 'name')
    .populate({
      path: 'questions.field',
      select: '-updatedAt -createdAt -forms -creator',
      populate: { path: 'type', select: 'name value description' },
    })
    .select(
      '-client -users -clientToken -complaintReport -tags -priority -solvingTime -solvingUser'
    )
    .lean();
};

const getTicketsSheet = async (res, ticketsData) => {
  let tickets = ticketsData;
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
    'Date of resolving تاريخ حل الشكوي',
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

        // console.log('answer', answer);

        questions[key] = answer && answer.length > 0 ? answer[0] : '';
      } else {
        questions[key] = '';
      }
    });

    console.log('questions', questions);
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
    // return {
    //   'Reference No. / الرقم المرجعي': ticket.refNo,
    //   'Date of receipt تاريخ الاستلام': ticket.createdAt,
    //   'Received byاستلم بواسطة': '',
    //   'Received fromتم الاستلام من': `${ticket.creator.firstName} ${ticket.creator.lastName}`,
    //   'Nature of request / طبيعة الطلب': ticket.requestNature,
    //   ...questions,
    // };

    const filteredQuestions = Object.fromEntries(
      Object.entries(questions).filter(
        ([key, value]) =>
          key !== 'Date of receipt تاريخ الاستلام' &&
          key !== 'Received by استلم بواسطة' &&
          key !== 'Date of resolving تاريخ حل الشكوي'
      )
    );

    return {
      refNo: ticket.refNo,
      createdAt: ticket.createdAt,
      by: questions['Received by استلم بواسطة'],
      creator: `${ticket.creator.firstName} ${ticket.creator.lastName}`,
      requestNature: ticket.requestNature,
      requestType: ticket.requestType,
      ...filteredQuestions,
      solvingTime:
        ticket.status.category === 'solved' ? ticket.solvingTime : '',
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

  worksheet.columns = [
    { header: 'Reference No. \n الرقم المرجعي', key: 'refNo', width: 18 },
    {
      header: 'Date of receipt \n تاريخ الاستلام',
      key: 'createdAt',
      width: 20,
    },
    { header: 'Received by \n استلم بواسطة', key: 'by', width: 20 },
    { header: 'Received from \n تم الاستلام من', key: 'creator', width: 27 },
    {
      header: 'Nature of request \n  طبيعة الطلب',
      key: 'requestNature',
      width: 27,
    },
    {
      header: 'Type of request \n  نوع الطلب',
      key: 'requestType',
      width: 29,
    },

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
    {
      header: 'Date of resolving \n تاريخ حل الشكوي',
      key: 'solvingTime',
      width: 21,
    },
    // {
    //   header: 'approval of concerned manager \n اعتماد المدير المختص',
    //   width: 24,
    // },
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
    `Rev. No.0 \n Issue Date: ${new Date().toLocaleDateString()}`,
  ]);

  // Define the range for merging cells
  const mergeRanges = [
    { start: 'B1', end: 'F1' },
    { start: 'K1', end: 'L1' },
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

  worksheet.getCell('K1').font = { size: 11 };
  worksheet.getCell('K1').alignment = {
    vertical: 'middle',
    horizontal: 'start',
    wrapText: true,
  };

  // Write to an Excel file
  await workbook.xlsx.writeFile(fileName);
  console.log('Excel file created successfully!');

  // Send the Excel file as a response
  res.download(fileName, () => {
    // Remove the file after sending
    fs.unlinkSync(fileName);
  });
};

const multerStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    // console.log('file==============', file);

    cb(null, 'public');
  },
  filename: (req, file, cb) => {
    const ext =
      file.mimetype.split('/')[0] === 'image' ||
      file.mimetype.split('/')[0] === 'video' ||
      file.mimetype.split('/')[0] === 'audio'
        ? file.mimetype.split('/')[1]
        : file.originalname.split('.')[file.originalname.split('.').length - 1];

    cb(
      null,
      `client-${req.endUser._id}-${Date.now()}-${Math.floor(
        Math.random() * 1000
      )}.${ext}`
    );
  },
});

const multerFilter = (req, file, cb) => {
  // if (file.mimetype.startsWith('image')) {
  //   cb(null, true);
  // } else {
  //   cb(new AppError('Not an image! Please upload only images.', 400), false);
  // }
  cb(null, true);
};

const upload = multer({
  storage: multerStorage,
  fileFilter: multerFilter,
});

exports.uploadMultiFiles = upload.array('files');

exports.getAllEndUserTickets = catchAsync(async (req, res, next) => {
  const filteredBody = {
    $or: [{ endUser: req.endUser._id }, { 'client.number': req.endUser.phone }],
  };

  if (req.query.category) {
    filteredBody.category = req.query.category;
  }

  if (req.query.status) {
    const statusesIDs = req.query.status.split(',');
    filteredBody.status = { $in: statusesIDs };
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
    const assigneesIDs = req.query.assignee.split(',');
    filteredBody.assignee = { $in: assigneesIDs };
  }

  if (req.query.creator) {
    const creatorIDs = req.query.creator.split(',');
    filteredBody.creator = { $in: creatorIDs };
  }

  if (req.query.team) {
    filteredBody.team = req.query.team;
  }

  if (req.query.refNo) {
    filteredBody.refNo = { $regex: req.query.refNo };
  }

  if (req.query.order && !isNaN(req.query.order * 1)) {
    filteredBody.order = req.query.order * 1;
  }

  if (req.query.requestNature) {
    filteredBody.requestNature = req.query.requestNature;
  }

  if (req.query.requestType) {
    filteredBody.requestType = req.query.requestType;
  }

  const page = req.query.page * 1 || 1;

  const tickets = await Ticket.find(filteredBody)
    .sort('-createdAt')
    .populate('category', 'name')
    .populate('endUser', 'name nationalID phone')
    .populate('creator', 'firstName lastName photo')
    .populate('assignee', 'firstName lastName photo')
    .populate('team', 'name')
    .populate('status', 'endUserDisplayName category')
    .select(
      '-form -questions -client -users -clientToken -complaintReport -tags -solvingTime -solvingUser -rating -feedback'
    )
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
});

exports.getEndUserTicket = catchAsync(async (req, res, next) => {
  const ticketID = req.params.ticketID;

  // let ticket = await getPopulatedTicket({ _id: ticketID });
  let ticket = await Ticket.findById(ticketID)
    .populate('category', 'name')
    .populate('creator', 'firstName lastName photo')
    .populate('endUser', 'nationalID name phone')
    .populate('assignee', 'firstName lastName photo email')
    .populate('solvingUser', 'firstName lastName photo')
    .populate('team', 'name')
    .populate('status', 'endUserDisplayName category')
    .populate('form', 'name')
    .populate({
      path: 'questions.field',
      select: 'type endUserView endUserPermission',
      populate: { path: 'type', select: 'name value description' },
    })
    .select('-users -clientToken -complaintReport -tags -priority')
    .lean();

  if (!ticket) {
    return next(new AppError('No ticket found with that ID!', 404));
  }

  ticket = {
    ...ticket,
    questions: ticket.questions.filter((item) =>
      ['view', 'edit'].includes(item.field.endUserPermission)
    ),
  };

  // console.log('ticket', ticket);
  const ticketLogs = await TicketLog.find({ ticket: ticketID, type: 'public' })
    .populate({
      path: 'user',
      select: 'firstName lastName photo team',
      populate: { path: 'team', select: 'name' },
    })
    .populate({
      path: 'assignee',
      select: 'firstName lastName photo team',
      populate: { path: 'team', select: 'name' },
    })
    .populate('endUser', 'nationalID name phone')
    .populate('transfer.from.user', 'firstName lastName photo')
    .populate('transfer.to.user', 'firstName lastName photo')
    .populate('transfer.from.team', 'name')
    .populate('transfer.to.team', 'name')
    .populate('status', 'endUserDisplayName category')
    .select('-updatedAt');

  const ticketComments = await Comment.find({
    ticket: ticketID,
    type: { $ne: 'note' },
  })
    .populate('user', 'firstName lastName photo')
    .populate('endUser', 'nationalID name phone')
    .select('-updatedAt');

  const pastTickets = await Ticket.find({ refNo: ticket.refNo })
    .sort('-createdAt')
    .populate('category', 'name')
    .populate('endUser', 'name nationalID phone')
    .populate('creator', 'firstName lastName photo')
    .populate('assignee', 'firstName lastName photo')
    .populate('team', 'name')
    .populate('status', 'endUserDisplayName category')
    .select(
      '-form -questions -users -clientToken -complaintReport -tags -priority -solvingTime -solvingUser -rating -feedback'
    );

  res.status(200).json({
    status: 'success',
    data: {
      ticket,
      ticketLogs,
      ticketComments,
      pastTickets,
    },
  });
});

exports.createEndUserTicket = catchAsync(async (req, res, next) => {
  let {
    category,
    // team,
    // assignee,
    // client,
    // priority,
    // status,
    refNo,
    requestNature,
    requestType,
    // complaintReport,
    // form,
    // questions,
    ticketDescription,
  } = req.body;

  //================> Selecting type
  const type = 'endUser';

  //================> creating client
  const client = {
    name: req.endUser.name,
    number: req.endUser.phone,
  };
  if (req.body.email) {
    client.email = req.body.email;
  }

  //================> Selecting priority
  const priority = 'Normal';

  //================> Selecting Status
  const statusDoc = await TicketStatus.findOne({ default: true });
  const status = statusDoc._id;

  //================> Selecting team
  const team = await Team.findOne({ default: true });

  //================> Selecting assignee
  const teamDoc = await Team.findById(team);

  let teamUsers = [];
  for (let i = 0; i < teamDoc.users.length; i++) {
    let teamUser = await User.findOne({
      _id: teamDoc.users[i],
      deleted: false,
    });

    if (!teamUser.tasks || teamUser.tasks.includes('tickets')) {
      teamUsers = [...teamUsers, teamUser];
    }
  }

  if (teamUsers.length === 0) {
    return next(
      new AppError("This team doesn't have any user to deal with tickets!", 400)
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
  const assignee = teamUsers[0]._id;
  //   console.log('assignee============>', assignee);

  if (
    !category ||
    // !team ||
    // !client ||
    // (!client.email && !client.number) ||
    // !priority ||
    !refNo ||
    !requestNature ||
    !requestType ||
    // !form ||
    // !questions ||
    // questions.length === 0
    !ticketDescription
  ) {
    return next(new AppError('Ticket details are required!', 422));
  }

  const newTicketData = {
    type,
    endUser: req.endUser._id,
    // creator: req.user._id,
    category,
    assignee,
    team,
    users: [],
    client,
    priority,
    status,
    refNo,
    requestNature,
    requestType,
    // form,
    tags: [],
  };

  // ----------> Adding complaint report ability
  //   if (newTicketData.requestNature === 'Complaint') {
  //     newTicketData.complaintReport = complaintReport;
  //   }

  // ----------> Adding questions
  const formID = process.env.ENDUSER_FORM;
  const formDoc = await Form.findById(formID);
  //   const formDoc = await Form.findById(form);
  //   if (questions.length !== formDoc.fields.length) {
  //     return next(
  //       new AppError('Invalid questions depending on form fields!', 400)
  //     );
  //   }

  const questions = formDoc.fields.map((field) => {
    if (field.order === 1) {
      return { field: field.field, answer: [new Date().toLocaleDateString()] };
    } else if (field.order === 2) {
      return { field: field.field, answer: ['EUA'] };
    } else if (field.order === 3) {
      return { field: field.field, answer: [ticketDescription] };
    } else {
      return { field: field.field };
    }
  });

  newTicketData.form = formDoc._id;
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
  newTicketData.users.push(assignee);
  //   newTicketData.users.push(req.user._id);
  //   if (!req.user._id.equals(assignee)) {
  //     newTicketData.users.push(assignee);
  //   }

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
    // await TicketLog.create(
    //   [
    //     {
    //       ticket: ticket[0]._id,
    //       log: 'create',
    //       user: req.user._id,
    //       status: newTicketData.status,
    //     },
    //   ],
    //   {
    //     session: transactionSession,
    //   }
    // );

    // =====================> Assign Ticket Log
    const ticketCreateLog = await TicketLog.create(
      [
        {
          ticket: ticket[0]._id,
          log: 'endUserTicket',
          //   user: req.user._id,
          assignee: newTicketData.assignee,
        },
      ],
      {
        session: transactionSession,
      }
    );
    console.log('ticketCreateLog', ticketCreateLog);

    // =====================> New Ticket Notification
    const newNotificationData = {
      type: 'tickets',
      user: ticket[0].assignee,
      ticket: ticket[0]._id,
      event: 'newTicket',
    };
    const newNotification = await Notification.create([newNotificationData], {
      session: transactionSession,
    });

    console.log('newNotification', newNotification);

    newTicket = ticket[0];

    await transactionSession.commitTransaction(); // Commit the transaction

    // console.log('New ticket created: ============', ticket[0]._id);
  } catch (error) {
    await transactionSession.abortTransaction();

    console.error(
      'Transaction aborted due to an error: ===========================',
      error
    );

    return next(new AppError('Creating ticket aborted! Try again later.', 400));
  } finally {
    transactionSession.endSession();
  }

  if (newTicket) {
    // req.body.ticketID = newTicket._id;
    // req.body.link = 'Not found!';
    // await ticketUtilsHandler.notifyClientHandler(req, newTicket);

    const updatedTicket = await getPopulatedTicket({ _id: newTicket._id });

    const text = `Dear ${updatedTicket.assignee.firstName},

    Kindly check your tickets, you have a new ticket no. ${newTicket.order} with Ref No. ${newTicket.refNo}
    
    Regards.`;

    const emailDetails = {
      to: updatedTicket.assignee.email,
      subject: `New ticket no. ${newTicket.order}`,
      text,
      attachments: [],
    };

    // console.log('emailDetails', emailDetails);

    mailerSendEmail(emailDetails);
    //--------------------> updating ticket event in socket io
    req.app.io.emit('updatingTickets', { ticketID: newTicket._id });

    //--------------------> updating notifications event in socket io
    if (
      //   !newTicket.creator.equals(newTicket.assignee) &&
      req.app.connectedUsers[newTicket.assignee]
    ) {
      req.app.connectedUsers[newTicket.assignee].emit('updatingNotifications');
    }

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

exports.getAllEndUserPastTickets = catchAsync(async (req, res, next) => {
  const ticket = await Ticket.findById(req.params.ticketID);

  if (!ticket) {
    return next(new AppError('No ticket found with that ID!', 404));
  }

  const tickets = await Ticket.find({
    refNo: ticket.refNo,
    _id: { $ne: ticket._id },
  })
    .select('-questions -client -users -type')
    .populate('category', 'name')
    .populate('creator', 'firstName lastName photo')
    .populate('endUser', 'nationalID name phone')
    .populate('assignee', 'firstName lastName photo')
    .populate('solvingUser', 'firstName lastName photo')
    .populate('team', 'name')
    .populate('status', 'endUserDisplayName category');

  res.status(200).json({
    status: 'success',
    results: tickets.length,
    data: {
      tickets,
    },
  });
});

exports.sendFeedback = catchAsync(async (req, res, next) => {
  const { rating, feedback } = req.body;

  const ticket = await Ticket.findById(req.params.ticketID);
  if (!ticket) {
    return next(new AppError('No ticket found with that ID!'), 404);
  }

  if (!rating) {
    return next(new AppError('Client rating is required!', 400));
  }

  // make sure the end user is the owner of the ticket
  if (
    !req.endUser._id.equals(ticket.endUser) &&
    ticket.client.number !== req.endUser.phone
  ) {
    return next(
      new AppError(`You don't have the permission to perform this action!`, 404)
    );
  }

  const updatedBody = { rating };

  if (feedback) updatedBody.feedback = feedback;

  const updatedTicket = await Ticket.findByIdAndUpdate(
    req.params.ticketID,
    updatedBody,
    { new: true, runValidators: true }
  );

  //--------------------> updating ticket event in socket io
  req.app.io.emit('updatingTickets', { ticketID: req.params.ticketID });

  res.status(200).json({
    status: 'success',
    data: {
      ticket: updatedTicket,
    },
  });
});

exports.createEndUserComment = catchAsync(async (req, res, next) => {
  const ticket = await Ticket.findById(req.params.ticketID);

  if (!ticket) {
    return next(new AppError('No ticket found with that ID!', 404));
  }

  if (ticket.status.category === 'solved') {
    return next(new AppError("Couldn't update solved ticket!", 400));
  }

  // const previousComments = await Comment.find({
  //   ticket: ticket._id,
  //   type: 'public',
  // });

  // if (previousComments.length === 0) {
  //   return next(new AppError("Couldn't add comments!", 400));
  // }

  if (!req.body.text && (!req.files || req.files.length === 0)) {
    return next(new AppError('Comment body is required!', 400));
  }

  const newCommentData = {
    ticket: ticket._id,
    type: 'endUser',
    endUser: req.endUser._id,
  };

  if (req.body.text) {
    newCommentData.text = req.body.text;
  }

  if (req.files) {
    const attachments = req.files.map((item) => ({
      file: item.filename,
      filename: item.originalname,
    }));
    newCommentData.attachments = attachments;
  }

  const notificationUsersIDs = new Set();

  const newComment = await Comment.create(newCommentData);
  const populatedComment = await newComment.populate(
    'endUser',
    'name phone nationalID'
  );

  // =====================> Comment Ticket Log
  await TicketLog.create({
    ticket: ticket._id,
    log: 'endUserComment',
    endUser: req.endUser._id,
  });

  // =====================> New Comment Notification
  const newNotificationData = {
    type: 'tickets',
    ticket: ticket._id,
    event: 'newComment',
    message: `New comment on ticket no. ${ticket.order} from end user`,
  };

  const assigneeNotification = await Notification.create({
    ...newNotificationData,
    user: ticket.assignee,
  });
  //   console.log('assigneeNotification', assigneeNotification);

  notificationUsersIDs.add(ticket.assignee);

  if (ticket.creator && !ticket.creator?.equals(ticket.assignee)) {
    const creatorNotification = await Notification.create({
      ...newNotificationData,
      user: ticket.creator,
    });

    // console.log('creatorNotification', creatorNotification);

    notificationUsersIDs.add(ticket.creator);
  }

  // -----------------> end user notification
  if (ticket.endUser && !ticket.endUser.equals(req.endUser._id)) {
    const endUserNotificationData = {
      type: 'tickets',
      endUser: ticket.endUser,
      ticket: ticket._id,
      event: 'newComment',
    };
    const endUserNotification = await EndUserNotification.create(
      endUserNotificationData
    );

    console.log('endUserNotification ==============>', endUserNotification);
  }

  //--------------------> updating ticket event in socket io
  req.app.io.emit('updatingTickets', { ticketID: ticket._id });

  //--------------------> updating notifications event in socket io
  Array.from(notificationUsersIDs).map((userID) => {
    if (req.app.connectedUsers[userID]) {
      req.app.connectedUsers[userID].emit('updatingNotifications');
    }
  });

  res.status(201).json({
    status: 'success',
    data: {
      comment: populatedComment,
    },
  });
});

exports.getAllEndUserTicketCategories = catchAsync(async (req, res, next) => {
  const categories = await TicketCategory.find().select('name');

  res.status(200).json({
    status: 'success',
    results: categories.length,
    data: {
      categories,
    },
  });
});

exports.getAllEndUserTicketStatuses = catchAsync(async (req, res, next) => {
  const filteredBody = {};

  if (req.query.status) {
    filteredBody.status = req.query.status;
  }

  const statuses = await TicketStatus.find(filteredBody).select(
    'endUserDisplayName category status'
  );

  res.status(200).json({
    status: 'success',
    results: statuses.length,
    data: {
      statuses,
    },
  });
});

exports.getAllTicketsTeams = catchAsync(async (req, res, next) => {
  const teams = await Team.find({ bot: false }).select('name');

  res.status(200).json({
    status: 'success',
    results: teams.length,
    data: {
      teams,
    },
  });
});
