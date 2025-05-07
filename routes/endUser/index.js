const express = require('express');

const endUserAuthRouter = require('./endUserAuthRoutes');
const endUserTicketRouter = require('./endUserTicketRoutes');
const endUserTicketUtilsRoutes = require('./endUserTicketUtilsRoutes');
const endUserChatRouter = require('./endUserChatRoutes');
const endUserNotificationsRouter = require('./endUserNotificationRoutes');

const router = express.Router();

router.use('/token', endUserAuthRouter);
router.use('/tickets', endUserTicketRouter);
router.use('/', endUserTicketUtilsRoutes);
router.use('/messages', endUserChatRouter);
router.use('/notifications', endUserNotificationsRouter);

module.exports = router;
