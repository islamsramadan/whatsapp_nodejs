const axios = require('axios');
const multer = require('multer');

const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

const Message = require('../models/messageModel');
const Chat = require('../models/chatModel');
const Team = require('../models/teamModel');
const Session = require('../models/sessionModel');
const User = require('../models/userModel');
const ChatHistory = require('../models/historyModel');

const whatsappVersion = process.env.WHATSAPP_VERSION;
const whatsappToken = process.env.WHATSAPP_TOKEN;
const whatsappPhoneID = process.env.WHATSAPP_PHONE_ID;
const whatsappPhoneNumber = process.env.WHATSAPP_PHONE_NUMBER;
const whatsappAccountID = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
const productionLink = process.env.PRODUCTION_LINK;

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
      `user-${req.user.id}-${Date.now()}-${Math.floor(
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

exports.uploadMessageImage = upload.single('file');
exports.uploadMultiFiles = upload.array('files');
// exports.uploadMessageImage = upload.array('file', 2);

exports.getAllChatMessages = catchAsync(async (req, res, next) => {
  // const userTeam = await Team.findById(req.user.team);
  // if (!userTeam) {
  //   return next(
  //     new AppError("This user doesn't belong to any existed team!", 400)
  //   );
  // }

  // if (!req.params.chatNumber) {
  //   return next(new AppError('Kindly provide chat number!', 400));
  // }

  // const chat = await Chat.findOne({ client: req.params.chatNumber })
  //   .populate('contactName', 'name')
  //   .populate('lastSession', 'status secret');
  // // console.log('chat', chat);

  // if (!chat) {
  //   return next(new AppError('No chat found with that number!', 400));
  // }

  const chat = await Chat.findById(req.params.chatID)
    .populate('contactName', 'name')
    .populate('lastSession', 'status secret')
    .populate('endUser', 'name phone');

  if (!chat) {
    return next(new AppError('No chat found with that ID!', 404));
  }

  // Checking if the user in the same team of the chat
  if (
    chat.team &&
    !chat.team.equals(req.user.team) &&
    req.user.role === 'user'
  ) {
    return next(
      new AppError("You don't have permission to view this chat!", 403)
    );
  }

  const page = req.query.page * 1 || 1;

  const messageFilteredBody = { chat: chat._id };

  if (!req.user.secret) {
    messageFilteredBody.$or = [
      { secret: false },
      { secret: { $exists: false } },
    ];
  }

  let messages = await Message.find(messageFilteredBody)
    .sort('-createdAt')
    .populate({
      path: 'user',
      select: { firstName: 1, lastName: 1, photo: 1 },
    })
    .populate('fromEndUser', 'name phone')
    .populate({
      path: 'reply',
      populate: {
        path: 'user',
        select: { firstName: 1, lastName: 1, photo: 1 },
      },
    })
    .populate({
      path: 'userReaction.user',
      select: 'firstName lastName photo',
    })
    .populate({
      path: 'session',
      select: 'team',
      populate: { path: 'team', select: 'name' },
    })
    .limit(page * 20)
    .lean();

  // Revome secret reply
  messages = messages.map((message) => {
    if (
      !message.reply ||
      (message.reply && message.reply.secret !== true) ||
      (message.reply &&
        message.reply.secret === true &&
        req.user.secret === true)
    ) {
      return message;
    } else {
      return { ...message, reply: undefined };
    }
  });

  const totalResults = await Message.count(messageFilteredBody);
  const totalPages = Math.ceil(totalResults / 20);

  const histories = await ChatHistory.find({ chat: chat._id })
    .populate('user', 'firstName lastName')
    .populate('transfer.from', 'firstName lastName')
    .populate('transfer.to', 'firstName lastName')
    .populate('transfer.fromTeam', 'name')
    .populate('transfer.toTeam', 'name')
    .populate('takeOwnership.from', 'firstName lastName')
    .populate('takeOwnership.to', 'firstName lastName')
    .populate('start', 'firstName lastName')
    .populate('archive', 'firstName lastName');

  let historyMessages = [...messages, ...histories].sort(
    (a, b) => a.createdAt - b.createdAt
  );

  let historyMessagesCopy = [...historyMessages];

  for (let i = 0; i < historyMessagesCopy.length; i++) {
    if (
      historyMessagesCopy[i].actionType &&
      historyMessagesCopy[i + 1]?.actionType
    ) {
      // Remove history item from array
      historyMessages = historyMessages.filter(
        (item) => item._id !== historyMessagesCopy[i]._id
      );
    } else {
      break;
    }
  }

  res.status(200).json({
    status: 'success',
    results: messages.length,
    data: {
      totalPages,
      totalResults,
      session: chat.session,
      contactName: chat.contactName,
      endUser: chat.endUser,
      currentUser: { _id: chat.currentUser, teamID: chat.team },
      chatStatus: chat.status,
      // messages: messages.reverse(),
      messages: historyMessages.reverse(),
      notification: chat.notification,
      lastSession: chat.lastSession,
    },
  });
});

exports.sendMessage = catchAsync(async (req, res, next) => {
  // console.log('req.body', req.body);
  // console.log('req.files', req.files);

  const chatType = req.body.chatType || 'whatsapp';

  if (!req.body.type) {
    return next(new AppError('Message type is required!', 400));
  }

  // if (!req.params.chatNumber) {
  //   return next(new AppError('Chat number is required!', 400));
  // }

  // selecting chat that the message belongs to
  // const chat = await Chat.findOne({ client: req.params.chatNumber });

  const chat = await Chat.findById(req.params.chatID);

  if (!chat) {
    return next(new AppError('No chat found by that ID!', 404));
  }

  // let newChat;
  // if (!chat) {
  //   const userTeam = await Team.findById(req.user.team);
  //   if (!userTeam) {
  //     return next(
  //       new AppError(
  //         'the user sending the messages must belong to an existing team!',
  //         400
  //       )
  //     );
  //   }
  //   newChat = await Chat.create({
  //     client: req.params.chatNumber,
  //     currentUser: req.user._id,
  //     users: [req.user._id],
  //     team: req.user.team,
  //   });
  // }

  const selectedChat = chat;
  // const selectedChat = chat || newChat;

  const session = await Session.findById(selectedChat.lastSession);

  let newSession;
  if (!session) {
    if (chatType === 'endUser') {
      return next(new AppError(`You couldn't start end user chat`, 400));
    }

    newSession = await Session.create({
      chat: selectedChat._id,
      user: req.user._id,
      team: req.user.team,
      status: 'open',
    });

    selectedChat.lastSession = newSession._id;
    selectedChat.currentUser = req.user._id;
    selectedChat.team = req.user.team;
    await selectedChat.save();

    // =======> Create chat history session
    const chatHistoryData = {
      chat: selectedChat._id,
      user: req.user._id,
      actionType: 'start',
      start: req.user._id,
    };
    await ChatHistory.create(chatHistoryData);
  }
  const selectedSession = session || newSession;

  // checking if the user is the chat current user
  if (!selectedChat.currentUser.equals(req.user._id)) {
    return next(
      new AppError("You don't have permission to perform this action!", 403)
    );
  }

  // updating chat notification to false
  selectedChat.notification = false;
  await selectedChat.save();

  // updating user chats
  if (!req.user.chats.includes(selectedChat._id)) {
    await User.findByIdAndUpdate(
      req.user._id,
      { $push: { chats: selectedChat._id } },
      { new: true, runValidators: true }
    );
  }

  // Handling whatsapp session (24hours from the last message the client send)
  if (!selectedChat.session && selectedChat.type !== 'endUser') {
    // if (!selectedChat.session) {
    return next(
      new AppError(
        'You can only send template message until the end user reply!',
        400
      )
    );
  }

  const availableSession = Math.ceil(
    (new Date() - selectedChat.session) / (1000 * 60)
  );

  if (availableSession >= 24 * 60 && selectedChat.type !== 'endUser') {
    return next(
      new AppError(
        'Your session is expired, You can only send template message until the end user reply!',
        400
      )
    );
  }
  // console.log('availableSession', availableSession);

  if (
    !['text', 'image', 'video', 'document'].includes(req.body.type) &&
    chatType === 'endUser'
  ) {
    return next(new AppError('Message type not supported!', 400));
  }

  const newMessageObj = {
    chatType,
    user: req.user._id,
    chat: selectedChat._id,
    session: selectedSession._id,
    from: process.env.WHATSAPP_PHONE_NUMBER,
    type: req.body.type,
  };

  if (selectedSession.secret === true) {
    newMessageObj.secret = true;
  }

  const whatsappPayload = {
    messaging_product: 'whatsapp',
    to: selectedChat.client,
    type: req.body.type,
  };

  // Message Reply
  if (req.body.replyMessage) {
    const replyMessage = await Message.findById(req.body.replyMessage);
    if (!replyMessage) {
      return next(new AppError('There is no message to reply!.', 404));
    }

    whatsappPayload.context = {
      message_id: replyMessage.whatsappID,
    };

    newMessageObj.reply = req.body.replyMessage;
  }

  // Template Message
  if (req.body.type === 'template') {
    return next(
      new AppError('this end point not for sending template message!', 400)
    );
  }

  // Text Message
  if (req.body.type === 'text') {
    whatsappPayload.recipient_type = 'individual';
    whatsappPayload.text = {
      preview_url: false,
      body: req.body.text,
    };

    newMessageObj.text = req.body.text;
  }

  // Contacts Message
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
        emails: contact.emails?.map((item) => ({ email: item, type: 'WORK' })),
        org: contact.org,
      };
    });

    // console.log('contacts===========', contacts, contacts[0].phones);
    whatsappPayload.contacts = contacts;
    newMessageObj.contacts = contacts.map((contact) => ({
      ...contact,
      name: contact.name.formatted_name,
    }));
  }

  // Video Message
  if (req.body.type === 'video') {
    whatsappPayload.recipient_type = 'individual';
    whatsappPayload.video = {
      link: `${productionLink}/${req.files[0].filename}`,
      caption: req.body.caption,
    };

    newMessageObj.video = {
      file: req.files[0].filename,
      caption: req.body.caption,
    };
  }

  // Audio Message
  if (req.body.type === 'audio') {
    whatsappPayload.recipient_type = 'individual';
    whatsappPayload.audio = {
      link: `${productionLink}/${req.files[0].filename}`,
    };

    newMessageObj.audio = {
      file: req.files[0].filename,
      voice: false,
    };
  }

  if (chatType === 'endUser') {
    newMessageObj.status = 'delivered';
    newMessageObj.sent = convertDate(Date.now());
    newMessageObj.delivered = convertDate(Date.now());
  }

  let newMessage;
  if (req.body.type === 'image' || req.body.type === 'document') {
    const newMessages = await sendMultiMediaHandler(
      req,
      whatsappPayload,
      newMessageObj
    );
    newMessage = newMessages[newMessages.length - 1];
  } else {
    let response;
    if (chatType === 'whatsapp') {
      try {
        response = await axios.request({
          method: 'post',
          maxBodyLength: Infinity,
          url: `https://graph.facebook.com/${whatsappVersion}/${whatsappPhoneID}/messages`,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          },
          data: JSON.stringify(whatsappPayload),
        });
      } catch (err) {
        console.log('err', err);
      }
    }

    // console.log('response.data----------------', JSON.stringify(response.data));

    const newMessageData = { ...newMessageObj };
    if (chatType === 'whatsapp') {
      newMessageData.whatsappID = response.data.messages[0].id;
    }
    // newMessage = await Message.create({
    //   ...newMessageObj,
    //   whatsappID: response.data.messages[0].id,
    // });

    newMessage = await Message.create(newMessageData);
  }

  // Adding the sent message as last message in the chat and update chat status
  selectedChat.lastMessage = newMessage._id;
  selectedChat.status = 'open';
  await selectedChat.save();

  // Updating session to new status ((open))
  selectedSession.status = 'open';
  selectedSession.timer = undefined;
  selectedSession.lastUserMessage = newMessage._id;
  await selectedSession.save();

  //updating event in socket io
  req.app.io.emit('updating', { chatNumber: selectedChat.client });

  res.status(201).json({
    status: 'success',
    // wahtsappResponse: response.data,
    data: {
      message: newMessage,
    },
  });
});

