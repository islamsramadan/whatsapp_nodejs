const fs = require('fs');
const axios = require('axios');

const Message = require('./../models/messageModel');
const Chat = require('./../models/chatModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const Team = require('../models/teamModel');
const Session = require('../models/sessionModel');
const sessionTimerUpdate = require('../utils/sessionTimerUpdate');

const convertDate = (timestamp) => {
  const date = new Date(timestamp * 1000);

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

exports.listenToWebhook = catchAsync(async (req, res, next) => {
  // console.log(JSON.stringify(req.body, null, 2));

  if (req.body.object) {
    // console.log('inside body param');

    if (
      req.body.entry &&
      req.body.entry[0].changes &&
      req.body.entry[0].changes[0].value.messages &&
      req.body.entry[0].changes[0].value.messages[0]
    ) {
      await receiveMessageHandler(req, res, next);
    } else if (
      req.body.entry &&
      req.body.entry[0].changes &&
      req.body.entry[0].changes[0].value.statuses &&
      req.body.entry[0].changes[0].value.statuses[0]
    ) {
      await updateMessageStatusHandler(req, res, next);
    } else {
      res.sendStatus(404);
    }
  }
});

const mediaHandler = async (req, newMessageData) => {
  const selectedMessage = req.body.entry[0].changes[0].value.messages[0];

  const msgType = selectedMessage.type;
  const from = selectedMessage.from;

  const msgMediaID =
    msgType === 'image'
      ? selectedMessage.image.id
      : msgType === 'video'
      ? selectedMessage.video.id
      : msgType === 'audio'
      ? selectedMessage.audio.id
      : msgType === 'sticker'
      ? selectedMessage.sticker.id
      : selectedMessage.document.id;

  const msgMediaExt =
    msgType === 'image'
      ? selectedMessage.image.mime_type?.split('/')[1]
      : msgType === 'video'
      ? selectedMessage.video.mime_type?.split('/')[1]
      : msgType === 'audio'
      ? selectedMessage.audio.mime_type?.split(';')[0].split('/')[1]
      : msgType === 'sticker'
      ? selectedMessage.sticker.mime_type?.split('/')[1]
      : selectedMessage.document.filename?.split('.')[
          selectedMessage.document.filename?.split('.').length - 1
        ];

  const mediaFileName =
    msgType === 'document' ? selectedMessage.document.filename : '';

  const mediaCaption =
    msgType === 'image'
      ? selectedMessage.image.caption
      : msgType === 'video'
      ? selectedMessage.video.caption
      : msgType === 'audio'
      ? selectedMessage.audio.caption
      : msgType === 'sticker'
      ? selectedMessage.sticker.caption
      : selectedMessage.document.caption;

  const fileName = `client-${from}-${Date.now()}.${msgMediaExt}`;

  if (msgType === 'image') {
    newMessageData.image = {
      file: fileName,
      caption: mediaCaption,
    };
  } else if (msgType === 'video') {
    newMessageData.video = {
      file: fileName,
      caption: mediaCaption,
    };
  } else if (msgType === 'audio') {
    newMessageData.audio = {
      file: fileName,
      voice: selectedMessage.audio.voice,
    };
  } else if (msgType === 'sticker') {
    newMessageData.sticker = {
      file: fileName,
      animated: selectedMessage.sticker.animated,
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
              msgType === 'image'
                ? 'img'
                : msgType === 'video'
                ? 'videos'
                : msgType === 'audio'
                ? 'audios'
                : msgType === 'sticker'
                ? 'stickers'
                : 'docs'
            }/${fileName}`,
            imageResponse.data,
            (err) => {
              if (err) throw err;
              console.log(`${msgType} downloaded successfully!`);
            }
          );
        });
    })
    .catch((error) => {
      console.log(error);
    });
};

const receiveMessageHandler = async (req, res, next) => {
  const selectedMessage = req.body.entry[0].changes[0].value.messages[0];

  const phoneNumberID =
    req.body.entry[0].changes[0].value.metadata.phone_number_id;
  const from = req.body.entry[0].changes[0].value.messages[0].from;
  const msgType = req.body.entry[0].changes[0].value.messages[0].type;
  const msgID = req.body.entry[0].changes[0].value.messages[0].id;

  const chat = await Chat.findOne({ client: from });
  // console.log('chat', chat);

  let newChat;
  if (!chat) {
    const defaultTeam = await Team.findOne({ default: true });

    //Selecting chat current user
    const teamUsers = [];
    defaultTeam.users.map(async function (user) {
      let teamUser = await User.findById(user);
      teamUsers = teamUsers.push(teamUser);
    });
    teamUsers = teamUsers.sort((a, b) => a.chats.length - b.chats.length);

    newChat = await Chat.create({
      client: from,
      team: defaultTeam._id,
      currentUser: teamUsers[0]._id,
    });
  }

  const selectedChat = chat || newChat;
  const session = await Session.findById(selectedChat.lastSession);

  let newSession;
  if (!session) {
    newSession = await Session.create({
      chat: selectedChat._id,
      user: selectedChat.currentUser,
      team: selectedChat.team,
      status: 'onTime',
    });

    selectedChat.lastSession = newSession._id;
    await selectedChat.save();
  }
  const selectedSession = session || newSession;

  if (msgType === 'reaction') {
    const reactionEmoji =
      req.body.entry[0].changes[0].value.messages[0].reaction?.emoji;
    const reactionTime =
      req.body.entry[0].changes[0].value.messages[0].timestamp;

    const reactedMessage = await Message.findOne({
      whatsappID: selectedMessage.reaction.message_id,
    });

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

    res.status(200).json({ reactedMessage });
  } else {
    const newMessageData = {
      chat: selectedChat._id,
      from: selectedChat.client,
      type: msgType,
      whatsappID: msgID,
      status: 'received',
      received: convertDate(selectedMessage.timestamp),
    };

    // Message Reply
    if (selectedMessage.context && selectedMessage.context.id) {
      const replyMessage = await Message.findOne({
        whatsappID: selectedMessage.context.id,
      });

      newMessageData.reply = replyMessage.id;
    }

    // Message Forward
    if (selectedMessage.context && selectedMessage.context.forwarded) {
      newMessageData.forwarded = selectedMessage.context.forwarded;
    }

    if (msgType === 'text') {
      const msgBody = req.body.entry[0].changes[0].value.messages[0].text.body;
      newMessageData.text = msgBody;
    }

    if (msgType === 'location') {
      const address = selectedMessage.location.address;
      const latitude = selectedMessage.location.latitude;
      const longitude = selectedMessage.location.longitude;
      const name = selectedMessage.location.name;

      newMessageData.location = {
        address,
        latitude,
        longitude,
        name,
      };
    }

    if (
      msgType === 'image' ||
      msgType === 'video' ||
      msgType === 'audio' ||
      msgType === 'sticker' ||
      msgType === 'document'
    ) {
      await mediaHandler(req, newMessageData);
    }

    const newMessage = await Message.create(newMessageData);

    // Adding the received message as last message in the chat
    selectedChat.lastMessage = newMessage._id;
    // update chat session, notification and status
    selectedChat.notification = true;
    selectedChat.session = Date.now();
    selectedChat.status = 'open';
    await selectedChat.save();

    if (!['onTime', 'danger', 'tooLate'].includes(selectedSession.status)) {
      let timer = new Date();
      timer.setMinutes(timer.getMinutes() + 3);
      selectedSession.timer = timer;
      selectedSession.status = 'onTime';
      await selectedSession.save();

      const sessions = await Session.find({
        timer: {
          $exists: true,
          $ne: '',
        },
      });
      await sessionTimerUpdate.scheduleDocumentUpdateTask(sessions, req);
    }

    //updating event in socket io
    req.app.io.emit('updating');

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
  }
};

const updateMessageStatusHandler = async (req, res, next) => {
  const msgStatus = req.body.entry[0].changes[0].value.statuses[0];
  const msgWhatsappID = req.body.entry[0].changes[0].value.statuses[0].id;
  const msgToUpdate = await Message.findOne({
    whatsappID: msgWhatsappID,
  });

  if (!msgToUpdate) {
    return next(new AppError('Message Not found!', 404));
  }

  msgToUpdate.status = msgStatus.status;
  msgToUpdate[msgStatus.status] = convertDate(msgStatus.timestamp);

  await msgToUpdate.save();

  //updating event in socket io
  req.app.io.emit('updating');

  res.status(200).json({ msgToUpdate });
};
