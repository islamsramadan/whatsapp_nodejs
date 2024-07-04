const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { Mutex } = require('async-mutex'); // This will prevent multiple concurrent requests from creating multiple chats & clients.
const chatCreationMutex = new Mutex();
const { promisify } = require('util');

const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

const sessionTimerUpdate = require('../utils/sessionTimerUpdate');
const chatBotTimerUpdate = require('../utils/chatBotTimerUpdate');
const serviceHoursUtils = require('../utils/serviceHoursUtils');

const Chat = require('../models/chatModel');
const EndUser = require('../models/endUserModel');
const Team = require('../models/teamModel');
const User = require('../models/userModel');
const Session = require('../models/sessionModel');
const ChatHistory = require('../models/historyModel');
const Service = require('../models/serviceModel');
const Message = require('../models/messageModel');

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

const createToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET);
};

exports.protectEndUserApp = catchAsync(async (req, res, next) => {
  // 1) Getting token and check if it is there
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(new AppError('You are not authenticated!', 401));
  }

  // 4) check if it is the same token in the config file
  if (process.env.END_USER_TOKEN !== token) {
    return next(new AppError('Invalid token!', 401));
  }

  next();
});

exports.protectEndUser = catchAsync(async (req, res, next) => {
  // 1) Getting token and check if it is there
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(new AppError('You are not authenticated!', 401));
  }

  // 2) Verification token
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
  // console.log('decoded', decoded);

  // 3) Check if user still exists
  const currentEndUser = await EndUser.findById(decoded.id).select('+token');
  if (!currentEndUser) {
    return next(
      new AppError(
        'The End user belonging to this token does no longer exist!',
        401
      )
    );
  }

  // 4) check if it is the same token in db as it is the last login
  if (currentEndUser.token && currentEndUser.token !== token) {
    return next(new AppError('Invalid token!', 401));
  }

  // Remove token from the user to send it in the req
  currentEndUser.token = undefined;

  // GRANT ACCESS TO PROTECTED ROUTE
  req.endUser = currentEndUser;
  next();
});

exports.getOrCreateEndUserToken = catchAsync(async (req, res, next) => {
  if (!req.body.clientID || !req.body.clientName) {
    return next(new AppError('End user data is required!', 400));
  }

  let endUser = await EndUser.findOne({ clientID: req.body.clientID });

  if (!endUser) {
    endUser = await EndUser.create({
      clientID: req.body.clientID,
      name: req.body.clientName,
    });
  }

  const token = createToken(endUser._id);

  await EndUser.findByIdAndUpdate(
    endUser._id,
    { token },
    { new: true, runValidators: true }
  );

  res.status(200).json({
    status: 'success',
    data: {
      token,
      user: endUser,
    },
  });
});

exports.getAllEndUserMessages = catchAsync(async (req, res, next) => {
  const chat = await Chat.find({ endUser: req.endUser._id });

  const page = req.query.page * 1 || 1;

  const messages = await Message.find({ chat: chat._id })
    .sort('-createdAt')
    .populate('reply')
    .limit(page * 20);

  const totalResults = await Message.count({ chat: chat._id });
  const totalPages = Math.ceil(totalResults / 20);

  res.status(200).json({
    status: 'success',
    results: messages.length,
    data: {
      page,
      totalPages,
      totalResults,
      messages: messages.reverse(),
    },
  });
});