const sendMultiMediaHandler = async (req, whatsappPayload, newMessageObj) => {
  // console.log('req.files', req.files);
  if (!req.files || req.files.length === 0) {
    return next(new AppError('No file found!', 404));
  }

  let preparedMessages = req.files.map((file) => ({
    file,
    whatsappPayload,
    newMessageObj,
  }));

  // Image Message
  if (req.body.type === 'image') {
    preparedMessages = preparedMessages.map((item, i) => ({
      ...item,
      whatsappPayload: {
        ...item.whatsappPayload,
        recipient_type: 'individual',
        image: {
          link: `${productionLink}/${item.file.filename}`,
          caption: req.body.caption,
        },
      },
      newMessageObj: {
        ...newMessageObj,
        image: {
          file: item.file.filename,
          caption: req.body.caption,
        },
      },
    }));
  }

  if (req.body.type === 'document') {
    preparedMessages = preparedMessages.map((item, i) => ({
      ...item,
      whatsappPayload: {
        ...item.whatsappPayload,
        recipient_type: 'individual',
        document: {
          link: `${productionLink}/${item.file.filename}`,
          filename: item.file.originalname,
          caption: req.body.caption,
        },
      },
      newMessageObj: {
        ...newMessageObj,
        document: {
          file: item.file.filename,
          filename: item.file.originalname,
          caption: req.body.caption,
        },
      },
    }));
  }

  const newMessages = await Promise.all(
    preparedMessages.map(async (item) => {
      let response;
      if (newMessageObj.chatType === 'whatsapp') {
        try {
          response = await axios.request({
            method: 'post',
            maxBodyLength: Infinity,
            url: `https://graph.facebook.com/${whatsappVersion}/${whatsappPhoneID}/messages`,
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
            },
            data: JSON.stringify(item.whatsappPayload),
          });
        } catch (err) {
          console.log('err', err);
        }
      }

      // console.log('response.data----------------', JSON.stringify(response.data));

      const newMessageData = { ...item.newMessageObj };
      if (newMessageObj.chatType === 'whatsapp') {
        newMessageData.whatsappID = response.data.messages[0].id;
      }
      // const newMessage = await Message.create({
      //   ...item.newMessageObj,
      //   whatsappID: response.data.messages[0].id,
      // });
      const newMessage = await Message.create(newMessageData);

      return newMessage;
    })
  );

  // console.log('preparedMessages ===========================', preparedMessages);
  // console.log('newMessages', newMessages);
  return newMessages;
};

