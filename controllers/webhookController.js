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
const chatBotTimerUpdate = require('../utils/chatBotTimerUpdate');
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
            `${__dirname}/../public/${fileName}`,
            imageResponse.data,
            (err) => {
              if (err) throw err;
              console.log(`${msgType} downloaded successfully!`);
            }
          );
          // fs.writeFile(
          //   `${__dirname}/../public/${
          //     msgType === 'image'
          //       ? 'img'
          //       : msgType === 'video'
          //       ? 'videos'
          //       : msgType === 'audio'
          //       ? 'audios'
          //       : msgType === 'sticker'
          //       ? 'stickers'
          //       : 'docs'
          //   }/${fileName}`,
          //   imageResponse.data,
          //   (err) => {
          //     if (err) throw err;
          //     console.log(`${msgType} downloaded successfully!`);
          //   }
          // );
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
      type: 'bot',
    });

    selectedChat.lastSession = newSession._id;
    selectedChat.team = botTeam._id;
    selectedChat.currentUser = botTeam.supervisor;
    await selectedChat.save();

    // =======> Adding the selected chat to the bot user chats
    const botUser = await User.findById(botTeam.supervisor);
    if (!botUser.chats.includes(selectedChat._id)) {
      await User.findByIdAndUpdate(
        botUser._id,
        { $push: { chats: selectedChat._id } },
        { new: true, runValidators: true }
      );
    }
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
      session: selectedSession._id,
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
      const contactResponse = await RDAppHandler({
        Action: '6', // action:6 to fetch client name
        Phone: selectedChat.client,
      });
      // // console.log('contactResponse', contactResponse.data.name);

      let contactData = {
        number: selectedChat.client,
        whatsappName: contactName,
        name: contactName,
      };

      if (contactResponse && contactResponse.name) {
        contactData.externalName = contactResponse.name;
        contactData.name = contactResponse.name;
      }
      contact = await Contact.create(contactData);
    }

    // ================> updating session performance
    selectedSession.performance.all += 1;
    selectedSession.performance.onTime += 1;
    await selectedSession.save();

    // ================> updating chat
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

    // ***************** Updating session Performance ******************
    const team = await Team.findById(selectedSession.team);
    const serviceHours = await Service.findById(team.serviceHours);

    let delay = {
      hours: serviceHours.responseTime.hours,
      minutes: serviceHours.responseTime.minutes,
    };

    let timer = new Date();
    timer.setMinutes(timer.getMinutes() + delay.minutes * 1);
    timer.setHours(timer.getHours() + delay.hours * 1);

    newMessage.timer = timer;
    await newMessage.save();

    await sessionTimerUpdate.schedulePerformance(
      req,
      newMessage,
      selectedSession
    );

    // *************************************************************************
    // ************************* Chat Bot Handlers *****************************
    if (selectedSession.type === 'bot') {
      // ============> remove bot timer when client reply
      selectedSession.botTimer = undefined;
      await selectedSession.save();

      await chatBotHandler(
        req,
        from,
        selectedMessage,
        selectedChat,
        selectedSession,
        session,
        msgType
      );
    }

    //updating event in socket io
    req.app.io.emit('updating');

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

const sendMessageHandler = async (
  req,
  msgToBeSent,
  selectedChat,
  selectedSession
) => {
  const newMessageObj = {
    user: selectedChat.currentUser,
    chat: selectedChat._id,
    session: selectedSession._id,
    from: process.env.WHATSAPP_PHONE_NUMBER,
    type: msgToBeSent.type,
  };

  const whatsappPayload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: selectedChat.client,
    type: msgToBeSent.type,
  };

  if (msgToBeSent.type === 'interactive') {
    newMessageObj.interactive = msgToBeSent.interactive;
    whatsappPayload.interactive = msgToBeSent.interactive;
  }
  if (msgToBeSent.type === 'text') {
    newMessageObj.text = msgToBeSent.text;
    whatsappPayload.text = { preview_url: false, body: msgToBeSent.text };
  }
  if (msgToBeSent.type === 'contacts') {
    whatsappPayload.contacts = msgToBeSent.contacts;
    newMessageObj.contacts = msgToBeSent.contacts.map((contact) => ({
      ...contact,
      name: contact.name.formatted_name,
    }));
  }
  if (msgToBeSent.type === 'document') {
    whatsappPayload.document = msgToBeSent.document;
    newMessageObj.document = { type: 'link', ...msgToBeSent.document };
  }

  // console.log('whatsappPayload =======', whatsappPayload);
  // console.log('newMessageObj =======', newMessageObj);

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

  // console.log('response.data----------------', response.data);
  const newMessage = await Message.create({
    ...newMessageObj,
    whatsappID: response.data.messages[0].id,
  });

  // Adding the sent message as last message in the chat and update chat status
  selectedChat.lastMessage = newMessage._id;
  selectedChat.status = 'open';
  // updating chat notification to false
  selectedChat.notification = false;
  await selectedChat.save();

  // Updating session to new status ((open))
  selectedSession.status = 'open';
  selectedSession.timer = undefined;
  if (selectedSession.type === 'bot')
    selectedSession.lastBotMessage = newMessage._id;
  await selectedSession.save();

  //updating event in socket io
  req.app.io.emit('updating');
};

