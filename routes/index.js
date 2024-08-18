const express = require('express');
const webhookRouter = require('./webhookRoutes');
const userRouter = require('./userRoutes');
const teamRoutes = require('./teamRoutes');
const answerRouter = require('./answerRoutes');
const answersSetRouter = require('./answersSetRoutes');
const conversationRouter = require('./conversationRoutes');
const serviceRouter = require('./serviceRoutes');
const chatRouter = require('./chatRoutes');
const contactRouter = require('./contactRoutes');
const noteRouter = require('./noteRoutes');
const sessionRouter = require('./sessionRoutes');
const performanceRouter = require('./performanceRoutes');
const messageRouter = require('./messageRoutes');
const broadcastRouter = require('./broadcastRoutes');
const uploadRouter = require('./uploadRoutes');
const whatsappTemplateRouter = require('./whatsappTemplateRoutes');
const logRoutes = require('./logRoutes');
const historyRoutes = require('./historyRoutes');

// Ticket System
const fieldTypeRouter = require('./ticketSystem/fieldTypeRoutes');
const fieldRouter = require('./ticketSystem/fieldRoutes');
const formRouter = require('./ticketSystem/formRoutes');
const ticketRouter = require('./ticketSystem/ticketRoutes');
const ticketCategoryRouter = require('./ticketSystem/ticketCategoryRoutes');
const ticketStatusRouter = require('./ticketSystem/ticketStatusRoutes');
const commentRouter = require('./ticketSystem/commentRoutes');

const router = express.Router();

router.use('/webhook', webhookRouter);
router.use('/users', userRouter);
router.use('/teams', teamRoutes);
router.use('/answers', answerRouter);
router.use('/answers-sets', answersSetRouter);
router.use('/conversations', conversationRouter);
router.use('/services', serviceRouter);
router.use('/chats', chatRouter);
router.use('/contacts', contactRouter);
router.use('/notes', noteRouter);
router.use('/sessions', sessionRouter);
router.use('/performance', performanceRouter);
router.use('/messages', messageRouter);
router.use('/broadcast', broadcastRouter);
router.use('/upload', uploadRouter);
router.use('/whatsapp-templates', whatsappTemplateRouter);
router.use('/logs', logRoutes);
router.use('histories', historyRoutes);

// Ticket System
router.use('/fieldtypes', fieldTypeRouter);
router.use('/fields', fieldRouter);
router.use('/forms', formRouter);
router.use('/tickets', ticketRouter);
router.use('/ticketCategories', ticketCategoryRouter);
router.use('/ticketStatuses', ticketStatusRouter);
router.use('/comments', commentRouter);

module.exports = router;
