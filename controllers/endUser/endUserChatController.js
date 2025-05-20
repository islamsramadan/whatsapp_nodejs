const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { Mutex } = require('async-mutex'); // This will prevent multiple concurrent requests from creating multiple chats & clients.
const chatCreationMutex = new Mutex();
const { promisify } = require('util');

const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/appError');

const sessionTimerUpdate = require('../../utils/sessionTimerUpdate');
const chatBotTimerUpdate = require('../../utils/chatBotTimerUpdate');
const serviceHoursUtils = require('../../utils/serviceHoursUtils');

const Chat = require('../../models/chatModel');
const EndUser = require('../../models/endUser/endUserModel');
const Team = require('../../models/teamModel');
const User = require('../../models/userModel');
const Session = require('../../models/sessionModel');
const ChatHistory = require('../../models/historyModel');
const Service = require('../../models/serviceModel');
const Message = require('../../models/messageModel');
const Notification = require('../../models/notificationModel');

const responseDangerTime = process.env.RESPONSE_DANGER_TIME;

const convertDate = (timestamp) => {
  const date = new Date(timestamp * 1);

  const hours =
    (date.getHours() + '').length > 1 ? date.getHours() : `0${date.getHours()}`;

  const minutes =
    (date.getMinutes() + '').length > 1
      ? date.getMinutes()
      : `0${date.getMinutes()}`;

  const seconds =
    (date.getSeconds() + '').length > 1
      ? date.getSeconds()
      : `0${date.getSeconds()}`;

  const dateString = date.toDateString();

  const dateFormat = `${hours}:${minutes}:${seconds}, ${dateString}`;

  return dateFormat;
};

const multerStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    // console.log('file==============', file);
    // cb(
    //   null,
    //   file.mimetype.split('/')[0] === 'image'
    //     ? 'public/img'
    //     : file.mimetype.split('/')[0] === 'video'
    //     ? 'public/videos'
    //     : file.mimetype.split('/')[0] === 'audio'
    //     ? 'public/audios'
    //     : 'public/docs'
    // );
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
      `endUser-${req.endUser.id}-${Date.now()}-${Math.floor(
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

exports.uploadMessageFile = upload.single('file');
exports.uploadMultiFiles = upload.array('files');

exports.getAllEndUserMessages = catchAsync(async (req, res, next) => {
  let chat = await Chat.findOne({ endUser: req.endUser._id });
  if (!chat) {
    chat = await Chat.create({
      type: 'endUser',
      endUser: req.endUser._id,
      status: 'archived',
    });
  }

  const page = req.query.page * 1 || 1;

  const messages = await Message.find({ chat: chat._id })
    .sort('-createdAt')
    .populate('reply')
    .limit(page * 20);

  const totalResults = await Message.count({ chat: chat._id });
  const totalPages = Math.ceil(totalResults / 20);

  let userStatus;

  if (chat.currentUser && chat.team && chat.status === 'open') {
    const currentUser = await User.findById(chat.currentUser);
    userStatus = currentUser.status;

    if (userStatus === 'Service hours') {
      const team = await Team.findById(chat.team);
      const serviceHours = await Service.findById(team.serviceHours);

      if (serviceHoursUtils.checkInsideServiceHours(serviceHours.durations)) {
        userStatus = 'Online';
      } else {
        userStatus = 'Offline';
      }
    }
  } else {
    const defaultTeam = await Team.findOne({ default: true });
    const defaultServiceHours = await Service.findById(
      defaultTeam.serviceHours
    );

    if (
      serviceHoursUtils.checkInsideServiceHours(defaultServiceHours.durations)
    ) {
      userStatus = 'Online';
    } else {
      userStatus = 'Offline';
    }
  }

  res.status(200).json({
    status: 'success',
    results: messages.length,
    data: {
      userStatus: userStatus,
      chatID: chat._id,
      page,
      totalPages,
      totalResults,
      messages: messages.reverse(),
    },
  });
});

exports.sendEndUserMessageCopy = catchAsync(async (req, res, next) => {
  const msgType = req.body.type;
  if (!msgType) {
    return next(new AppError('Message type is required!', 422));
  }

  {
    if (!['text', 'document', 'image', 'video'].includes(msgType)) {
      return next(new AppError('Invalid message Type!', 422));
    }

    // *********** Preparing the message ******************************
    const newMessageData = {
      chatType: 'endUser',
      // chat: selectedChat._id,
      // session: selectedSession._id,
      type: msgType,
      // fromEndUser: req.endUser._id,
      // status: 'received',
      // received: convertDate(Date.now()),
      // timer
    };

    // ------------------> Message Reply
    if (req.body.replyMessage) {
      const replyMessage = await Message.findById(req.body.replyMessage);
      if (replyMessage) {
        newMessageData.reply = req.body.replyMessage;
      }
    }

    // ------------------> Text Message
    if (req.body.type === 'text') {
      if (!req.body.text) {
        return next(new AppError('Message text body is required!', 422));
      }

      newMessageData.text = req.body.text;
    }

    // ------------------> Document Message
    if (req.body.type === 'document') {
      if (!req.file) {
        return next(new AppError('Document is required!', 422));
      }

      newMessageData.document = {
        file: req.file.filename,
        filename: req.file.originalname,
        caption: req.body.caption,
      };
    }

    // ------------------> Image Message
    if (req.body.type === 'image') {
      if (!req.file) {
        return next(new AppError('Image is required!', 422));
      }

      newMessageData.image = {
        file: req.file.filename,
        caption: req.body.caption,
      };
    }

    // ------------------> Video Message
    if (req.body.type === 'video') {
      if (!req.file) {
        return next(new AppError('Video is required!', 422));
      }

      newMessageData.video = {
        file: req.file.filename,
        caption: req.body.caption,
      };
    }

    // ********************************************************************************
    // ********************************************************************************

    // ======================> Selecting Chat
    async function createOrGetChat(endUser) {
      try {
        return chatCreationMutex.runExclusive(async () => {
          let selectedChat = await Chat.findOne({
            endUser: endUser._id,
          });

          if (!selectedChat) {
            //   const botTeam = await Team.findOne({ bot: true });
            const defaultTeam = await Team.findOne({ default: true }); // default team temporarily

            selectedChat = await Chat.create({
              type: 'endUser',
              status: 'archived',
              endUser: endUser._id,
            });
          }

          return selectedChat;
        });
      } catch (error) {
        console.error('Error in createOrGetChat:', error);
        throw error; // Re-throw the error after logging it
      }
    }

    const selectedChat = await createOrGetChat(req.endUser);

    // ****************************************************************************
    // ****************************************************************************

    // ======================> Selecting Session
    // const session = await Session.findById(selectedChat.lastSession);
    // let selectedSession = session;
    let selectedSession = await Session.findById(selectedChat.lastSession);

    if (!selectedSession) {
      async function ensureSessionForChat(selectedChat) {
        const maxRetries = 3; // Set a maximum number of retries
        let attempts = 0;

        while (attempts < maxRetries) {
          const transactionSession = await mongoose.startSession(); // Start a transaction transactionSession
          try {
            transactionSession.startTransaction();

            const chat = await Chat.findById(selectedChat._id).session(
              transactionSession
            );

            if (!chat.lastSession) {
              // ------------------> default team instead of bot team teperoraily
              // const botTeam = await Team.findOne({ bot: true }).session(
              //   transactionSession
              // );
              const selectedTeam = await Team.findOne({
                default: true,
              }).session(transactionSession);

              let teamUsers = await Promise.all(
                selectedTeam.users.map(async function (user) {
                  let teamUser = await User.findById(user);
                  return teamUser;
                })
              );
              // console.log('teamUsers', teamUsers);

              // status sorting order
              const statusSortingOrder = [
                'Online',
                'Service hours',
                'Offline',
                'Away',
              ];

              // teamUsers = teamUsers.sort((a, b) => a.chats.length - b.chats.length);
              teamUsers = teamUsers.sort((a, b) => {
                const orderA = statusSortingOrder.indexOf(a.status);
                const orderB = statusSortingOrder.indexOf(b.status);

                // If 'status' is the same, then sort by chats length
                if (orderA === orderB) {
                  return a.chats.length - b.chats.length;
                }

                // Otherwise, sort by 'status'
                return orderA - orderB;
              });

              const newSession = await Session.create(
                [
                  {
                    chat: chat._id,
                    user: teamUsers[0]._id,
                    team: selectedTeam._id,
                    // status: 'onTime',
                    type: 'normal',
                  },
                ],
                { session: transactionSession }
              );

              chat.lastSession = newSession[0]._id;
              chat.currentUser = teamUsers[0]._id;
              chat.team = selectedTeam._id;
              chat.status = 'open';
              await chat.save({ session: transactionSession });

              //   // =======> Create chat history session
              const chatHistoryData = {
                chat: chat._id,
                user: teamUsers[0]._id,
                actionType: 'receive',
                receive: teamUsers[0]._id,
              };
              await ChatHistory.create([chatHistoryData], {
                session: transactionSession,
              });

              // =======> Adding the selected chat to the user chats
              if (!teamUsers[0].chats.includes(chat._id)) {
                await User.findByIdAndUpdate(
                  teamUsers[0]._id,
                  { $push: { chats: chat._id } },
                  { new: true, runValidators: true }
                ).session(transactionSession);
              }

              await transactionSession.commitTransaction(); // Commit the transaction
              transactionSession.endSession();
              console.log('New session created:', newSession[0]._id);
              return newSession[0];
            } else {
              await transactionSession.abortTransaction();
              transactionSession.endSession();
              console.log('Using existing session:', chat.lastSession);
              return await Session.findById(chat.lastSession);
            }
          } catch (error) {
            // console.log('error *************************** ', error);
            attempts++;
            await transactionSession.abortTransaction();
            transactionSession.endSession();

            if (attempts >= maxRetries) {
              throw error; // If max retries exceeded, throw the error
            }
          }
        }
      }

      selectedSession = await ensureSessionForChat(selectedChat);
    }

    // *********** End of selecting Chat & Session **************************

    // ********************************************************************************
    // ---------------------> Create the message
    newMessageData.chat = selectedChat._id;
    newMessageData.session = selectedSession._id;
    newMessageData.fromEndUser = req.endUser._id;
    newMessageData.status = 'received';
    newMessageData.received = convertDate(Date.now());

    const newMessage = await Message.create(newMessageData);

    // ================> updating session performance
    selectedSession.performance.all += 1;
    selectedSession.performance.onTime += 1;
    await selectedSession.save();

    // ***************** Adjusting session & message timer ******************
    const team = await Team.findById(selectedSession.team);
    const teamServiceHours = await Service.findById(team.serviceHours);
    let timer = new Date();

    if (
      !serviceHoursUtils.checkInsideServiceHours(teamServiceHours.durations)
    ) {
      timer = serviceHoursUtils.getTheNextServiceHours(
        teamServiceHours.durations
      );
    }

    let delay = {
      hours: teamServiceHours.responseTime.hours,
      minutes: teamServiceHours.responseTime.minutes,
    };

    timer.setMinutes(timer.getMinutes() + delay.minutes * 1);
    timer.setHours(timer.getHours() + delay.hours * 1);

    // ***************** Updating session status ******************
    if (!['onTime', 'danger', 'tooLate'].includes(selectedSession.status)) {
      selectedSession.timer = timer;
      selectedSession.status = 'onTime';
      await selectedSession.save();

      const sessions = await Session.find({
        timer: {
          $exists: true,
          $ne: '',
        },
      });
      await sessionTimerUpdate.scheduleDocumentUpdateTask(
        sessions,
        req,
        responseDangerTime, //from config.env
        teamServiceHours.responseTime
      );
    }

    // ***************** Updating session Performance ******************
    newMessage.timer = timer;
    await newMessage.save();

    await sessionTimerUpdate.schedulePerformance(
      req,
      newMessage,
      responseDangerTime, //from config.env
      teamServiceHours.responseTime
    );

    // ***************** Sending response message ******************
    res.status(201).json({
      status: 'success',
      data: {
        message: newMessage,
      },
    });
  }
});

exports.sendEndUserMessage = catchAsync(async (req, res, next) => {
  const msgType = req.body.type;
  if (!msgType) {
    return next(new AppError('Message type is required!', 422));
  }

  if (!['text', 'document', 'image', 'video'].includes(msgType)) {
    return next(new AppError('Invalid message Type!', 422));
  }

  // *********** Preparing the message ******************************
  const newMessageData = {
    chatType: 'endUser',
    // chat: selectedChat._id,
    // session: selectedSession._id,
    type: msgType,
    // fromEndUser: req.endUser._id,
    // status: 'received',
    // received: convertDate(Date.now()),
    // timer
  };

  // ------------------> Message Reply
  if (req.body.replyMessage) {
    const replyMessage = await Message.findById(req.body.replyMessage);
    if (replyMessage) {
      newMessageData.reply = req.body.replyMessage;
    }
  }

  // ------------------> Text Message
  if (req.body.type === 'text') {
    if (!req.body.text) {
      return next(new AppError('Message text body is required!', 422));
    }

    newMessageData.text = req.body.text;
  }

  // ------------------> Document Message
  if (req.body.type === 'document') {
    if (!req.file) {
      return next(new AppError('Document is required!', 422));
    }

    newMessageData.document = {
      file: req.file.filename,
      filename: req.file.originalname,
      caption: req.body.caption,
    };
  }

  // ------------------> Image Message
  if (req.body.type === 'image') {
    if (!req.file) {
      return next(new AppError('Image is required!', 422));
    }

    newMessageData.image = {
      file: req.file.filename,
      caption: req.body.caption,
    };
  }

  // ------------------> Video Message
  if (req.body.type === 'video') {
    if (!req.file) {
      return next(new AppError('Video is required!', 422));
    }

    newMessageData.video = {
      file: req.file.filename,
      caption: req.body.caption,
    };
  }

  // ********************************************************************************
  // ===============================> Create message in transaction session

  let selectedChat, selectedSession, newMessage;

  const transactionSession = await mongoose.startSession();
  transactionSession.startTransaction();

  try {
    selectedChat = await Chat.findOne({
      endUser: req.endUser._id,
    });
    // .session(transactionSession);

    if (!selectedChat) {
      const newChat = await Chat.create(
        [
          {
            type: 'endUser',
            endUser: req.endUser._id,
            status: 'archived',
          },
        ],
        { session: transactionSession }
      );

      selectedChat = newChat[0];
    }

    console.log('selectedChat ========================', selectedChat);

    selectedSession = await Session.findById(selectedChat.lastSession);
    // .session( transactionSession );

    if (!selectedSession) {
      // ------------------> default team instead of bot team teperoraily
      // const botTeam = await Team.findOne({ bot: true }).session(
      //   transactionSession
      // );
      const defaultTeam = await Team.findOne({
        default: true,
      });
      // .session(transactionSession);

      let teamUsers = await Promise.all(
        defaultTeam.users.map(async function (user) {
          let teamUser = await User.findById(user);
          // .session(transactionSession);
          return teamUser;
        })
      );
      // console.log('teamUsers', teamUsers);

      // status sorting order
      const statusSortingOrder = ['Online', 'Service hours', 'Offline', 'Away'];

      // teamUsers = teamUsers.sort((a, b) => a.chats.length - b.chats.length);
      teamUsers = teamUsers.sort((a, b) => {
        const orderA = statusSortingOrder.indexOf(a.status);
        const orderB = statusSortingOrder.indexOf(b.status);

        // If 'status' is the same, then sort by chats length
        if (orderA === orderB) {
          return a.chats.length - b.chats.length;
        }

        // Otherwise, sort by 'status'
        return orderA - orderB;
      });

      const newSession = await Session.create(
        [
          {
            chat: selectedChat._id,
            chatType: 'endUser',
            user: teamUsers[0]._id,
            team: defaultTeam._id,
            status: 'onTime',
            type: 'normal',
          },
        ],
        { session: transactionSession }
      );

      selectedSession = newSession[0];

      // selectedChat.lastSession = selectedSession;
      // await selectedChat.save({ session: transactionSession });

      // =============================> New Chat Notification
      const newChatNotificationData = {
        type: 'messages',
        user: teamUsers[0]._id,
        chat: selectedChat._id,
        event: 'newChat',
      };

      const newChatNotification = await Notification.create(
        [newChatNotificationData],
        { session: transactionSession }
      );
      console.log(
        'newChatNotification ====================',
        newChatNotification
      );
    }
    console.log('selectedSession ========================', selectedSession);

    // ---------------------> Create the message
    newMessageData.chat = selectedChat._id;
    newMessageData.session = selectedSession._id;
    newMessageData.fromEndUser = req.endUser._id;
    newMessageData.status = 'received';
    newMessageData.received = convertDate(Date.now());

    const recievedMessage = await Message.create([newMessageData], {
      session: transactionSession,
    });
    newMessage = recievedMessage[0];
    console.log('newMessage ========================', newMessage);

    selectedChat.lastMessage = newMessage;
    selectedChat.lastSession = selectedSession;
    selectedChat.team = selectedSession.team;
    selectedChat.currentUser = selectedSession.user;
    selectedChat.status = 'open';
    await selectedChat.save({ session: transactionSession });

    // ================> updating session performance
    selectedSession.performance.all += 1;
    selectedSession.performance.onTime += 1;
    await selectedSession.save();

    const chatHistoryData = {
      chat: selectedChat._id,
      user: selectedSession.user,
      actionType: 'botReceive',
    };

    const chatHistory = await ChatHistory.create([chatHistoryData], {
      session: transactionSession,
    });
    console.log('chatHistory ========================', chatHistory);

    const previousNotification = await Notification.findOne({
      user: selectedSession.user,
      chat: selectedChat._id,
      event: 'newMessages',
      session: selectedSession._id,
    }).session(transactionSession);

    if (previousNotification) {
      const updatedNotification = await Notification.findByIdAndUpdate(
        previousNotification._id,
        { $inc: { numbers: 1 }, read: false, sortingDate: Date.now() },
        { new: true, runValidators: true, session: transactionSession }
      );

      console.log('updatedNotification -------------', updatedNotification);
    } else {
      const newMessagesNotificationData = {
        type: 'messages',
        user: selectedSession.user,
        chat: selectedChat._id,
        session: selectedSession._id,
        event: 'newMessages',
      };

      const newMessagesNotification = await Notification.create(
        [newMessagesNotificationData],
        { session: transactionSession }
      );

      console.log(
        'newMessagesNotification ============================= >',
        newMessagesNotification
      );
    }

    await transactionSession.commitTransaction(); // Commit the transaction
  } catch (error) {
    await transactionSession.abortTransaction();

    console.log(
      'Transaction aborted due to an error: ===========================',
      error
    );

    return next(new AppError('Sending message aborted! Try again later.', 400));
  } finally {
    transactionSession.endSession();
  }

  if (newMessage) {
    // ***************** Adjusting session & message timer ******************
    const team = await Team.findById(selectedSession.team);
    const teamServiceHours = await Service.findById(team.serviceHours);
    let timer = new Date();

    if (
      !serviceHoursUtils.checkInsideServiceHours(teamServiceHours.durations)
    ) {
      timer = serviceHoursUtils.getTheNextServiceHours(
        teamServiceHours.durations
      );
    }

    let delay = {
      hours: teamServiceHours.responseTime.hours,
      minutes: teamServiceHours.responseTime.minutes,
    };

    timer.setMinutes(timer.getMinutes() + delay.minutes * 1);
    timer.setHours(timer.getHours() + delay.hours * 1);

    // ***************** Updating session status ******************
    if (!['onTime', 'danger', 'tooLate'].includes(selectedSession.status)) {
      selectedSession.timer = timer;
      selectedSession.status = 'onTime';
      await selectedSession.save();

      const sessions = await Session.find({
        timer: {
          $exists: true,
          $ne: '',
        },
      });
      await sessionTimerUpdate.scheduleDocumentUpdateTask(
        sessions,
        req,
        responseDangerTime, //from config.env
        teamServiceHours.responseTime
      );
    }

    // ***************** Updating session Performance ******************
    console.log('newMessage', newMessage);
    newMessage.timer = timer;
    await newMessage.save();
    console.log('newMessage', newMessage);

    await sessionTimerUpdate.schedulePerformance(
      req,
      newMessage,
      responseDangerTime, //from config.env
      teamServiceHours.responseTime
    );

    res.status(201).json({
      status: 'success',
      data: {
        message: newMessage,
      },
    });
  } else {
    return next(new AppError('Sending message failed! Try again later.', 400));
  }
});