const checkInteractiveHandler = async (
  option,
  selectedSession,
  selectedChat
) => {
  let replyMessage = {};

  const interactiveReply = interactiveMessages.filter((item) => {
    return item.id === option.id;
  });

  if (interactiveReply.length > 0) {
    const interactive = { ...interactiveReply[0] };

    // Reference required
    if (interactive.id === 'inspection') {
      replyMessage.type = 'text';
      replyMessage.text = 'الرجاء تزويدنا برقم المرجع';

      selectedSession.refRequired = true;
      selectedSession.referenceNo = undefined;
      await selectedSession.save();

      // Reference not required
    } else {
      delete interactive.id;

      replyMessage = {
        type: 'interactive',
        interactive,
      };
    }
  } else if (option.id === 'ref') {
    replyMessage = {
      type: 'text',
      text: 'الرجاء تزويدنا برقم المرجع',
    };

    selectedSession.refRequired = true;
    selectedSession.referenceNo = undefined;
    await selectedSession.save();
  } else if (option.id === 'inspector_phone') {
    const response = await RDAppHandler({
      Action: '4', // to fetch inspector contacts
      Phone: selectedChat.client,
      ReferenceNo: selectedSession.referenceNo,
    });
    const contactResponse = response?.Contact;

    if (contactResponse) {
      const contact = {
        name: {
          formatted_name: contactResponse.name,
          first_name: contactResponse.name,
        },
        phones: contactResponse.phones.map((item) => ({
          phone: item,
          wa_id: item,
          type: 'WORK',
        })),
        emails: contactResponse.emails?.map((item) => ({
          email: item,
          type: 'WORK',
        })),
        org: contactResponse.org,
      };

      // console.log('contact ==========', contact);

      replyMessage = {
        type: 'contacts',
        contacts: [contact],
      };
    } else {
      replyMessage = {
        type: 'text',
        text: 'عفوا لم يتم العثور علي رقم الفاحص الفني!',
      };
    }
  } else if (option.id === 'visits_reports') {
    replyMessage = {
      type: 'document',
      document: {
        link: 'https://test.cpvarabia.com/uploads/reports/RD7_Quotation/quotation.php?RD7T=1e86ab99db06a0ff5f05',
        filename: 'Visits reports',
      },
      caption: 'هذا هو تقرير الزيارات الخاص بمشروعكم',
    };
  } else if (option.id === 'project_tickets') {
    const response = await RDAppHandler({
      Action: '2', // to fetch project tickets page link
      Phone: selectedChat.client,
      ReferenceNo: selectedSession.referenceNo,
    });
    const ticketsLink = response?.Project_Tickets;

    if (ticketsLink) {
      replyMessage = {
        type: 'text',
        text: `رابط الملاحظات الخاصة بمشروعكم \n\n ${ticketsLink}`,
      };
    } else {
      replyMessage = {
        type: 'text',
        text: 'لم يتم العثور علي رابط الملاحظات الخاصة بمشروعكم',
      };
    }
  } else if (option.id === 'missing_data') {
    const response = await RDAppHandler({
      Action: '7', // to fetch project missing data page link
      Phone: selectedChat.client,
      ReferenceNo: selectedSession.referenceNo,
    });
    const missingDataLink = response?.Missing_Data;

    if (missingDataLink) {
      replyMessage = {
        type: 'text',
        text: `رابط البيانات المطلوبة الخاصة بمشروعكم \n\n ${missingDataLink}`,
      };
    } else {
      replyMessage = {
        type: 'text',
        text: 'لم يتم العثور علي رابط البيانات المطلوبة الخاصة بمشروعكم',
      };
    }
  } else if (option.id === 'payment_status') {
    const response = await RDAppHandler({
      Action: '3', // to fetch payment status
      Phone: selectedChat.client,
      ReferenceNo: selectedSession.referenceNo,
    });
    const paymentStatus = response?.Payment_Status;

    if (paymentStatus) {
      replyMessage.type = 'text';
      replyMessage.text =
        paymentStatus === 'Paid'
          ? 'عزيزي العميل لقد تم الدفع'
          : paymentStatus === 'NotPaid'
          ? 'عزيزي العميل لم يتم الدفع حتي الان'
          : 'لم يتم العثور علي حالة السداد الخاصة بهذا المشروع';
    } else {
      replyMessage = {
        type: 'text',
        text: 'لم يتم العثور علي حالة السداد الخاصة بهذا المشروع',
      };
    }
  } else if (option.id === 'contractor_instructions') {
    replyMessage = {
      type: 'document',
      document: {
        link: 'https://cpvarabia.com/Documents/ContractorGuidelinesAR.pdf',
        filename: 'Contractor instructions',
      },
      caption: 'هذا هو الملف الخاص بتعليمات المقاول',
    };
  } else if (option.id === 'inspection_stages') {
    replyMessage = {
      type: 'document',
      document: {
        link: 'https://cpvarabia.com/Documents/InspectionStagesAR.pdf',
        filename: 'Inspection stages',
      },
      caption: 'هذا هو الملف الخاص بمراحل الفحص الفني',
    };
  } else if (option.id === 'common_questions') {
    replyMessage = {
      type: 'document',
      document: {
        link: 'https://cpvarabia.com/Documents/FqaAR.pdf',
        filename: 'Common questions',
      },
      caption: 'هذا هو الملف الخاص بالاسئلة الشائعة',
    };
  } else if (option.id === 'complete_building') {
    replyMessage = {
      type: 'document',
      document: {
        link: 'https://cpvarabia.com/Documents/RD7AR.pdf',
        filename: 'Complete building',
      },
      caption: 'هذا هو الملف الخاص باجراءات المباني المكتملة',
    };
  } else if (option.id === 'work_hours') {
    replyMessage = {
      type: 'text',
      text: 'اوقات العمل : \n من الاحد الى الخميس من الساعة 09:00 صباحا الى الساعة 05:00 مساء. \n نسعد بخدمتكم',
    };
  } else if (option.id === 'customer_service') {
    replyMessage = {
      type: 'text',
      text: 'الرجاء الانتظار .. جاري تحويلكم لممثل خدمة العملاء',
    };
  } else if (option.id === 'inquiries') {
    replyMessage = {
      type: 'text',
      text: 'الرجاء الانتظار .. جاري تحويلكم للقسم المختص',
    };
  } else if (option.id === 'end') {
    replyMessage = {
      type: 'text',
      text: 'شكرا لتواصلكم مع شركة CPV العربية \n نأمل أن تحوزخدماتنا علي رضاكم',
    };
  }
  // else {
  //   replyMessage.type = 'text';
  //   replyMessage.text = `لقد قمت باختيار ${option.title}`;
  // }

  return replyMessage;
};

