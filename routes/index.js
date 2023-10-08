const express = require('express');
const webhookRouter = require('./webhookRoutes');
const userRouter = require('./userRoutes');
const teamRoutes = require('./teamRoutes');
const answerRouter = require('./answerRoutes');
const answersSetRouter = require('./answersSetRoutes');
const conversationRouter = require('./conversationRoutes');
const serviceRouter = require('./serviceRoutes');
const departmentRouter = require('./departmentRoutes');
const chatRouter = require('./chatRoutes');
const messageRouter = require('./messageRoutes');
const whatsappTemplateRouter = require('./whatsappTemplateRoutes');

const router = express.Router();

router.use('/webhook', webhookRouter);
router.use('/users', userRouter);
router.use('/teams', teamRoutes);
router.use('/answers', answerRouter);
router.use('/answers-sets', answersSetRouter);
router.use('/conversations', conversationRouter);
router.use('/services', serviceRouter);
router.use('/departments', departmentRouter);
router.use('/chats', chatRouter);
router.use('/messages', messageRouter);
router.use('/whatsapp-templates', whatsappTemplateRouter);

module.exports = router;