exports.sendFailedMessage = catchAsync(async (req, res, next) => {
  const failedMessage = await Message.findById(req.params.messageID);
  if (!failedMessage) {
    return next(new AppError('No message found with that ID!', 400));
  }

  const chat = await Chat.findById(failedMessage.chat);

  // updating chat notification to false
  chat.notification = false;
  await chat.save();

  // Handling whatsapp session (24hours from the last message the client send)
  if (!chat.session) {
    return next(
      new AppError(
        'You can only send template message until the end user reply!',
        400
      )
    );
  }

  const availableSession = Math.ceil((new Date() - chat.session) / (1000 * 60));

  if (availableSession >= 24 * 60) {
    return next(
      new AppError(
        'Your session is expired, You can only send template message!',
        400
      )
    );
  }
  // console.log('availableSession', availableSession);

  const whatsappPayload = {
    messaging_product: 'whatsapp',
    to: failedMessage.to,
    type: failedMessage.type,
    recipient_type: 'individual',
  };

  if (failedMessage.reply) {
    const replyMessage = await Message.findById(failedMessage.reply);

    whatsappPayload.context = {
      message_id: replyMessage.whatsappID,
    };
  }

  // Template Message
  // if (failedMessage.type === 'template') {
  //   whatsappPayload.template = {
  //     name: 'hello_world',
  //     language: {
  //       code: 'en_US',
  //     },
  //   };
  // }

  // Text Message
  if (failedMessage.type === 'text') {
    whatsappPayload.text = {
      preview_url: false,
      body: failedMessage.text,
    };
  }

  // Image Message
  if (failedMessage.type === 'image') {
    whatsappPayload.image = {
      link: `${productionLink}/${failedMessage.image.file}`,
      caption: failedMessage.image.caption,
    };
  }

  // Video Message
  if (failedMessage.type === 'video') {
    whatsappPayload.video = {
      link: `${productionLink}/${failedMessage.video.file}`,
      caption: failedMessage.video.caption,
    };
  }

  // Audio Message
  if (failedMessage.type === 'audio') {
    whatsappPayload.audio = {
      link: `${productionLink}/${failedMessage.audio.file}`,
    };
  }

  // Document Message
  if (failedMessage.type === 'document') {
    whatsappPayload.document = {
      link: `${productionLink}/${failedMessage.document.file}`,
      filename: failedMessage.document.filename,
      caption: failedMessage.document.caption,
    };
  }

  // console.log('whatsappPayload', whatsappPayload);

  const response = await axios.request({
    method: 'post',
    maxBodyLength: Infinity,
    url: `https://graph.facebook.com/${whatsappVersion}/${whatsappPhoneID}/messages`,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
    },
    data: JSON.stringify(whatsappPayload),
  });

  // updating failed message status in database
  failedMessage.status = 'pending';
  failedMessage.whatsappID = response.data.messages[0].id;
  await failedMessage.save();

  //updating event in socket io
  req.app.io.emit('updating', { chatNumber: chat.client });

  res.status(200).json({
    status: 'success',
    // wahtsappResponse: response.data,
    data: {
      message: failedMessage,
    },
  });
});