const chatBotHandler = async (
  req,
  from,
  selectedMessage,
  selectedChat,
  selectedSession,
  session,
  msgType
) => {
  // ******************* All cases if it is a bot session **************

  // ******************* Startng chat bot **************
  if (!session) {
    const interactiveObj = interactiveMessages.filter(
      (message) => message.id === 'CPV'
    )[0]; // from test data
    const interactive = { ...interactiveObj };
    delete interactive.id;

    const msgToBeSent = { type: 'interactive', interactive };

    await sendMessageHandler(req, msgToBeSent, selectedChat, selectedSession);
  } else if (selectedSession.refRequired) {
    // ************* Checking interactive reply message type **************
    if (msgType === 'text') {
      const textWaitingMsg = {
        type: 'text',
        text: 'برجاء الانتظار لحين التأكد من رقم المرجع لوثيقة التأمين بالنظام',
      };
      await sendMessageHandler(
        req,
        textWaitingMsg,
        selectedChat,
        selectedSession
      );

      const msgBody = req.body.entry[0].changes[0].value.messages[0].text.body;

      // *** API from RD app ***
      const refResult = await RDAppHandler({
        Action: '1',
        Phone: from,
        ReferenceNo: msgBody,
      });

      //===========> valid reference no
      if (refResult.Result) {
        selectedSession.referenceNo = msgBody;
        selectedSession.refRequired = false;
        await selectedSession.save();

        const interactiveMsgObj = interactiveMessages.filter(
          (item) => item.id === 'inspection'
        )[0];
        const interactiveMsg = { ...interactiveMsgObj };
        delete interactiveMsg.id;
        const interactiveReplyMsg = {
          type: 'interactive',
          interactive: interactiveMsg,
        };

        await sendMessageHandler(
          req,
          interactiveReplyMsg,
          selectedChat,
          selectedSession
        );

        //===========> invalid reference no
      } else {
        selectedSession.refRequired = false;
        await selectedSession.save();

        const interactiveMsgObj = interactiveMessages.filter(
          (item) => item.id === 'ref_error'
        )[0];
        const interactiveMsg = { ...interactiveMsgObj };
        delete interactiveMsg.id;
        const interactiveReplyMsg = {
          type: 'interactive',
          interactive: interactiveMsg,
        };

        await sendMessageHandler(
          req,
          interactiveReplyMsg,
          selectedChat,
          selectedSession
        );
      }
    } else {
      // ******** Checking for reference no. reply
      selectedSession.refRequired = false;
      selectedSession.referenceNo = undefined;
      await selectedSession.save();

      //===========> Sending error text message
      const textErrorMsg = {
        type: 'text',
        text: 'عفوا لم استطع التعرف علي الرقم المرجعي الخاص بكم.',
      };
      await sendMessageHandler(
        req,
        textErrorMsg,
        selectedChat,
        selectedSession
      );

      //===========> Sending error interactive message
      const interactiveMsgObj = interactiveMessages.filter(
        (item) => item.id === 'error'
      )[0];
      const interactiveMsg = { ...interactiveMsgObj };
      delete interactiveMsg.id;
      const interactiveReplyMsg = {
        type: 'interactive',
        interactive: interactiveMsg,
      };

      await sendMessageHandler(
        req,
        interactiveReplyMsg,
        selectedChat,
        selectedSession
      );
    }
  } else if (!selectedSession.refRequired) {
    // ************* Receiving interactive reply **************
    if (msgType === 'interactive') {
      const interactive =
        req.body.entry[0].changes[0].value.messages[0].interactive;

      const replyMessage = await Message.findOne({
        whatsappID: selectedMessage.context.id,
      });

      // ************** the client reply to the last bot message
      if (replyMessage._id.equals(selectedSession.lastBotMessage)) {
        let msgOption;

        if (interactive.type === 'button_reply') {
          const replyButtons = replyMessage.interactive.action.buttons;
          // console.log('replyButtons', replyButtons);
          const button = replyButtons.filter(
            (btn) => btn.reply.id === interactive.button_reply.id
          )[0];
          // console.log('button', button);

          //===========> Selecting reply message
          msgOption = button.reply;
        } else if (interactive.type === 'list_reply') {
          // to join all options in one array
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

          //===========> Selecting reply message
          msgOption = selectedOption;
        }

        const msgToBeSent = await checkInteractiveHandler(
          msgOption,
          selectedSession,
          selectedChat
        );

        //===========> Sending an intro message
        if (
          msgOption.id === 'inspector_phone' &&
          msgToBeSent.type === 'contacts'
        ) {
          const introMsg = {
            type: 'text',
            text: 'هذا هو رقم االفاحص الفني الخاص بمشروعكم',
          };
          await sendMessageHandler(
            req,
            introMsg,
            selectedChat,
            selectedSession
          );
        }

        //===========> Sending first reply message
        await sendMessageHandler(
          req,
          msgToBeSent,
          selectedChat,
          selectedSession
        );

        //===========> Sending second reply message
        if (
          [
            'inspector_phone',
            'visits_reports',
            'project_tickets',
            'missing_data',
            'payment_status',
            'contractor_instructions',
            'inspection_stages',
            'common_questions',
            'complete_building',
            'work_hours',
          ].includes(msgOption.id)
        ) {
          const interactiveObj = interactiveMessages.filter(
            (message) => message.id === 'check'
          )[0]; // from test data
          const interactive = { ...interactiveObj };
          delete interactive.id;

          const secondMsgToBeSent = { type: 'interactive', interactive };
          await sendMessageHandler(
            req,
            secondMsgToBeSent,
            selectedChat,
            selectedSession
          );
        }

        //===========> Following action (archive, transfer, ...)
        // ***** Archive
        if (['end'].includes(msgOption.id)) {
          // Add end date to the session and remove it from chat
          selectedSession.end = Date.now();
          selectedSession.status = 'finished';
          await selectedSession.save();

          // Updating chat
          selectedChat.currentUser = undefined;
          selectedChat.team = undefined;
          selectedChat.status = 'archived';
          selectedChat.lastSession = undefined;
          await selectedChat.save();

          // Removing chat from bot user chats
          await User.findByIdAndUpdate(
            selectedSession.user,
            { $pull: { chats: selectedChat._id } },
            { new: true, runValidators: true }
          );
        }

        // ***** Transfer
        if (['inquiries', 'customer_service'].includes(msgOption.id)) {
          // ========> Finishing bot session
          selectedSession.end = Date.now();
          selectedSession.status = 'finished';
          await selectedSession.save();

          // =========> Selecting team and user
          const selectedTeam = await Team.findOne({ default: true });

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
          // console.log('teamUsers', teamUsers);

          // ==========> Creating new session
          const newSession = await Session.create({
            chat: selectedChat._id,
            user: teamUsers[0]._id,
            team: selectedTeam._id,
            status: 'onTime',
          });

          // ==========> Updating chat
          selectedChat.lastSession = newSession._id;
          selectedChat.team = selectedTeam._id;
          selectedChat.currentUser = teamUsers[0]._id;
          await selectedChat.save();

          // Adding the selected chat to the user chats
          if (!teamUsers[0].chats.includes(selectedChat._id)) {
            await User.findByIdAndUpdate(
              teamUsers[0]._id,
              { $push: { chats: selectedChat._id } },
              { new: true, runValidators: true }
            );
          }

          // Removing chat from bot user chats
          await User.findByIdAndUpdate(
            selectedSession.user,
            { $pull: { chats: selectedChat._id } },
            { new: true, runValidators: true }
          );
        }

        // ************** the client doesn't reply to the last bot message
      } else {
        //===========> Sending error text message
        const textErrorMsg = {
          type: 'text',
          text: 'عفوا لم استطع التعرف علي اختيارك.',
        };
        await sendMessageHandler(
          req,
          textErrorMsg,
          selectedChat,
          selectedSession
        );

        //===========> Sending error interactive message
        const interactiveMsgObj = interactiveMessages.filter(
          (item) => item.id === 'error'
        )[0];
        const interactiveMsg = { ...interactiveMsgObj };
        delete interactiveMsg.id;
        const interactiveReplyMsg = {
          type: 'interactive',
          interactive: interactiveMsg,
        };

        await sendMessageHandler(
          req,
          interactiveReplyMsg,
          selectedChat,
          selectedSession
        );
      }
    } else {
      // ******** Checking for interactive reply
      selectedSession.refRequired = false;
      selectedSession.referenceNo = undefined;
      await selectedSession.save();

      //===========> Sending error text message
      const textErrorMsg = {
        type: 'text',
        text: 'عفوا لم استطع التعرف علي اختيارك.',
      };
      await sendMessageHandler(
        req,
        textErrorMsg,
        selectedChat,
        selectedSession
      );

      //===========> Sending error interactive message
      const interactiveMsgObj = interactiveMessages.filter(
        (item) => item.id === 'error'
      )[0];
      const interactiveMsg = { ...interactiveMsgObj };
      delete interactiveMsg.id;
      const interactiveReplyMsg = {
        type: 'interactive',
        interactive: interactiveMsg,
      };

      await sendMessageHandler(
        req,
        interactiveReplyMsg,
        selectedChat,
        selectedSession
      );
    }
  }

  // ************* Updating session botTimer **************
  // const delayMins = 2;
  const delayMins = process.env.BOT_EXPIRE_TIME;
  let botTimer = new Date();
  botTimer = botTimer.setTime(botTimer.getTime() + delayMins * 60 * 1000);

  selectedSession.botTimer = botTimer;
  await selectedSession.save();

  const sessions = await Session.find({
    status: 'open',
    botTimer: {
      $exists: true,
      $ne: '',
    },
  });

  await chatBotTimerUpdate.scheduleDocumentUpdateTask(
    sessions,
    req,
    //from config.env
    delayMins,
    responseDangerTime,
    process.env.WHATSAPP_VERSION,
    process.env.WHATSAPP_PHONE_ID,
    process.env.WHATSAPP_TOKEN,
    process.env.WHATSAPP_PHONE_NUMBER
  );
};

const RDAppHandler = async (data) => {
  // console.log('data ===========', data);

  let response;
  try {
    response = await axios.request({
      method: 'post',
      maxBodyLength: Infinity,
      url: 'https://rd0.cpvarabia.com/api/Care/ChatBot.php',
      headers: {
        'Content-Type': 'application/json',
      },
      data: JSON.stringify({ Token: process.env.RD_APP_TOKEN, ...data }),
    });
  } catch (err) {
    console.log('err', err);
  }

  console.log('response.data', response.data);

  return response.data;
};
