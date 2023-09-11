const express = require('express');
const webhookRouter = require('./webhookRoutes');
const userRouter = require('./userRoutes');
const answerRouter = require('./answerRoutes');
const answersSetRouter = require('./answersSetRoutes');
const conversationRouter = require('./conversationRoutes');
const serviceRouter = require('./serviceRoutes');
const departmentRouter = require('./departmentRoutes');
const chatRouter = require('./chatRoutes');
const messageRouter = require('./messageRoutes');

const router = express.Router();

router.use('/webhook', webhookRouter);
router.use('/users', userRouter);
router.use('/answers', answerRouter);
router.use('/answers-sets', answersSetRouter);
router.use('/conversations', conversationRouter);
router.use('/services', serviceRouter);
router.use('/departments', departmentRouter);
router.use('/chats', chatRouter);
router.use('/messages', messageRouter);

module.exports = router;