exports.reactMessage = catchAsync(async (req, res, next) => {
  const reactedMessage = await Message.findById(req.params.messageID);

  if (!reactedMessage) {
    return next(new AppError('Message not found!', 404));
  }

  const chat = await Chat.findById(reactedMessage.chat);

  // checking if the user is the chat current user
  if (!chat.currentUser || !chat.currentUser.equals(req.user._id)) {
    return next(
      new AppError("You don't have permission to perform this action!", 403)
    );
  }

  // updating chat notification to false
  chat.notification = false;
  await chat.save();

  // Handling whatsapp session (24hours from the last message the client send)
  if (!chat.session) {
    return next(
      new AppError(
        'You can only send template message until the end user reply!',
        400
      )
    );
  }

  const availableSession = Math.ceil((new Date() - chat.session) / (1000 * 60));

  if (availableSession >= 24 * 60) {
    return next(
      new AppError(
        'Your session is expired, You can only send template message!',
        400
      )
    );
  }
  // console.log('availableSession', availableSession);

  const whatsappPayload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: chat.client,
    type: 'reaction',
    reaction: {
      message_id: reactedMessage.whatsappID,
      emoji: req.body.emoji,
    },
  };

  const response = await axios.request({
    method: 'post',
    url: `https://graph.facebook.com/${whatsappVersion}/${whatsappPhoneID}/messages`,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
    },
    data: JSON.stringify(whatsappPayload),
  });

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
  req.app.io.emit('updating', { chatNumber: chat.client });

  res.status(200).json({
    status: 'success',
    data: {
      message: updatedMessage,
    },
  });
});

