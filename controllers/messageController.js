const axios = require('axios');
const multer = require('multer');

const Message = require('../models/messageModel');
const Chat = require('../models/chatModel');
const catchAsync = require('../utils/catchAsync');

const whatsappVersion = process.env.WHATSAPP_VERSION;
const whatsappToken = process.env.WHATSAPP_TOKEN;
const whatsappPhoneID = process.env.WHATSAPP_PHONE_ID;
const ngrokLink = process.env.NGROK_LINK;

const multerStorage = multer.diskStorage({
  destination: (req, file, cb) => {
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
        : file.originalname.split('.')[1];
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
  const messages = await Message.find();

  res.status(200).json({
    status: 'success',
    results: messages.length,
    data: {
      messages,
    },
  });
});

exports.sendMessage = catchAsync(async (req, res, next) => {
  console.log('req.body', req.body);
  console.log('req.file', req.file);

  // selecting chat that the message belongs to
  const chat = await Chat.findById(req.params.chatID);
  let newChat;
  if (!chat) {
    newChat = await Chat.create({
      client: req.body.client,
      activeUser: req.user.id,
      users: [req.user.id],
    });
  }
  // console.log('chat', chat);

  const selectedChat = chat || newChat;

  const newMessageObj = {
    user: req.user.id,
    chat: selectedChat.id,
    from: process.env.WHATSAPP_PHONE_NUMBER,
    to: selectedChat.client,
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
    whatsappPayload.template = {
      name: 'hello_world',
      language: {
        code: 'en_US',
      },
    };

    newMessageObj.text = 'hello_world';
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

  // console.log('response.data----------------', JSON.stringify(response.data));
  const newMessage = await Message.create({
    ...newMessageObj,
    whatsappID: response.data.messages[0].id,
  });

  res.status(201).json({
    status: 'success',
    wahtsappResponse: response.data,
    // message: 'Message sent successfully!',
    data: {
      message: newMessage,
    },
  });
});
