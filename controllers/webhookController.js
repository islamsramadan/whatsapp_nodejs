const fs = require('fs');
const axios = require('axios');

const Message = require('./../models/messageModel');
const Chat = require('./../models/chatModel');
const User = require('./../models/userModel');
const Conversation = require('./../models/conversationModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const Team = require('../models/teamModel');
const Session = require('../models/sessionModel');
const Service = require('../models/serviceModel');
const messageController = require('./messageController');
const interactiveMessages = require('../utils/interactiveMessages');

const sessionTimerUpdate = require('../utils/sessionTimerUpdate');
const checkInsideServiceHours = require('../utils/checkInsideServiceHours');
const Contact = require('../models/contactModel');

const responseDangerTime = process.env.RESPONSE_DANGER_TIME;

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
  // console.log('selectedMessage', selectedMessage);

  const phoneNumberID =
    req.body.entry[0].changes[0].value.metadata.phone_number_id;
  const from = req.body.entry[0].changes[0].value.messages[0].from;
  const msgType = req.body.entry[0].changes[0].value.messages[0].type;
  const msgID = req.body.entry[0].changes[0].value.messages[0].id;
  const contactName =
    req.body.entry[0].changes[0].value.contacts[0].profile.name;

  const chat = await Chat.findOne({ client: from });
  // console.log('chat', chat);

  let newChat;
  if (!chat) {
    const botTeam = await Team.findOne({ bot: true });

    newChat = await Chat.create({
      client: from,
      team: botTeam._id,
      currentUser: botTeam.supervisor,
    });
  }

  const selectedChat = chat || newChat;
  const session = await Session.findById(selectedChat.lastSession);

  let newSession;
  if (!session) {
    const botTeam = await Team.findOne({ bot: true });

    newSession = await Session.create({
      chat: selectedChat._id,
      user: botTeam.supervisor,
      team: botTeam._id,
      status: 'onTime',
    });

    selectedChat.lastSession = newSession._id;
    selectedChat.team = botTeam._id;
    selectedChat.currentUser = botTeam.supervisor;
    await selectedChat.save();

    // Adding the selected chat to the user chats
    // if (!teamUsers[0].chats.includes(selectedChat._id)) {
    //   await User.findByIdAndUpdate(
    //     teamUsers[0]._id,
    //     { $push: { chats: selectedChat._id } },
    //     { new: true, runValidators: true }
    //   );
    // }
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

    // other messages types
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

    if (msgType === 'contacts') {
      const contacts = selectedMessage.contacts.map((contact) => ({
        name: contact.name.formatted_name,
        phones: contact.phones,
        emails: contact.emails,
      }));
      newMessageData.contacts = contacts;
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

    if (msgType === 'interactive') {
      const interactive =
        req.body.entry[0].changes[0].value.messages[0].interactive;
      newMessageData.interactive = interactive;
    }

    const newMessage = await Message.create(newMessageData);

    // **************** Fetching name from RD app ***************************
    let contact;
    if (!selectedChat.contactName) {
      let contactResponse;
      try {
        contactResponse = await axios.request({
          method: 'get',
          maxBodyLength: Infinity,
          url: `https://inspection.cpvarabia.com/api/GetProjectByPhone.php?PhoneNumber=${selectedChat.client}`,
          headers: {
            'Content-Type': 'application/json',
          },
        });
      } catch (err) {
        console.log('err', err);
      }

      // console.log('contactResponse', contactResponse.data.name);

      let contactData = {
        number: selectedChat.client,
        whatsappName: contactName,
        name: contactName,
      };
      if (
        contactResponse &&
        contactResponse.data &&
        contactResponse.data.name
      ) {
        contactData.externalName = contactResponse.data.name;
        contactData.name = contactResponse.data.name;
      }
      contact = await Contact.create(contactData);
    }

    // Adding the received message as last message in the chat
    selectedChat.lastMessage = newMessage._id;
    // update chat session, notification and status
    selectedChat.notification = true;
    selectedChat.session = Date.now();
    selectedChat.status = 'open';
    if (contact) {
      selectedChat.contactName = contact;
    }
    await selectedChat.save();

    // ***************** Updating session status ******************
    if (!['onTime', 'danger', 'tooLate'].includes(selectedSession.status)) {
      const team = await Team.findById(selectedSession.team);
      const serviceHours = await Service.findById(team.serviceHours);

      let delay = {
        hours: serviceHours.responseTime.hours,
        minutes: serviceHours.responseTime.minutes,
      };

      let timer = new Date();
      timer.setMinutes(timer.getMinutes() + delay.minutes * 1);
      timer.setHours(timer.getHours() + delay.hours * 1);

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
        //from config.env
        responseDangerTime
      );
    }

    //updating event in socket io
    req.app.io.emit('updating');

    // ************************* Chat Bot messages *****************************
    // if there is no session and new session created
    if (!session) {
      const interactive = interactiveMessages[0]; // from test data

      const newMessageObj = {
        user: selectedChat.currentUser,
        chat: selectedChat._id,
        from: process.env.WHATSAPP_PHONE_NUMBER,
        type: 'interactive',
        interactive,
      };

      const whatsappPayload = {
        messaging_product: 'whatsapp',
        to: selectedChat.client,
        type: 'interactive',
        recipient_type: 'individual',
        interactive,
      };
      // const newMessageObj = {
      //   user: selectedChat.currentUser,
      //   chat: selectedChat._id,
      //   from: process.env.WHATSAPP_PHONE_NUMBER,
      //   type: 'text',
      //   text: autoReplyText,
      // };

      // const whatsappPayload = {
      //   messaging_product: 'whatsapp',
      //   to: selectedChat.client,
      //   type: 'text',
      //   recipient_type: 'individual',
      //   text: {
      //     preview_url: false,
      //     body: autoReplyText,
      //   },
      // };

      let response;
      try {
        response = await axios.request({
          method: 'post',
          maxBodyLength: Infinity,
          url: `https://graph.facebook.com/${process.env.WHATSAPP_VERSION}/${process.env.WHATSAPP_PHONE_ID}/messages`,
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

      // Adding the sent message as last message in the chat and update chat status
      selectedChat.lastMessage = newMessage._id;
      selectedChat.status = 'open';
      await selectedChat.save();

      // Updating session to new status ((open))
      selectedSession.status = 'open';
      selectedSession.timer = undefined;
      await selectedSession.save();

      //updating event in socket io
      req.app.io.emit('updating');
    }

    if (msgType === 'interactive') {
      const interactive =
        req.body.entry[0].changes[0].value.messages[0].interactive;

      const replyMessage = await Message.findOne({
        whatsappID: selectedMessage.context.id,
      });

      if (interactive.type === 'button_reply') {
        const replyButtons = replyMessage.interactive.action.buttons;
        // console.log('replyButtons', replyButtons);
        const button = replyButtons.filter(
          (btn) => btn.reply.id === interactive.button_reply.id
        )[0];
        // console.log('button', button);

        const testReply = `سيتم تحويلك الي قسم ${button.reply.title}`;
        const newMessageObj = {
          user: selectedChat.currentUser,
          chat: selectedChat._id,
          from: process.env.WHATSAPP_PHONE_NUMBER,
          type: 'text',
          text: testReply,
        };

        const whatsappPayload = {
          messaging_product: 'whatsapp',
          to: selectedChat.client,
          type: 'text',
          recipient_type: 'individual',
          text: {
            preview_url: false,
            body: testReply,
          },
        };

        let response;
        try {
          response = await axios.request({
            method: 'post',
            maxBodyLength: Infinity,
            url: `https://graph.facebook.com/${process.env.WHATSAPP_VERSION}/${process.env.WHATSAPP_PHONE_ID}/messages`,
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
            },
            data: JSON.stringify(whatsappPayload),
          });
        } catch (err) {
          console.log('err', err);
        }

        const newMessage = await Message.create({
          ...newMessageObj,
          whatsappID: response.data.messages[0].id,
        });

        // Adding the sent message as last message in the chat and update chat status
        selectedChat.lastMessage = newMessage._id;
        selectedChat.status = 'open';
        await selectedChat.save();

        // Updating session to new status ((open))
        selectedSession.status = 'open';
        selectedSession.timer = undefined;
        await selectedSession.save();

        //updating event in socket io
        req.app.io.emit('updating');
      } else if (interactive.type === 'list_reply') {
        const listOptions = [];
        replyMessage.interactive.action.sections.map((section) => {
          section.rows.map((row) => {
            listOptions.push({
              id: row.id,
              title: row.title,
              description: row.description,
            });
          });
        });
        // console.log('listOptions', listOptions);

        const selectedOption = listOptions.filter(
          (option) => option.id === interactive.list_reply.id
        )[0];
        // console.log('selectedOption', selectedOption);

        const testReply = `لقد قمت باختيار ${selectedOption.title}`;
        const newMessageObj = {
          user: selectedChat.currentUser,
          chat: selectedChat._id,
          from: process.env.WHATSAPP_PHONE_NUMBER,
          type: 'text',
          text: testReply,
        };

        const whatsappPayload = {
          messaging_product: 'whatsapp',
          to: selectedChat.client,
          type: 'text',
          recipient_type: 'individual',
          text: {
            preview_url: false,
            body: testReply,
          },
        };

        // console.log('whatsappPayload==============', whatsappPayload);

        let response;
        try {
          response = await axios.request({
            method: 'post',
            maxBodyLength: Infinity,
            url: `https://graph.facebook.com/${process.env.WHATSAPP_VERSION}/${process.env.WHATSAPP_PHONE_ID}/messages`,
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
            },
            data: JSON.stringify(whatsappPayload),
          });
        } catch (err) {
          console.log('err', err);
        }

        const newMessage = await Message.create({
          ...newMessageObj,
          whatsappID: response.data.messages[0].id,
        });

        // Adding the sent message as last message in the chat and update chat status
        selectedChat.lastMessage = newMessage._id;
        selectedChat.status = 'open';
        await selectedChat.save();

        // Updating session to new status ((open))
        selectedSession.status = 'open';
        selectedSession.timer = undefined;
        await selectedSession.save();

        //updating event in socket io
        req.app.io.emit('updating');
      }
    }

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

const checkListHandler = () => {};