//with uploaded file
exports.sendTemplateMessage = catchAsync(async (req, res, next) => {
  // console.log('req.body', req.body);
  // console.log('req.file', req.file);

  const { templateName } = req.body;
  if (!templateName) {
    return next(new AppError('Template name is required!', 400));
  }

  const response = await axios.request({
    method: 'get',
    url: `https://graph.facebook.com/${whatsappVersion}/${whatsappAccountID}/message_templates?name=${templateName}`,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${whatsappToken}`,
    },
  });
  const template = response.data.data[0];
  // console.log('template', template);

  if (!template) {
    return next(new AppError('There is no template with that name!', 404));
  }

  if (template.status !== 'APPROVED') {
    return next(
      new AppError('You can only send templates with status (APPROVED)!', 400)
    );
  }

  // selecting chat that the message belongs to
  const chat = await Chat.findOne({ client: req.params.chatNumber });

  let newChat;
  if (!chat) {
    const userTeam = await Team.findById(req.user.team);
    if (!userTeam) {
      return next(
        new AppError(
          'the user sending the messages must belong to an existing team!',
          400
        )
      );
    }
    newChat = await Chat.create({
      client: req.params.chatNumber,
      currentUser: req.user._id,
      users: [req.user._id],
      team: req.user.team,
    });
  }
  // console.log('chat', chat);

  const selectedChat = chat || newChat;

  const session = await Session.findById(selectedChat.lastSession);

  let newSession;
  if (!session) {
    newSession = await Session.create({
      chat: selectedChat._id,
      user: req.user._id,
      team: req.user.team,
      status: 'onTime',
    });

    selectedChat.lastSession = newSession._id;
    selectedChat.currentUser = req.user._id;
    selectedChat.team = req.user.team;
    await selectedChat.save();

    // =======> Create chat history session
    const chatHistoryData = {
      chat: selectedChat._id,
      user: req.user._id,
      actionType: 'start',
      start: req.user._id,
    };
    await ChatHistory.create(chatHistoryData);
  }
  const selectedSession = session || newSession;

  // checking if the user is the chat current user
  if (!selectedChat.currentUser.equals(req.user._id)) {
    return next(
      new AppError("You don't have permission to perform this action!", 403)
    );
  }

  // updating chat notification to false
  selectedChat.notification = false;
  await selectedChat.save();

  //********************************************************************************* */
  //********************************************************************************* */
  // Preparing template for whatsapp payload
  const whatsappPayload = {
    messaging_product: 'whatsapp',
    to: selectedChat.client,
    type: 'template',
    template: {
      name: templateName,
      language: {
        code: template.language,
      },
      components: [],
    },
  };

  // console.log('template.components =============', template);

  template.components.map((component) => {
    if (component.example) {
      let parameters;
      if (component.type === 'HEADER') {
        // format = DOCUMENT / IMAGE / VIDEO / LOCATION
        if (component.format !== 'TEXT') {
          parameters = [{ type: component.format.toLowerCase() }];
          parameters[0][component.format.toLowerCase()] = {
            link: `${productionLink}/${req.file.filename}`,
          };
          if (component.format === 'DOCUMENT') {
            parameters[0].document = {
              link: `${productionLink}/${req.file.filename}`,
              filename: req.file.originalname,
            };
          }
        } else {
          parameters = [];
          let parametersValues =
            component.example[`${component.type.toLowerCase()}_text`];
          parametersValues = Array.isArray(parametersValues[0])
            ? parametersValues[0]
            : parametersValues;

          parametersValues.map((el) => {
            parameters.push({ type: 'text', text: req.body[el][0] });
          });

          parameters = parametersValues.map((el) => ({
            type: 'text',
            text: req.body[el],
          }));
        }
      } else {
        parameters = [];
        let parametersValues =
          component.example[`${component.type.toLowerCase()}_text`];
        parametersValues = Array.isArray(parametersValues[0])
          ? parametersValues[0]
          : parametersValues;

        parametersValues.map((el) => {
          parameters.push({
            type: 'text',
            text: Array.isArray(req.body[el]) ? req.body[el][0] : req.body[el],
          });
        });

        parameters = parametersValues.map((el) => ({
          type: 'text',
          text: req.body[el],
        }));
      }

      whatsappPayload.template.components.push({
        type: component.type.toLowerCase(),
        parameters: parameters,
      });
    } else if (component.type === 'BUTTONS') {
      component.buttons.map((button, i) => {
        if (button.example) {
          const templateComponent = {};
          templateComponent.type = 'button';
          templateComponent.sub_type = 'url';
          templateComponent.index = i;
          templateComponent.parameters = [
            { type: 'text', text: req.body.buttonVariable },
          ];

          whatsappPayload.template.components.push(templateComponent);
        }
      });
    }
  });

  //********************************************************************************* */
  // Preparing template for data base
  const newMessageObj = {
    user: req.user.id,
    chat: selectedChat.id,
    session: selectedSession._id,
    from: process.env.WHATSAPP_PHONE_NUMBER,
    type: 'template',
    template: {
      name: templateName,
      language: template.language,
      category: template.category,
      components: [],
    },
  };

  if (selectedSession.secret === true) {
    newMessageObj.secret = true;
  }

  template.components.map((component) => {
    const templateComponent = { type: component.type };

    if (component.type === 'HEADER') {
      templateComponent.format = component.format;

      if (component.example) {
        const headerParameters = whatsappPayload.template.components.filter(
          (comp) => comp.type === 'header'
        )[0].parameters;
        // console.log('headerParameters', headerParameters);

        if (component.format === 'TEXT') {
          templateComponent.text = component.text;

          for (let i = 0; i < headerParameters.length; i++) {
            templateComponent.text = templateComponent.text.replace(
              `{{${i + 1}}}`,
              headerParameters[i].text
            );
          }
        } else {
          templateComponent[`${component.format.toLowerCase()}`] = {
            link: req.file.filename,
          };
          if (component.format === 'DOCUMENT') {
            templateComponent.document = {
              link: req.file.filename,
              filename: req.file.originalname,
            };
          }
        }
      } else {
        templateComponent[`${component.format.toLowerCase()}`] =
          component[`${component.format.toLowerCase()}`];
      }
    } else if (component.type === 'BODY') {
      templateComponent.text = component.text;
      if (component.example) {
        const bodyParameters = whatsappPayload.template.components.filter(
          (comp) => comp.type === 'body'
        )[0].parameters;
        // console.log('bodyParameters', bodyParameters);
        for (let i = 0; i < bodyParameters.length; i++) {
          templateComponent.text = templateComponent.text.replace(
            `{{${i + 1}}}`,
            bodyParameters[i].text
          );
        }
      }
    } else if (component.type === 'BUTTONS') {
      const buttons = component.buttons.map((button) => {
        if (button.example) {
          const url = button.url.replace('{{1}}', req.body.buttonVariable);
          return { ...button, url };
        } else {
          return button;
        }
      });

      templateComponent.buttons = buttons;
    } else {
      templateComponent.text = component.text;
    }

    newMessageObj.template.components.push(templateComponent);
  });

  // console.log('whatsappPayload', whatsappPayload);

  // Sending the template message to the client via whatsapp api
  let sendTemplateResponse;
  try {
    sendTemplateResponse = await axios.request({
      method: 'post',
      maxBodyLength: Infinity,
      url: `https://graph.facebook.com/${whatsappVersion}/${whatsappPhoneID}/messages`,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
      },
      data: JSON.stringify(whatsappPayload),
    });
  } catch (err) {
    console.log('err', err);
  }

  if (!sendTemplateResponse) {
    return next(
      new AppError(
        "Template couldn't be sent, Try again with all the variables required!",
        400
      )
    );
  }

  // Adding the template message to database
  const newMessage = await Message.create({
    ...newMessageObj,
    whatsappID: sendTemplateResponse.data.messages[0].id,
  });

  //********************************************************************************* */
  // Adding the sent message as last message in the chat and update chat status
  selectedChat.lastMessage = newMessage._id;
  selectedChat.status = 'open';
  await selectedChat.save();

  // Updating session to new status ((open))
  selectedSession.status = 'open';
  selectedSession.timer = undefined;
  selectedSession.lastUserMessage = newMessage._id;
  await selectedSession.save();

  //updating event in socket io
  req.app.io.emit('updating', { chatNumber: selectedChat.client });

  res.status(201).json({
    status: 'success',
    data: {
      template,
      whatsappPayload,
      wahtsappResponse: sendTemplateResponse?.data,
      message: newMessage,
    },
  });
});

