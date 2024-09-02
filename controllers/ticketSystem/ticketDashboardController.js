const AppError = require('../../utils/appError');
const catchAsync = require('../../utils/catchAsync');

const Ticket = require('../../models/ticketSystem/ticketModel');
const getDateRange = require('../../utils/dateRangeFilter');

exports.getAllTicketsNumber = catchAsync(async (req, res, next) => {
  const filteredBody = {};

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

  if (req.query.startDate) {
  }

  const tickets = await Ticket.find(filteredBody)
    .select('status createdAt solvingTime')
    .populate('status', 'category');

  // =================> Total tickets
  const totalTickets = tickets.length;

  // =================> Solved tickets
  const solvedTickets = tickets.filter(
    (ticket) => ticket.status.category === 'solved'
  );

  // =================> Unsolved tickets
  const unsolvedTickets = totalTickets - solvedTickets.length;

  // =================> Solved time average
  const solvedTicketsTime = solvedTickets
    .filter(
      (ticket) => ticket.status.category === 'solved' && ticket.solvingTime
    )
    .map((item) => item.solvingTime - item.createdAt);

  //   console.log('solvedTicketsTime', solvedTicketsTime);

  function convertMillisecondsToHoursMinutes(milliseconds) {
    // Convert milliseconds to total seconds
    const totalSeconds = Math.floor(milliseconds / 1000);

    // Calculate total minutes from total seconds
    const totalMinutes = Math.floor(totalSeconds / 60);

    // Calculate hours from total minutes
    const hours = Math.floor(totalMinutes / 60);

    // Remaining minutes after converting to hours
    const minutes = totalMinutes % 60;

    return { hours, minutes };
  }

  let solvedTimeAverage;
  if (solvedTicketsTime.length > 0) {
    solvedTimeAverage =
      solvedTicketsTime.reduce((acc, cur) => {
        return acc + cur;
      }, 0) / solvedTicketsTime.length;

    solvedTimeAverage = convertMillisecondsToHoursMinutes(solvedTimeAverage);
  }

  res.status(200).json({
    status: 'success',
    data: {
      totalTickets,
      solvedTickets: solvedTickets.length,
      unsolvedTickets,
      solvedTimeAverage,
    },
  });
});

exports.getAllTicketsPriority = catchAsync(async (req, res, next) => {
  const filteredBody = {};

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

  const tickets = await Ticket.find(filteredBody).select('priority');

  const Urgent = tickets.filter(
    (ticket) => ticket.priority === 'Urgent'
  ).length;
  const High = tickets.filter((ticket) => ticket.priority === 'High').length;
  const Normal = tickets.filter(
    (ticket) => ticket.priority === 'Normal'
  ).length;
  const Low = tickets.filter((ticket) => ticket.priority === 'Low').length;

  res.status(200).json({
    status: 'success',
    data: {
      total: tickets.length,
      Urgent,
      High,
      Normal,
      Low,
    },
  });
});

exports.getAllTicketRequestNature = catchAsync(async (req, res, next) => {
  const filteredBody = {};

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

  const tickets = await Ticket.find(filteredBody).select('requestNature');

  const Request = tickets.filter(
    (ticket) => ticket.requestNature === 'Request'
  ).length;
  const Complaint = tickets.filter(
    (ticket) => ticket.requestNature === 'Complaint'
  ).length;
  const Inquiry = tickets.filter(
    (ticket) => ticket.requestNature === 'Inquiry'
  ).length;

  res.status(200).json({
    status: 'success',
    data: {
      total: tickets.length,
      Request,
      Complaint,
      Inquiry,
    },
  });
});

exports.getAllTicketRequestType = catchAsync(async (req, res, next) => {
  const filteredBody = {};

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

  const tickets = await Ticket.find(filteredBody).select('requestType');

  const RD0 = tickets.filter((ticket) => ticket.requestType === 'RD0').length;
  const EditRD0 = tickets.filter(
    (ticket) => ticket.requestType === 'Edit RD0'
  ).length;
  const MissingData = tickets.filter(
    (ticket) => ticket.requestType === 'Missing Data'
  ).length;
  const DesignReview = tickets.filter(
    (ticket) => ticket.requestType === 'Design Review'
  ).length;
  const RD6 = tickets.filter((ticket) => ticket.requestType === 'RD6').length;
  const RD7 = tickets.filter((ticket) => ticket.requestType === 'RD7').length;
  const Finance = tickets.filter(
    (ticket) => ticket.requestType === 'Finance'
  ).length;
  const Inspection = tickets.filter(
    (ticket) => ticket.requestType === 'Inspection'
  ).length;
  const MALATHIssue = tickets.filter(
    (ticket) => ticket.requestType === 'MALATH Issue'
  ).length;
  const MALATHComplaint = tickets.filter(
    (ticket) => ticket.requestType === 'MALATH Complaint'
  ).length;
  const Other = tickets.filter(
    (ticket) => ticket.requestType === 'Other'
  ).length;

  res.status(200).json({
    status: 'success',
    data: {
      total: tickets.length,
      RD0,
      EditRD0,
      MissingData,
      DesignReview,
      RD6,
      RD7,
      Finance,
      Inspection,
      MALATHIssue,
      MALATHComplaint,
      Other,
    },
  });
});

exports.getAllTicketsClientRating = catchAsync(async (req, res, next) => {
  const filteredBody = {};

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

  const tickets = await Ticket.find(filteredBody).select('rating');

  const responsesReceived = tickets.map((ticket) => ticket.rating).length;

  const Positive = tickets.filter(
    (ticket) => ticket.rating === 'Positive'
  ).length;
  const Negative = tickets.filter(
    (ticket) => ticket.rating === 'Negative'
  ).length;
  const Neutral = tickets.filter(
    (ticket) => ticket.rating === 'Neutral'
  ).length;

  res.status(200).json({
    status: 'success',
    data: {
      responsesReceived,
      Positive,
      Negative,
      Neutral,
    },
  });
});

exports.getWeeklySolvedTickets = catchAsync(async (req, res, next) => {
  const filteredBody = {};

  if (!req.query.startDate || !req.query.endDate) {
    return next(new AppError('Date range is required!', 400));
  }

  const start = new Date(req.query.startDate);
  const end = new Date(req.query.endDate);

  filteredBody.createdAt = {
    $gte: getDateRange(start, end).start,
    $lte: getDateRange(start, end).end,
  };

  console.log('filteredBody', filteredBody);

  const tickets = await Ticket.find(filteredBody)
    .select('status createdAt')
    .populate('status', 'category');

  const formatDate = (date) => {
    // const dateString = date.toISOString().split('T')[0];
    // // const month = date.toGetMonth();
    // return date.getMonth();

    console.log('date ======================== ', date.getDate(), date);

    // Get the day of the month
    const day = String(date.getDate()).padStart(2, '0');

    // Get the month name
    const monthNames = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];
    const month = monthNames[date.getMonth()];

    // Format the date as "DD Month"
    return `${day} ${month}`;
  };

  const groupedTickets = {};

  tickets.forEach((ticket) => {
    const ticketDate = new Date(ticket.createdAt);

    const day = formatDate(ticketDate);

    if (!groupedTickets[day]) {
      //   groupedTickets[day] = [];
      groupedTickets[day] = { totalTickets: 0, solvedTickets: 0 };
    }

    // groupedTickets[day].push(ticket);
    groupedTickets[day].totalTickets += 1;
    if (ticket.status.category === 'solved') {
      groupedTickets[day].solvedTickets += 1;
    }
  });

  res.status(200).json({
    status: 'success',
    data: {
      groupedTickets,
    },
  });
});
