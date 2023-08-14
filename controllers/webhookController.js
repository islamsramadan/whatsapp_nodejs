const fs = require('fs');
const axios = require('axios');

const Message = require('./../models/messageModel');
const Chat = require('./../models/chatModel');
const catchAsync = require('../utils/catchAsync');

//to verify the callback url from the dashboard side - cloud api side
exports.verifyWebhook = (req, res) => {
  const mode = req.query['hub.mode'];
  const challenge = req.query['hub.challenge'];
  const token = req.query['hub.verify_token'];

  if (mode && token) {
    if (mode === 'subscribe' && token === process.env.WEBHOOK_TOKEN) {
      res.status(200).send(challenge);
    } else {
      res.status(403);
    }
  }
};

exports.listenToWebhook = catchAsync(async (req, res) => {
  // console.log(JSON.stringify(req.body, null, 2));

  if (req.body.object) {
    console.log('inside body param');

    if (
      req.body.entry &&
      req.body.entry[0].changes &&
      req.body.entry[0].changes[0].value.messages &&
      req.body.entry[0].changes[0].value.messages[0]
    ) {
      const phoneNumberID =
        req.body.entry[0].changes[0].value.metadata.phone_number_id;
      const from = req.body.entry[0].changes[0].value.messages[0].from;
      const msgType = req.body.entry[0].changes[0].value.messages[0].type;
      const msgID = req.body.entry[0].changes[0].value.messages[0].id;

      // console.log('phoneNumberID', phoneNumberID);
      // console.log('from', from);
      // console.log('msgType', msgType);
      // console.log('msgID', msgID);

      const chat = await Chat.findOne({ client: from });
      console.log('chat', chat);
      // if (!chat) {
      //   const newChat = await Chat.create({
      //     client: req.body.client,
      //     activeUser: req.user.id,
      //     users: [req.user.id],
      //   });
      // }

      const newMessageData = {
        user: chat.activeUser,
        chat: chat.id,
        to: process.env.WHATSAPP_PHONE_NUMBER,
        from: chat.client,
        type: msgType,
        whatsappID: msgID,
      };

      if (msgType === 'text') {
        const msgBody =
          req.body.entry[0].changes[0].value.messages[0].text.body;
        newMessageData.text = msgBody;
      }

      if (msgType === 'image' || msgType === 'document') {
        mediaHandler(req, newMessageData);
      }

      // if (msgType === 'document') {
      //   mediaHandler(req, newMessageData);
      // }

      const newMessage = await Message.create(newMessageData);

      // axios({
      //   method: 'post',
      //   url: `https://graph.facebook.com/v17.0/${phoneNumberID}/messages`,
      //   headers: {
      //     'Content-Type': 'application/json',
      //     Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
      //   },
      //   data: JSON.stringify({
      //     messaging_product: 'whatsapp',
      //     recipient_type: 'individual',
      //     to: from,
      //     type: 'text',
      //     text: {
      //       preview_url: false,
      //       body: "hello it's me and this is your message: " + msgBody,
      //     },
      //   }),
      // })
      //   .then((response) => {
      //     console.log('Response ==============', JSON.stringify(response.data));
      //   })
      //   .catch((error) => {
      //     console.log(error);
      //   });

      res.status(200).json({ newMessage });
    } else {
      res.sendStatus(404);
    }
  }
});

const mediaHandler = (req, newMessageData) => {
  const selectedMessage = req.body.entry[0].changes[0].value.messages[0];

  const msgType = selectedMessage.type;
  const from = selectedMessage.from;

  const msgMediaID =
    msgType === 'image'
      ? selectedMessage.image.id
      : selectedMessage.document.id;

  const msgMediaExt =
    msgType === 'image'
      ? selectedMessage.image.mime_type?.split('/')[1]
      : selectedMessage.document.filename?.split('.')[1];

  const mediaFileName =
    msgType === 'image' ? '' : selectedMessage.document.filename;

  const mediaCaption =
    msgType === 'image'
      ? selectedMessage.image.caption
      : selectedMessage.document.caption;

  const fileName = `client-${from}-${Date.now()}.${msgMediaExt}`;

  if (msgType === 'image') {
    // newMessageData.image = fileName;
    newMessageData.image = {
      file: fileName,
      caption: mediaCaption,
    };
  } else {
    newMessageData.document = {
      file: fileName,
      filename: mediaFileName,
      caption: mediaCaption,
    };
  }

  axios
    .request({
      method: 'get',
      url: `https://graph.facebook.com/v17.0/${msgMediaID}`,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
      },
    })
    .then((response) => {
      axios
        .request({
          method: 'get',
          url: response.data.url,
          responseType: 'arraybuffer',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          },
        })
        .then((imageResponse) => {
          fs.writeFile(
            `${__dirname}/../public/${
              msgType === 'image' ? 'img' : 'docs'
            }/${fileName}`,
            imageResponse.data,
            (err) => {
              if (err) throw err;
              console.log(
                `${
                  msgType === 'image' ? 'Image' : 'Document'
                } downloaded successfully!`
              );
            }
          );
        });
    })
    .catch((error) => {
      console.log(error);
    });
};
