const axios = require('axios');
const multer = require('multer');

const Message = require('../models/messageModel');
const Chat = require('../models/chatModel');
const catchAsync = require('../utils/catchAsync');

const whatsappVersion = process.env.WHATSAPP_VERSION;
const whatsappToken = process.env.WHATSAPP_TOKEN;
const whatsappPhoneID = process.env.WHATSAPP_PHONE_ID;

const multerStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(
      null,
      file.mimetype.split('/')[0] === 'image' ? 'public/img' : 'public/docs'
    );
  },
  filename: (req, file, cb) => {
    const ext =
      file.mimetype.split('/')[0] === 'image'
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

exports.uploadMessageImage = upload.single('image');

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

  // const formData = new FormData();
  // formData.append('messaging_product', 'whatsapp');
  // formData.append('file', JSON.stringify(req.file));
  // const formData = {
  //   messaging_product: 'whatsapp',
  //   file: req.file,
  // };
  // console.log('formData', formData);
  // const imageRes = await axios.post(
  //   `https://graph.facebook.com/${whatsappVersion}/${whatsappPhoneID}/messages`,
  //   formData,
  //   {
  //     headers: {
  //       Authorization: `Bearer ${whatsappToken}`,
  //       'Content-Type': 'application/json',
  //     },
  //   }
  // );
  // console.log('imageRes', imageRes);

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
      link: `https://774e-41-235-159-16.ngrok-free.app/img/${req.file.filename}`,
    };

    newMessageObj.image = req.file.filename;
  }

  // Document Message
  if (req.body.type === 'document') {
    whatsappPayload.recipient_type = 'individual';
    whatsappPayload.document = {
      link: `https://774e-41-235-159-16.ngrok-free.app/docs/${req.file.filename}`,
    };

    newMessageObj.document = req.file.filename;
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