exports.sendEndUserMessage = catchAsync(async (req, res, next) => {
  const msgType = req.body.type;
  if (!msgType) {
    return next(new AppError('Message type is required!', 400));
  }

  if (msgType === 'reaction') {
    const reactedMessage = await Message.findById(req.body.reactedMessage);
    if (!reactedMessage) {
      return next(new AppError('No message found!', 404));
    }

    const chat = await Chat.findById(reactedMessage.chat);
    if (!chat) {
      return next(
        new AppError('Chat belongs to reacted Message not found!', 400)
      );
    }

    if (!chat.endUser.equals(req.endUser._id)) {
      return next(
        new AppError("You don't have permission to perform this action!", 403)
      );
    }

    const reactionEmoji = req.body.emoji || '';
    const reactionTime = Date.now();

    if (reactionEmoji) {
      reactedMessage.clientReaction = {
        emoji: reactionEmoji,
        time: convertDate(reactionTime),
      };
    } else {
      reactedMessage.clientReaction = undefined;
    }

    await reactedMessage.save();

    //updating event in socket io
    req.app.io.emit('updating');

    const responseMessage = {
      id: reactedMessage._id,
      chatType: reactedMessage.chatType,
      user: reactedMessage.user,
      chat: reactedMessage.chat,
      session: reactedMessage.session,
      from: reactedMessage.from,
      fromEndUser: reactedMessage.fromEndUser,
      type: reactedMessage.type,
      template: reactedMessage.template,
      text: reactedMessage.text,
      image: reactedMessage.image,
      video: reactedMessage.video,
      audio: reactedMessage.audio,
      document: reactedMessage.document,
      location: reactedMessage.location,
      sticker: reactedMessage.sticker,
      contacts: reactedMessage.contacts,
      interactive: reactedMessage.interactive,
      button: reactedMessage.button,
      reply: reactedMessage.reply,
      clientReaction: reactedMessage.clientReaction,
      userReaction: reactedMessage.userReaction,
      status: reactedMessage.status,
      delivered: reactedMessage.delivered,
    };

    res
      .status(200)
      .json({ status: 'success', data: { message: responseMessage } });
  } else {
    if (
      !['text', 'document', 'image', 'video', 'audio', 'contacts'].includes(
        msgType
      )
    ) {
      return next(new AppError('Invalid message Type!', 400));
    }

    // *********** Preparing the message ******************************
    const newMessageData = {
      chatType: 'internal',
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
        return next(new AppError('Message text body is required!', 400));
      }

      newMessageData.text = req.body.text;
    }

    // ------------------> Document Message
    if (req.body.type === 'document') {
      if (!req.file) {
        return next(new AppError('Document is required!', 400));
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
        return next(new AppError('Image is required!', 400));
      }

      newMessageData.image = {
        file: req.file.filename,
        caption: req.body.caption,
      };
    }

    // ------------------> Video Message
    if (req.body.type === 'video') {
      if (!req.file) {
        return next(new AppError('Video is required!', 400));
      }

      newMessageData.video = {
        file: req.file.filename,
        caption: req.body.caption,
      };
    }

    // ------------------> Audio Message
    if (req.body.type === 'audio') {
      if (!req.file) {
        return next(new AppError('Audio is required!', 400));
      }

      newMessageData.audio = {
        file: req.file.filename,
        voice: false,
      };
    }

    // ------------------> Contacts Message
    if (req.body.type === 'contacts') {
      // To get the list of contacts
      // https://rd0.cpvarabia.com/api/Care/users.php?Token=OKRJ_R85rkn9nrgg
      if (!req.body.contacts || req.body.contacts.length === 0) {
        return next(new AppError('Contacts are required!', 400));
      }
      const contacts = req.body.contacts.map((contact) => {
        if (!contact.name) {
          return next(new AppError('contact name is required!', 400));
        }
        if (!contact.phones || contact.phones.length === 0) {
          return next(new AppError('contact phone is required!', 400));
        }

        return {
          name: { formatted_name: contact.name, first_name: contact.name },
          phones: contact.phones.map((item) => ({
            phone: item,
            wa_id: item,
            type: 'WORK',
          })),
          emails: contact.emails?.map((item) => ({
            email: item,
            type: 'WORK',
          })),
          org: contact.org,
        };
      });

      // console.log('contacts===========', contacts, contacts[0].phones);
      newMessageData.contacts = contacts.map((contact) => ({
        ...contact,
        name: contact.name.formatted_name,
      }));
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
              type: 'internal',
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

exports.reactEndUserMessage = catchAsync(async (req, res, next) => {
  const reactedMessage = await Message.findById(req.params.messageID);

  if (!reactedMessage) {
    return next(new AppError('Message not found!', 404));
  }

  const chat = await Chat.findById(reactedMessage.chat);

  // checking if the chat belong to the end user
  if (!chat.endUser || !chat.endUser.equals(req.endUser._id)) {
    return next(
      new AppError("You don't have permission to perform this action!", 403)
    );
  }

  // updating chat notification to true
  // chat.notification = true;
  // await chat.save();

  // console.log('response ======>', response.data);
  if (req.body.emoji) {
    reactedMessage.userReaction = {
      emoji: req.body.emoji,
      time: convertDate(Date.now()),
      user: req.user.id,
    };
  } else {
    reactedMessage.userReaction = undefined;
  }

  const updatedMessage = await reactedMessage.save();

  //updating event in socket io
  req.app.io.emit('updating');

  res.status(200).json({
    status: 'success',
    data: {
      message: updatedMessage,
    },
  });
});