exports.sendMultiTemplateMessage = catchAsync(async (req, res, next) => {
  const { templateName } = req.body;
  if (!templateName) {
    return next(new AppError('Template name is required!', 400));
  }

  const response = await axios.request({
    method: 'get',
    url: `https://graph.facebook.com/${whatsappVersion}/${whatsappAccountID}/message_templates?name=${templateName}`,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${whatsappToken}`,
    },
  });
  const template = response.data.data[0];
  // console.log('template', template);

  if (!template) {
    return next(new AppError('There is no template with that name!', 404));
  }

  if (template.status !== 'APPROVED') {
    return next(
      new AppError('You can only send templates with status (APPROVED)!', 400)
    );
  }

  // selecting chat that the message belongs to
  const chat = await Chat.findOne({ client: req.params.chatNumber });

  let newChat;
  if (!chat) {
    newChat = await Chat.create({
      client: req.params.chatNumber,
      status: 'archived',
      // currentUser: req.user._id,
      // users: [req.user._id],
      // team: req.user.team,
    });
  }
  // console.log('chat', chat);

  const selectedChat = chat || newChat;

  //********************************************************************************* */
  // Preparing template for whatsapp payload
  const whatsappPayload = {
    messaging_product: 'whatsapp',
    to: selectedChat.client,
    type: 'template',
    template: {
      name: templateName,
      language: {
        code: template.language,
      },
      components: [],
    },
  };

  template.components.map((component) => {
    if (component.example) {
      let parameters =
        component.format === 'DOCUMENT'
          ? 'link'
          : component.example[
              `${component.type.toLowerCase()}_${
                component.format ? component.format.toLowerCase() : 'text'
              }`
            ];
      parameters = Array.isArray(parameters[0]) ? parameters[0] : parameters;
      // console.log('parameters', parameters);

      whatsappPayload.template.components.push({
        type: component.type,
        parameters:
          component.format === 'DOCUMENT'
            ? [
                {
                  type: 'document',
                  document: {
                    link: req.body.link,
                    filename: req.body.filename,
                  },
                },
              ]
            : parameters.map((el) => {
                let object = {
                  type: component.format
                    ? component.format.toLowerCase()
                    : 'text',
                };
                if (component.format) {
                  object[component.format.toLowerCase()] = {
                    link: req.body.link,
                  };
                } else {
                  object.text = req.body[`${el}`];
                }
                // return {
                //   type: component.format ? component.format.toLowerCase() : 'text',
                //   text: req.body[`${el}`],
                // };
                return object;
              }),
      });
    }
  });

  //********************************************************************************* */
  // Preparing template for data base
  const newMessageObj = {
    user: req.user.id,
    chat: selectedChat._id,
    // session: selectedSession._id, // no session to provide
    from: process.env.WHATSAPP_PHONE_NUMBER,
    type: 'template',
    template: {
      name: templateName,
      language: template.language,
      category: template.category,
      components: [],
    },
  };

  template.components.map((component) => {
    const templateComponent = { type: component.type };

    if (component.type === 'HEADER') {
      templateComponent.format = component.format;

      if (component.example) {
        if (component.format === 'DOCUMENT') {
          templateComponent.document = { link: req.body.link };
          if (req.body.filename)
            templateComponent.document.filename = req.body.filename;
        } else {
          templateComponent[`${component.format.toLowerCase()}`] =
            component[`${component.format.toLowerCase()}`];

          const headerParameters = whatsappPayload.template.components.filter(
            (comp) => comp.type === 'HEADER'
          )[0].parameters;
          // console.log('headerParameters', headerParameters);
          for (let i = 0; i < headerParameters.length; i++) {
            templateComponent[`${component.format.toLowerCase()}`] =
              templateComponent[`${component.format.toLowerCase()}`].replace(
                `{{${i + 1}}}`,
                headerParameters[i][`${component.format.toLowerCase()}`]
              );
          }
        }
      }
    } else if (component.type === 'BODY') {
      templateComponent.text = component.text;
      if (component.example) {
        const bodyParameters = whatsappPayload.template.components.filter(
          (comp) => comp.type === 'BODY'
        )[0].parameters;
        // console.log('bodyParameters', bodyParameters);
        for (let i = 0; i < bodyParameters.length; i++) {
          templateComponent.text = templateComponent.text.replace(
            `{{${i + 1}}}`,
            bodyParameters[i].text
          );
        }
      }
    } else if (component.type === 'BUTTONS') {
      templateComponent.buttons = component.buttons;
    } else {
      templateComponent.text = component.text;
    }

    // console.log('templateComponent', templateComponent);
    newMessageObj.template.components.push(templateComponent);
  });

  // Sending the template message to the client via whatsapp api
  let sendTemplateResponse;
  try {
    sendTemplateResponse = await axios.request({
      method: 'post',
      maxBodyLength: Infinity,
      url: `https://graph.facebook.com/${whatsappVersion}/${whatsappPhoneID}/messages`,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
      },
      data: JSON.stringify(whatsappPayload),
    });
  } catch (err) {
    console.log('err', err);
  }

  // console.log('sendTemplateResponse', sendTemplateResponse);

  if (!sendTemplateResponse) {
    return next(
      new AppError(
        "Template couldn't be sent, Try again with all the variables required!",
        400
      )
    );
  }

  // console.log('newMessageObj ==========================', newMessageObj);
  // Adding the template message to database
  const newMessage = await Message.create({
    ...newMessageObj,
    whatsappID: sendTemplateResponse.data.messages[0].id,
  });
  // console.log('newMessage ===================', newMessage);

  selectedChat.lastMessage = newMessage._id;
  await selectedChat.save();

  //********************************************************************************* */
  //updating event in socket io
  req.app.io.emit('updating');

  res.status(201).json({
    status: 'success',
    data: {
      // template,
      // whatsappPayload,
      // wahtsappResponse: sendTemplateResponse?.data,
      message: newMessage,
    },
  });
});

