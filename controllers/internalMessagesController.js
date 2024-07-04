const axios = require('axios');
const multer = require('multer');
const xlsx = require('xlsx');
const https = require('https');
const fs = require('fs');
const path = require('path');

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

exports.getAllChatInternalMessages = catchAsync(async (req, res, next) => {
  const userTeam = await Team.findById(req.user.team);
  if (!userTeam) {
    return next(
      new AppError("This user doesn't belong to any existed team!", 400)
    );
  }

  if (!req.params.chatID) {
    return next(new AppError('Kindly provide chat ID!', 400));
  }

  const chat = await Chat.findById(req.params.chatID).populate(
    'contactName',
    'name'
  );
  // console.log('chat', chat);

  if (!chat) {
    return next(new AppError('No chat found with that ID!', 400));
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

  const messages = await Message.find({ chat: chat._id })
    .sort('-createdAt')
    .populate({
      path: 'user',
      select: { firstName: 1, lastName: 1, photo: 1 },
    })
    .populate('reply')
    .populate({
      path: 'userReaction.user',
      select: 'firstName lastName photo',
    })
    .limit(page * 20);

  const totalResults = await Message.count({ chat: chat._id });
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
      //   session: chat.session,
      //   contactName: chat.contactName,
      chatType: chat.type,
      currentUser: { _id: chat.currentUser, teamID: chat.team },
      chatStatus: chat.status,
      // messages: messages.reverse(),
      messages: historyMessages,
      notification: chat.notification,
    },
  });
});

exports.sendInternalMessage = catchAsync(async (req, res, next) => {
  // console.log('req.body', req.body);
  // console.log('req.files', req.files);

  if (!req.body.type) {
    return next(new AppError('Message type is required!', 400));
  }

  if (!req.params.chatID) {
    return next(new AppError('Chat ID is required!', 400));
  }

  // Internal chat will be created by the client not the user
  // selecting chat that the message belongs to
  const selectedChat = await Chat.findById(req.params.chatID);

  if (!selectedChat) {
    return next(new AppError('No chat found with that ID', 404));
  }

  const session = await Session.findById(selectedChat.lastSession);

  let newSession;
  if (!session) {
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

  const newMessageObj = {
    user: req.user._id,
    chat: selectedChat._id,
    session: selectedSession._id,
    from: process.env.WHATSAPP_PHONE_NUMBER,
    type: req.body.type,
    chatType: 'internal',
    status: 'delivered',
    delivered: convertDate(Date.now()),
  };

  // Message Reply
  if (req.body.replyMessage) {
    const replyMessage = await Message.findById(req.body.replyMessage);
    if (!replyMessage) {
      return next(new AppError('There is no message to reply!.', 404));
    }

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
    newMessageObj.contacts = contacts.map((contact) => ({
      ...contact,
      name: contact.name.formatted_name,
    }));
  }

  // Video Message
  if (req.body.type === 'video') {
    newMessageObj.video = {
      file: req.files[0].filename,
      caption: req.body.caption,
    };
  }

  // Audio Message
  if (req.body.type === 'audio') {
    newMessageObj.audio = {
      file: req.files[0].filename,
      voice: false,
    };
  }

  let newMessage;
  if (req.body.type === 'image' || req.body.type === 'document') {
    const newMessages = await sendMultiMediaHandler(req, newMessageObj);
    newMessage = newMessages[newMessages.length - 1];
  } else {
    newMessage = await Message.create(newMessageObj);
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
  req.app.io.emit('updating');

  res.status(201).json({
    status: 'success',
    data: {
      message: newMessage,
    },
  });
});

const sendMultiMediaHandler = async (req, newMessageObj) => {
  //   console.log('req.files', req.files);
  if (!req.files || req.files.length === 0) {
    return next(new AppError('No file found!', 404));
  }

  let preparedMessages = req.files.map((file) => ({
    file,
    newMessageObj,
  }));

  // Image Message
  if (req.body.type === 'image') {
    preparedMessages = preparedMessages.map((item, i) => ({
      ...item,
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
      const newMessage = await Message.create(item.newMessageObj);

      return newMessage;
    })
  );

  // console.log('preparedMessages ===========================', preparedMessages);
  // console.log('newMessages', newMessages);
  return newMessages;
};

exports.sendTemplateInternalMessage = catchAsync(async (req, res, next) => {
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

  // Internal chat will be created by the client not the user
  // selecting chat that the message belongs to
  const selectedChat = await Chat.findById(req.params.chatID);

  if (!selectedChat) {
    return next(new AppError('No chat found with that ID', 404));
  }

  const session = await Session.findById(selectedChat.lastSession);

  let newSession;
  if (!session) {
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

  //********************************************************************************* */
  //********************************************************************************* */
  // Keeping whatsapp payload for preparing new message obj only and not send via whatsapp
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
    chatType: 'internal',
    status: 'delivered',
    delivered: convertDate(Date.now()),
  };

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
      templateComponent.buttons = component.buttons;
    } else {
      templateComponent.text = component.text;
    }

    newMessageObj.template.components.push(templateComponent);
  });

  // console.log('whatsappPayload', whatsappPayload);

  // ***CANCELLED*** Sending the template message to the client via whatsapp api

  // Adding the template message to database
  const newMessage = await Message.create(newMessageObj);

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
  req.app.io.emit('updating');

  res.status(201).json({
    status: 'success',
    data: {
      message: newMessage,
    },
  });
});
