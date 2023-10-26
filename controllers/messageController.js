const axios = require('axios');
const multer = require('multer');

const Message = require('../models/messageModel');
const Chat = require('../models/chatModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const Team = require('../models/teamModel');

const whatsappVersion = process.env.WHATSAPP_VERSION;
const whatsappToken = process.env.WHATSAPP_TOKEN;
const whatsappPhoneID = process.env.WHATSAPP_PHONE_ID;
const whatsappPhoneNumber = process.env.WHATSAPP_PHONE_NUMBER;
const whatsappAccountID = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
const ngrokLink = process.env.NGROK_LINK;

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
    console.log('file==============', file);
    cb(
      null,
      file.mimetype.split('/')[0] === 'image'
        ? 'public/img'
        : file.mimetype.split('/')[0] === 'video'
        ? 'public/videos'
        : file.mimetype.split('/')[0] === 'audio'
        ? 'public/audios'
        : 'public/docs'
    );
  },
  filename: (req, file, cb) => {
    const ext =
      file.mimetype.split('/')[0] === 'image' ||
      file.mimetype.split('/')[0] === 'video' ||
      file.mimetype.split('/')[0] === 'audio'
        ? file.mimetype.split('/')[1]
        : file.originalname.split('.')[file.originalname.split('.').length - 1];

    cb(null, `user-${req.user.id}-${Date.now()}.${ext}`);
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

exports.getAllChatMessages = catchAsync(async (req, res, next) => {
  if (!req.params.chatNumber) {
    return next(new AppError('Kindly provide chat number!', 400));
  }

  let chat = await Chat.findOne({ client: req.params.chatNumber });
  if (!chat) {
    chat = await Chat.create({
      client: req.params.chatNumber,
      users: [req.user._id],
      currentUser: req.user._id,
    });
  }

  // console.log('chat', chat);

  const messages = await Message.find({ chat: chat._id })
    .sort('createdAt')
    .populate({
      path: 'user',
      select: { firstName: 1, lastName: 1, photo: 1 },
    })
    .populate('reply');

  res.status(200).json({
    status: 'success',
    results: messages.length,
    data: {
      session: chat.session,
      messages,
    },
  });
});

exports.sendMessage = catchAsync(async (req, res, next) => {
  // console.log('req.body', req.body);
  // console.log('req.file', req.file);

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

  // updating chat notification to false
  selectedChat.notification = false;
  await selectedChat.save();

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
    from: process.env.WHATSAPP_PHONE_NUMBER,
    type: req.body.type,
  };

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

  // Image Message
  if (req.body.type === 'image') {
    if (!req.file) {
      return next(new AppError('No image found!', 404));
    }
    whatsappPayload.recipient_type = 'individual';
    whatsappPayload.image = {
      link: `${ngrokLink}/img/${req.file.filename}`,
      caption: req.body.caption,
    };

    newMessageObj.image = {
      file: req.file.filename,
      caption: req.body.caption,
    };
  }

  // Video Message
  if (req.body.type === 'video') {
    whatsappPayload.recipient_type = 'individual';
    whatsappPayload.video = {
      link: `${ngrokLink}/videos/${req.file.filename}`,
      caption: req.body.caption,
    };

    newMessageObj.video = {
      file: req.file.filename,
      caption: req.body.caption,
    };
  }

  // Audio Message
  if (req.body.type === 'audio') {
    whatsappPayload.recipient_type = 'individual';
    whatsappPayload.audio = {
      link: `${ngrokLink}/audios/${req.file.filename}`,
    };

    newMessageObj.audio = {
      file: req.file.filename,
      voice: false,
    };
  }

  // Document Message
  if (req.body.type === 'document') {
    whatsappPayload.recipient_type = 'individual';
    whatsappPayload.document = {
      link: `${ngrokLink}/docs/${req.file.filename}`,
      filename: req.file.originalname,
      caption: req.body.caption,
    };

    newMessageObj.document = {
      file: req.file.filename,
      filename: req.file.originalname,
      caption: req.body.caption,
    };
  }
  // console.log('whatsappPayload', whatsappPayload);

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
  const newMessage = await Message.create({
    ...newMessageObj,
    whatsappID: response.data.messages[0].id,
  });

  // Adding the sent message as last message in the chat
  selectedChat.lastMessage = newMessage._id;
  await selectedChat.save();

  //updating event in socket io
  req.app.io.emit('updating');

  res.status(201).json({
    status: 'success',
    // wahtsappResponse: response.data,
    data: {
      message: newMessage,
    },
  });
});

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
      link: `${ngrokLink}/img/${failedMessage.image.file}`,
      caption: failedMessage.image.caption,
    };
  }

  // Video Message
  if (failedMessage.type === 'video') {
    whatsappPayload.video = {
      link: `${ngrokLink}/videos/${failedMessage.video.file}`,
      caption: failedMessage.video.caption,
    };
  }

  // Audio Message
  if (failedMessage.type === 'audio') {
    whatsappPayload.audio = {
      link: `${ngrokLink}/audios/${failedMessage.audio.file}`,
    };
  }

  // Document Message
  if (failedMessage.type === 'document') {
    whatsappPayload.document = {
      link: `${ngrokLink}/docs/${failedMessage.document.file}`,
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
  req.app.io.emit('updating');

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

  console.log('response ======>', response.data);
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

exports.sendTemplateMessage = catchAsync(async (req, res, next) => {
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
  console.log('template', template);

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

  // updating chat notification to false
  selectedChat.notification = false;
  await selectedChat.save();

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
      let paramaters =
        component.example[
          `${component.type.toLowerCase()}_${
            component.format ? component.format.toLowerCase() : 'text'
          }`
        ];
      paramaters = Array.isArray(paramaters[0]) ? paramaters[0] : paramaters;
      // console.log('paramaters', paramaters);

      whatsappPayload.template.components.push({
        type: component.type,
        parameters: paramaters.map((el) => ({
          type: component.format ? component.format.toLowerCase() : 'text',
          text: req.body[`${el}`],
        })),
      });
    }
  });

  //********************************************************************************* */
  // Preparing template for data base
  const newMessageObj = {
    user: req.user.id,
    chat: selectedChat.id,
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
      templateComponent[`${component.format.toLowerCase()}`] =
        component[`${component.format.toLowerCase()}`];
      if (component.example) {
        const headerParameters = whatsappPayload.template.components.filter(
          (comp) => comp.type === 'HEADER'
        )[0].parameters;
        console.log('headerParameters', headerParameters);
        for (let i = 0; i < headerParameters.length; i++) {
          templateComponent[`${component.format.toLowerCase()}`] =
            templateComponent[`${component.format.toLowerCase()}`].replace(
              `{{${i + 1}}}`,
              headerParameters[i][`${component.format.toLowerCase()}`]
            );
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
  // Adding the sent message as last message in the chat
  selectedChat.lastMessage = newMessage._id;
  await selectedChat.save();

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