exports.sendMessageCopy = catchAsync(async (req, res, next) => {
  // console.log('req.body', req.body);
  // console.log('req.files', req.files);

  if (!req.body.type) {
    return next(new AppError('Message type is required!', 400));
  }

  if (!req.params.chatNumber) {
    return next(new AppError('Chat number is required!', 400));
  }

  // selecting chat that the message belongs to
  const chat = await Chat.findOne({ client: req.params.chatNumber });

  let newChat;
  if (!chat) {
    const userTeam = await Team.findById(req.user.team);
    if (!userTeam) {
      return next(
        new AppError(
          'the user sending the messages must belong to an existing team!',
          400
        )
      );
    }
    newChat = await Chat.create({
      client: req.params.chatNumber,
      currentUser: req.user._id,
      users: [req.user._id],
      team: req.user.team,
    });
  }

  const selectedChat = chat || newChat;

  const session = await Session.findById(selectedChat.lastSession);

  let newSession;
  if (!session) {
    newSession = await Session.create({
      chat: selectedChat._id,
      user: req.user._id,
      team: req.user.team,
      status: 'onTime',
    });

    selectedChat.lastSession = newSession._id;
    selectedChat.currentUser = req.user._id;
    selectedChat.team = req.user.team;
    await selectedChat.save();

    // =======> Create chat history session
    const chatHistoryData = {
      chat: selectedChat._id,
      user: req.user._id,
      actionType: 'start',
      start: req.user._id,
    };
    await ChatHistory.create(chatHistoryData);
  }
  const selectedSession = session || newSession;

  // checking if the user is the chat current user
  if (!selectedChat.currentUser.equals(req.user._id)) {
    return next(
      new AppError("You don't have permission to perform this action!", 403)
    );
  }

  // updating chat notification to false
  selectedChat.notification = false;
  await selectedChat.save();

  // updating user chats
  if (!req.user.chats.includes(selectedChat._id)) {
    await User.findByIdAndUpdate(
      req.user._id,
      { $push: { chats: selectedChat._id } },
      { new: true, runValidators: true }
    );
  }

  // Handling whatsapp session (24hours from the last message the client send)
  if (!selectedChat.session) {
    return next(
      new AppError(
        'You can only send template message until the end user reply!',
        400
      )
    );
  }

  const availableSession = Math.ceil(
    (new Date() - selectedChat.session) / (1000 * 60)
  );

  if (availableSession >= 24 * 60) {
    return next(
      new AppError(
        'Your session is expired, You can only send template message until the end user reply!',
        400
      )
    );
  }
  // console.log('availableSession', availableSession);

  const newMessageObj = {
    user: req.user._id,
    chat: selectedChat._id,
    session: selectedSession._id,
    from: process.env.WHATSAPP_PHONE_NUMBER,
    type: req.body.type,
  };

  if (selectedSession.secret === true) {
    newMessageObj.secret = true;
  }

  const whatsappPayload = {
    messaging_product: 'whatsapp',
    to: selectedChat.client,
    type: req.body.type,
  };

  // Message Reply
  if (req.body.replyMessage) {
    const replyMessage = await Message.findById(req.body.replyMessage);
    if (!replyMessage) {
      return next(new AppError('There is no message to reply!.', 404));
    }

    whatsappPayload.context = {
      message_id: replyMessage.whatsappID,
    };

    newMessageObj.reply = req.body.replyMessage;
  }

  // Template Message
  if (req.body.type === 'template') {
    return next(
      new AppError('this end point not for sending template message!', 400)
    );
  }

  // Text Message
  if (req.body.type === 'text') {
    whatsappPayload.recipient_type = 'individual';
    whatsappPayload.text = {
      preview_url: false,
      body: req.body.text,
    };

    newMessageObj.text = req.body.text;
  }

  // Contacts Message
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
        emails: contact.emails?.map((item) => ({ email: item, type: 'WORK' })),
        org: contact.org,
      };
    });

    // console.log('contacts===========', contacts, contacts[0].phones);
    whatsappPayload.contacts = contacts;
    newMessageObj.contacts = contacts.map((contact) => ({
      ...contact,
      name: contact.name.formatted_name,
    }));
  }

  // Video Message
  if (req.body.type === 'video') {
    whatsappPayload.recipient_type = 'individual';
    whatsappPayload.video = {
      link: `${productionLink}/${req.files[0].filename}`,
      caption: req.body.caption,
    };

    newMessageObj.video = {
      file: req.files[0].filename,
      caption: req.body.caption,
    };
  }

  // Audio Message
  if (req.body.type === 'audio') {
    whatsappPayload.recipient_type = 'individual';
    whatsappPayload.audio = {
      link: `${productionLink}/${req.files[0].filename}`,
    };

    newMessageObj.audio = {
      file: req.files[0].filename,
      voice: false,
    };
  }

  let newMessage;
  if (req.body.type === 'image' || req.body.type === 'document') {
    const newMessages = await sendMultiMediaHandler(
      req,
      whatsappPayload,
      newMessageObj
    );
    newMessage = newMessages[newMessages.length - 1];
  } else {
    let response;
    try {
      response = await axios.request({
        method: 'post',
        maxBodyLength: Infinity,
        url: `https://graph.facebook.com/${whatsappVersion}/${whatsappPhoneID}/messages`,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        },
        data: JSON.stringify(whatsappPayload),
      });
    } catch (err) {
      console.log('err', err);
    }

    // console.log('response.data----------------', JSON.stringify(response.data));
    newMessage = await Message.create({
      ...newMessageObj,
      whatsappID: response.data.messages[0].id,
    });
  }

  // Adding the sent message as last message in the chat and update chat status
  selectedChat.lastMessage = newMessage._id;
  selectedChat.status = 'open';
  await selectedChat.save();

  // Updating session to new status ((open))
  selectedSession.status = 'open';
  selectedSession.timer = undefined;
  selectedSession.lastUserMessage = newMessage._id;
  await selectedSession.save();

  //updating event in socket io
  req.app.io.emit('updating', { chatNumber: selectedChat.client });

  res.status(201).json({
    status: 'success',
    // wahtsappResponse: response.data,
    data: {
      message: newMessage,
    },
  });
});
