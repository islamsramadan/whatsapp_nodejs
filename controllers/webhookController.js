const fs = require('fs');
const axios = require('axios');
const mongoose = require('mongoose');
const { Mutex } = require('async-mutex'); // This will prevent multiple concurrent requests from creating multiple chats & concats.
const chatCreationMutex = new Mutex();
const contactCreationMutex = new Mutex();

const Message = require('./../models/messageModel');
const Chat = require('./../models/chatModel');
const User = require('./../models/userModel');
const Conversation = require('./../models/conversationModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const Team = require('../models/teamModel');
const Session = require('../models/sessionModel');
const Service = require('../models/serviceModel');
const interactiveMessages = require('../utils/interactiveMessages');

const sessionTimerUpdate = require('../utils/sessionTimerUpdate');
const chatBotTimerUpdate = require('../utils/chatBotTimerUpdate');
// const serviceHoursUtils.checkInsideServiceHours = require('../utils/serviceHoursUtils');
const serviceHoursUtils = require('../utils/serviceHoursUtils');
const Contact = require('../models/contactModel');
const ChatHistory = require('../models/historyModel');
const Notification = require('../models/notificationModel');

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
  // console.log('selectedMessage ================= 89', selectedMessage);

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
  // console.log('selectedMessage =========== 218 ', selectedMessage);

  const phoneNumberID =
    req.body.entry[0].changes[0].value.metadata.phone_number_id;
  const from = req.body.entry[0].changes[0].value.messages[0].from;
  const msgType = req.body.entry[0].changes[0].value.messages[0].type;
  const msgID = req.body.entry[0].changes[0].value.messages[0].id;
  const contactName =
    req.body.entry[0].changes[0].value.contacts[0].profile.name;

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
    req.app.io.emit('updating', { chatNumber: from });

    res.status(200).json({ reactedMessage });

    // other messages types
  } else {
    async function createOrGetChat(from) {
      try {
        return chatCreationMutex.runExclusive(async () => {
          let selectedChat = await Chat.findOne({ client: from });

          if (!selectedChat) {
            const botTeam = await Team.findOne({ bot: true });

            selectedChat = await Chat.create({
              client: from,
              team: botTeam._id,
              currentUser: botTeam.supervisor,
            });
          }

          return selectedChat;
        });
      } catch (error) {
        console.error('Error in createOrGetChat:', error);
        throw error; // Re-throw the error after logging it
      }
    }

    const selectedChat = await createOrGetChat(from);

    const newMessageChecker = async (selectedMessage) => {
      const messagesWithSameID = await Message.find({
        whatsappID: selectedMessage.id,
      });
      if (messagesWithSameID.length === 0) {
        return true;
      } else {
        return false;
      }
    };

    const newMessageNotRepeated = await newMessageChecker(selectedMessage);
    // console.log('newMessageNotRepeated =======', newMessageNotRepeated);

    if (!newMessageNotRepeated) {
      return res.status(200).json({ message: 'Message not found!' });
    } // to avoid create new session and make error

    // ------------------------> Selecting Session
    const session = await Session.findById(selectedChat.lastSession);
    let selectedSession = session;

    if (!session) {
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
              const botTeam = await Team.findOne({ bot: true }).session(
                transactionSession
              );

              const newSession = await Session.create(
                [
                  {
                    chat: chat._id,
                    user: botTeam.supervisor,
                    team: botTeam._id,
                    status: 'onTime',
                    type: 'bot',
                  },
                ],
                { session: transactionSession }
              );

              chat.lastSession = newSession[0]._id;
              chat.currentUser = botTeam.supervisor;
              chat.team = botTeam._id;
              await chat.save({ session: transactionSession });

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

    const newMessageData = {
      chat: selectedChat._id,
      session: selectedSession._id,
      from: selectedChat.client,
      type: msgType,
      whatsappID: msgID,
      status: 'received',
      received: convertDate(selectedMessage.timestamp),
    };

    if (selectedSession.secret === true) {
      newMessageData.secret = true;
    }

    // Message Reply
    if (selectedMessage.context && selectedMessage.context.id) {
      const replyMessage = await Message.findOne({
        whatsappID: selectedMessage.context.id,
      });

      if (replyMessage) {
        newMessageData.reply = replyMessage.id;
      }
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

    if (msgType === 'button') {
      const msgBody = req.body.entry[0].changes[0].value.messages[0].button;
      newMessageData.button = {
        payload: msgBody.payload,
        text: msgBody.text,
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

    if (msgType === 'interactive') {
      const interactive =
        req.body.entry[0].changes[0].value.messages[0].interactive;
      newMessageData.interactive = interactive;
    }

    const newMessage = await Message.create(newMessageData);

    // ========================> New Messages Notifications
    if (selectedSession.type === 'normal') {
      const previousNotification = await Notification.findOne({
        user: selectedSession.user,
        chat: selectedChat._id,
        event: 'newMessages',
        session: selectedSession._id,
      });
      if (previousNotification) {
        const updatedNotification = await Notification.findByIdAndUpdate(
          previousNotification._id,
          { $inc: { numbers: 1 }, read: false, sortingDate: Date.now() },
          { new: true, runValidators: true }
        );

        console.log('updatedNotification -------------', updatedNotification);
      } else {
        const newMessagesNotificationData = {
          type: 'messages',
          user: selectedSession.user,
          chat: selectedChat._id,
          session: selectedSession._id,
          event: 'newMessages',
        };

        const newMessagesNotification = await Notification.create(
          newMessagesNotificationData
        );

        console.log(
          'newMessagesNotification ============================= >',
          newMessagesNotification
        );
      }

      // updating notifications event in socket io
      if (req.app.connectedUsers[selectedSession.user]) {
        req.app.connectedUsers[selectedSession.user].emit(
          'updatingNotifications'
        );
      }
    }

    // **************** Fetching name from RD app ***************************

    async function createOrGetContact() {
      try {
        return contactCreationMutex.runExclusive(async () => {
          let contact = await Contact.findOne({ number: selectedChat.client });

          if (!contact) {
            const contactResponse = await RDAppHandler({
              Action: '6', // action:6 to fetch client name
              Phone: selectedChat.client,
            });
            // console.log(
            //   'contactResponse ==================================================================',
            //   contactResponse
            // );

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

          selectedChat.contactName = contact;
          await selectedChat.save();

          return contact;
        });
      } catch (error) {
        console.error('Error in createOrGetChat:', error);
        throw error; // Re-throw the error after logging it
      }
    }

    const contact = await createOrGetContact();

    // // ================> updating session bot reply
    // if (selectedSession.botReply && selectedSession.botReply !== 'proceeding') {
    //   selectedSession.botReply = 'normal';
    // }

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

    // console.log('timer  checking 453 ==========', timer);

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

    // *************************************************************************
    // ************************* Chat Bot Handlers *****************************
    if (selectedSession.type === 'bot') {
      // ============> remove bot timer when client reply
      selectedSession.botTimer = undefined;
      selectedSession.reminder = undefined;
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

    // *************************************************************************
    // ************************* Feedback Handlers *****************************
    if (selectedSession.type === 'feedback') {
      await feedbackHandler(
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
    req.app.io.emit('updating', { chatNumber: from });

    res.status(200).json({ newMessage });
  }
};

const updateMessageStatusHandler = async (req, res, next) => {
  const msgStatus = req.body.entry[0].changes[0].value.statuses[0];
  const msgWhatsappID = req.body.entry[0].changes[0].value.statuses[0].id;
  const chatNumber =
    req.body.entry[0].changes[0].value.statuses[0].recipient_id;

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
  req.app.io.emit('updating', { chatNumber });

  res.status(200).json({ msgToUpdate });
};

const sendMessageHandler = async (
  req,
  msgToBeSent,
  selectedChat,
  selectedSession
) => {
  const newMessageObj = {
    user: selectedSession.user,
    chat: selectedChat._id,
    session: selectedSession._id,
    from: process.env.WHATSAPP_PHONE_NUMBER,
    type: msgToBeSent.type,
  };

  if (selectedSession.secret === true) {
    newMessageObj.secret = true;
  }

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

  if (response) {
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
    if (selectedSession.type === 'bot' || selectedSession.type === 'feedback')
      selectedSession.lastBotMessage = newMessage._id;
    await selectedSession.save();

    //updating event in socket io
    req.app.io.emit('updating', { chatNumber: selectedChat.client });
  }
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
      replyMessage.text =
        'الرجاء تزويدنا برقم المرجع لوثيقة التأمين على العيوب الخفية';

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
      text: 'الرجاء تزويدنا برقم المرجع لوثيقة التأمين على العيوب الخفية',
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
        text: 'عفوا لم يتم العثور على رقم الفاحص الفني!',
      };
    }
  } else if (option.id === 'visits_reports') {
    const response = await RDAppHandler({
      Action: '5', // to fetch project tickets page link
      Phone: selectedChat.client,
      ReferenceNo: selectedSession.referenceNo,
    });

    let visitsLink;
    if (response) {
      array = Object.values(response);
      visitsLink = array[0].Link;
    }
    if (visitsLink) {
      replyMessage = {
        type: 'text',
        text: `رابط الزيارات الخاصة بمشروعكم \n\n ${visitsLink}`,
      };
    } else {
      replyMessage = {
        type: 'text',
        text: 'لم يتم العثور على رابط الزيارات الخاصة بمشروعكم',
      };
    }
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
        text: 'لم يتم العثور على رابط الملاحظات الخاصة بمشروعكم',
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
        text: 'لم يتم العثور على رابط البيانات المطلوبة الخاصة بمشروعكم',
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
          ? 'عميلنا العزيز لقد تم الدفع'
          : paymentStatus === 'NotPaid'
          ? 'عميلنا العزيز لم يتم الدفع حتى الان'
          : 'لم يتم العثور على حالة السداد الخاصة بهذا المشروع';
    } else {
      replyMessage = {
        type: 'text',
        text: 'لم يتم العثور على حالة السداد الخاصة بهذا المشروع',
      };
    }
  } else if (option.id === 'contractor_instructions') {
    // replyMessage = {
    //   type: 'document',
    //   document: {
    //     link: 'https://cpvarabia.com/Documents/ContractorGuidelinesAR.pdf',
    //     filename: 'Contractor instructions',
    //   },
    //   caption: 'هذا هو الملف الخاص بتعليمات المقاول',
    // };

    const contractorFile =
      'https://cpvarabia.com/Documents/ContractorGuidelinesAR.pdf';
    replyMessage = {
      type: 'text',
      text: `رابط الملف الخاص بتعليمات المقاول \n\n ${contractorFile}`,
    };
  } else if (option.id === 'inspection_stages') {
    // replyMessage = {
    //   type: 'document',
    //   document: {
    //     link: 'https://cpvarabia.com/Documents/InspectionStagesAR.pdf',
    //     filename: 'Inspection stages',
    //   },
    //   caption: 'هذا هو الملف الخاص بمراحل الفحص الفني',
    // };

    const inspectionStagesFile =
      'https://cpvarabia.com/Documents/InspectionStagesAR.pdf';
    replyMessage = {
      type: 'text',
      text: `رابط الملف الخاص بمراحل الفحص الفني \n\n ${inspectionStagesFile}`,
    };
  } else if (option.id === 'common_questions') {
    // replyMessage = {
    //   type: 'document',
    //   document: {
    //     link: 'https://cpvarabia.com/Documents/FqaAR.pdf',
    //     filename: 'Common questions',
    //   },
    //   caption: 'هذا هو الملف الخاص بالاسئلة الشائعة',
    // };

    const commonQuestionsFile = 'https://cpvarabia.com/Documents/FqaAR.pdf';
    replyMessage = {
      type: 'text',
      text: `رابط الملف الخاص بالأسئلة الشائعة \n\n ${commonQuestionsFile}`,
    };
  } else if (option.id === 'complete_building') {
    // replyMessage = {
    //   type: 'document',
    //   document: {
    //     link: 'https://cpvarabia.com/Documents/RD7AR.pdf',
    //     filename: 'Complete building',
    //   },
    //   caption: 'هذا هو الملف الخاص باجراءات المبانى المكتملة',
    // };

    const completeBuildingFile = 'https://cpvarabia.com/Documents/RD7AR.pdf';
    replyMessage = {
      type: 'text',
      text: `رابط الملف الخاص باجراءات المباني المكتملة \n\n ${completeBuildingFile}`,
    };
  } else if (option.id === 'work_hours') {
    replyMessage = {
      type: 'text',
      text: 'اوقات العمل : \n من الاحد الى الخميس من الساعة 09:00 صباحا وحتي الساعة 05:00 مساء. \n نسعد بخدمتكم',
    };
  } else if (option.id === 'customer_service') {
    replyMessage = {
      type: 'text',
      text: 'الرجاء الانتظار .. جارى تحويلكم لأحد ممثلي خدمة العملاء',
    };
  } else if (option.id === 'inquiries') {
    replyMessage = {
      type: 'text',
      text: 'الرجاء الانتظار .. جارى تحويلكم للقسم المختص',
    };
  } else if (option.id === 'end') {
    replyMessage = {
      type: 'text',
      text: 'شكرا لتواصلكم مع شركة CPV العربية \n نأمل أن تحوز خدماتنا على رضاكم',
    };
  } else if (['1', '2', '3', '4', '5'].includes(option.id)) {
    const interactiveFeedback = interactiveMessages.filter((item) => {
      return item.id === 'feedback_2';
    });

    const interactive = { ...interactiveFeedback[0] };

    delete interactive.id;

    replyMessage = {
      type: 'interactive',
      interactive,
    };

    if (selectedSession.type === 'feedback') {
      selectedSession.feedback = [{ text: option.title, value: option.id }];
      await selectedSession.save();
    }
  } else if (['6', '7', '8', '9', '10'].includes(option.id)) {
    const interactiveFeedback = interactiveMessages.filter((item) => {
      return item.id === 'feedback_3';
    });

    const interactive = { ...interactiveFeedback[0] };

    delete interactive.id;

    replyMessage = {
      type: 'interactive',
      interactive,
    };

    if (selectedSession.type === 'feedback') {
      await Session.findByIdAndUpdate(
        selectedSession._id,
        { $push: { feedback: { text: option.title, value: option.id } } },
        { new: true, runValidators: true }
      );
    }
  } else if (['11', '12', '13', '14', '15'].includes(option.id)) {
    replyMessage = {
      type: 'text',
      text: `شكرا لتعاونكم! 

      ملاحظتكم تساهم في تحسين خدماتنا ..`,
    };

    if (selectedSession.type === 'feedback') {
      await Session.findByIdAndUpdate(
        selectedSession._id,
        { $push: { feedback: { text: option.title, value: option.id } } },
        { new: true, runValidators: true }
      );
    }
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

  // ---------> checkingSession for checking for refRequired
  const checkingChat = await Chat.findById(selectedChat._id);
  const checkingSession = await Session.findById(checkingChat.lastSession);

  // ================> updating session bot reply
  if (checkingSession.botReply && checkingSession.botReply !== 'proceeding') {
    checkingSession.botReply = 'normal';

    await checkingSession.save();
  }

  // ******************* Startng chat bot **************
  if (!session) {
    if (!checkingSession.botReply) {
      checkingSession.botReply = 'welcome';
      await checkingSession.save();

      // =======> Send bot welcome message
      const interactiveObj = interactiveMessages.filter(
        (message) => message.id === 'CPV'
      )[0]; // from test data
      const interactive = { ...interactiveObj };
      delete interactive.id;

      const msgToBeSent = { type: 'interactive', interactive };

      await sendMessageHandler(req, msgToBeSent, selectedChat, selectedSession);

      // =======> Create chat history session
      const chatHistoryData = {
        chat: selectedChat._id,
        user: selectedSession.user,
        actionType: 'botReceive',
      };
      await ChatHistory.create(chatHistoryData);
    } else {
      console.log(
        '///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////// false'
      );
    }
  } else if (checkingSession.refRequired) {
    const checkingChat = await Chat.findById(selectedChat._id);
    const checkingSession = await Session.findById(selectedChat.lastSession);

    if (checkingSession.botReply === 'normal') {
      checkingSession.botReply = 'proceeding';
      await checkingSession.save();

      // ************* Checking interactive reply message type **************
      if (msgType === 'text') {
        const textWaitingMsg = {
          type: 'text',
          text: 'برجاء الانتظار',
        };
        await sendMessageHandler(
          req,
          textWaitingMsg,
          selectedChat,
          selectedSession
        );

        const msgBody =
          req.body.entry[0].changes[0].value.messages[0].text.body;

        const validatedMsgBody = msgBody
          .split('')
          .filter((letter) => !isNaN(letter))
          .join('');

        // *** API from RD app ***
        const refResult = await RDAppHandler({
          Action: '1',
          Phone: from,
          ReferenceNo: validatedMsgBody,
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
          text: 'عفوا لم استطع التعرف على الرقم المرجعي الخاص بكم.',
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

      checkingSession.botReply = 'normal';
      await checkingSession.save();
    }
  } else if (!checkingSession.refRequired) {
    // ************* Receiving interactive reply **************
    if (msgType === 'interactive') {
      if (checkingSession.botReply !== 'proceeding') {
        checkingSession.botReply = 'proceeding';
        await checkingSession.save();

        const interactive =
          req.body.entry[0].changes[0].value.messages[0].interactive;

        const replyMessage = await Message.findOne({
          whatsappID: selectedMessage.context.id,
        });

        // ************** the client reply to the last bot message
        if (
          replyMessage &&
          replyMessage._id.equals(selectedSession.lastBotMessage)
        ) {
          // if (replyMessage?._id.equals(selectedSession.lastBotMessage)) {
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
              text: 'رقم الفاحص الفني الخاص بمشروعكم',
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

          //===========> Sending a footer message
          if (
            msgOption.id === 'inspector_phone' &&
            msgToBeSent.type === 'contacts'
          ) {
            const footerMsg = {
              type: 'text',
              text: 'يرجى التواصل مع المهندس عن طريق الواتس اب وسيتم الرد عليك خلال يوم عمل',
            };
            await sendMessageHandler(
              req,
              footerMsg,
              selectedChat,
              selectedSession
            );
          }

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
            selectedSession.timer = undefined;
            selectedSession.botTimer = undefined;
            await selectedSession.save();

            // =======> Create chat history session
            const chatHistoryData = {
              chat: selectedChat._id,
              user: selectedSession.user,
              actionType: 'archive',
              archive: 'bot',
            };
            await ChatHistory.create(chatHistoryData);

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

            // ========> Finishing bot session
            selectedSession.end = Date.now();
            selectedSession.status = 'finished';
            selectedSession.timer = undefined;
            selectedSession.botTimer = undefined;
            await selectedSession.save();

            // ==========> Creating new session
            const newSession = await Session.create({
              chat: selectedChat._id,
              user: teamUsers[0]._id,
              team: selectedTeam._id,
              status: 'onTime',
            });

            // =======> Create chat history session
            const chatHistoryData = {
              chat: selectedChat._id,
              user: selectedChat.currentUser,
              actionType: 'transfer',
              transfer: {
                type: 'bot',
                to: teamUsers[0]._id,
                toTeam: selectedTeam._id,
              },
            };
            await ChatHistory.create(chatHistoryData);

            // =======> New Chat Notification
            const newChatNotificationData = {
              type: 'messages',
              user: teamUsers[0]._id,
              chat: selectedChat._id,
              event: 'newChat',
            };

            const newChatNotification = await Notification.create(
              newChatNotificationData
            );
            console.log(
              'newChatNotification -------------',
              newChatNotification
            );

            // updating notifications event in socket io
            if (req.app.connectedUsers[teamUsers[0]._id]) {
              req.app.connectedUsers[teamUsers[0]._id].emit(
                'updatingNotifications'
              );
            }

            // ==========> Updating chat
            selectedChat.lastSession = newSession._id;
            selectedChat.team = selectedTeam._id;
            selectedChat.currentUser = teamUsers[0]._id;
            await selectedChat.save();

            //  ******************************************* ////////////////////////////////////////////////////////////////
            //  ******************************************* ////////////////////////////////////////////////////////////////
            //  ******************************************* ////////////////////////////////////////////////////////////////
            // ************ where to send another message depending on service hours

            const selectedTeamServiceHours = await Service.findById(
              selectedTeam.serviceHours
            );
            // console.log('selectedTeamServiceHours', selectedTeamServiceHours);
            const selectedTeamConversation = await Conversation.findById(
              selectedTeam.conversation
            );
            // console.log('selectedTeamConversation', selectedTeamConversation);

            const msgText = serviceHoursUtils.checkInsideServiceHours(
              selectedTeamServiceHours.durations
            )
              ? selectedTeamConversation.bodyOn
              : selectedTeamConversation.bodyOff;
            const msgToBeSent = {
              type: 'text',
              text: msgText,
            };
            await sendMessageHandler(
              req,
              msgToBeSent,
              selectedChat,
              newSession
            );
            //  *******************************************

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
            text: 'عفوا لم استطع التعرف على اختيارك.',
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

        checkingSession.botReply = 'normal';
        await checkingSession.save();
      }
    } else {
      // // ******** Checking for interactive reply
      // selectedSession.refRequired = false;
      // selectedSession.referenceNo = undefined;
      // await selectedSession.save();

      if (checkingSession.botReply === 'normal') {
        checkingSession.botReply = 'proceeding';
        await checkingSession.save();

        //===========> Sending error text message
        const textErrorMsg = {
          type: 'text',
          text: 'عفوا لم استطع التعرف على اختيارك.',
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

        checkingSession.botReply = 'error';
        await checkingSession.save();
      }
    }
  }

  // ************* Updating session botTimer **************
  // const delayMins = 2;
  const delayMins = process.env.BOT_EXPIRE_TIME;
  let botTimer = new Date();
  botTimer = botTimer.setTime(botTimer.getTime() + delayMins * 60 * 1000);

  selectedSession.botTimer = botTimer;
  selectedSession.reminder = true;
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

  // console.log('response.data', response.data);

  return response.data;
};

const feedbackHandler = async (
  req,
  from,
  selectedMessage,
  selectedChat,
  selectedSession,
  session,
  msgType
) => {
  // ******************* All cases if it is a bot session **************

  // ---------> checkingSession for checking for refRequired
  const checkingChat = await Chat.findById(selectedChat._id);
  const checkingSession = await Session.findById(checkingChat.lastSession);

  // ================> updating session bot reply
  // if (checkingSession.botReply && checkingSession.botReply !== 'proceeding') {
  //   checkingSession.botReply = 'normal';

  //   await checkingSession.save();
  // }

  // ******************* Startng chat bot **************
  // if (!session) {
  //   if (!checkingSession.botReply) {
  //     checkingSession.botReply = 'welcome';
  //     await checkingSession.save();

  //     // =======> Send bot welcome message
  //     const interactiveObj = interactiveMessages.filter(
  //       (message) => message.id === 'CPV'
  //     )[0]; // from test data
  //     const interactive = { ...interactiveObj };
  //     delete interactive.id;

  //     const msgToBeSent = { type: 'interactive', interactive };

  //     await sendMessageHandler(req, msgToBeSent, selectedChat, selectedSession);

  //     // =======> Create chat history session
  //     const chatHistoryData = {
  //       chat: selectedChat._id,
  //       user: selectedSession.user,
  //       actionType: 'botReceive',
  //     };
  //     await ChatHistory.create(chatHistoryData);
  //   } else {
  //     console.log(
  //       '///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////// false'
  //     );
  //   }
  // } else if (checkingSession.refRequired) {
  //   const checkingChat = await Chat.findById(selectedChat._id);
  //   const checkingSession = await Session.findById(selectedChat.lastSession);

  //   if (checkingSession.botReply === 'normal') {
  //     checkingSession.botReply = 'proceeding';
  //     await checkingSession.save();

  //     // ************* Checking interactive reply message type **************
  //     if (msgType === 'text') {
  //       const textWaitingMsg = {
  //         type: 'text',
  //         text: 'برجاء الانتظار',
  //       };
  //       await sendMessageHandler(
  //         req,
  //         textWaitingMsg,
  //         selectedChat,
  //         selectedSession
  //       );

  //       const msgBody =
  //         req.body.entry[0].changes[0].value.messages[0].text.body;

  //       const validatedMsgBody = msgBody
  //         .split('')
  //         .filter((letter) => !isNaN(letter))
  //         .join('');

  //       // *** API from RD app ***
  //       const refResult = await RDAppHandler({
  //         Action: '1',
  //         Phone: from,
  //         ReferenceNo: validatedMsgBody,
  //       });

  //       //===========> valid reference no
  //       if (refResult.Result) {
  //         selectedSession.referenceNo = msgBody;
  //         selectedSession.refRequired = false;
  //         await selectedSession.save();

  //         const interactiveMsgObj = interactiveMessages.filter(
  //           (item) => item.id === 'inspection'
  //         )[0];
  //         const interactiveMsg = { ...interactiveMsgObj };
  //         delete interactiveMsg.id;
  //         const interactiveReplyMsg = {
  //           type: 'interactive',
  //           interactive: interactiveMsg,
  //         };

  //         await sendMessageHandler(
  //           req,
  //           interactiveReplyMsg,
  //           selectedChat,
  //           selectedSession
  //         );

  //         //===========> invalid reference no
  //       } else {
  //         selectedSession.refRequired = false;
  //         await selectedSession.save();

  //         const interactiveMsgObj = interactiveMessages.filter(
  //           (item) => item.id === 'ref_error'
  //         )[0];
  //         const interactiveMsg = { ...interactiveMsgObj };
  //         delete interactiveMsg.id;
  //         const interactiveReplyMsg = {
  //           type: 'interactive',
  //           interactive: interactiveMsg,
  //         };

  //         await sendMessageHandler(
  //           req,
  //           interactiveReplyMsg,
  //           selectedChat,
  //           selectedSession
  //         );
  //       }
  //     } else {
  //       // ******** Checking for reference no. reply
  //       selectedSession.refRequired = false;
  //       selectedSession.referenceNo = undefined;
  //       await selectedSession.save();

  //       //===========> Sending error text message
  //       const textErrorMsg = {
  //         type: 'text',
  //         text: 'عفوا لم استطع التعرف على الرقم المرجعي الخاص بكم.',
  //       };
  //       await sendMessageHandler(
  //         req,
  //         textErrorMsg,
  //         selectedChat,
  //         selectedSession
  //       );

  //       //===========> Sending error interactive message
  //       const interactiveMsgObj = interactiveMessages.filter(
  //         (item) => item.id === 'error'
  //       )[0];
  //       const interactiveMsg = { ...interactiveMsgObj };
  //       delete interactiveMsg.id;
  //       const interactiveReplyMsg = {
  //         type: 'interactive',
  //         interactive: interactiveMsg,
  //       };

  //       await sendMessageHandler(
  //         req,
  //         interactiveReplyMsg,
  //         selectedChat,
  //         selectedSession
  //       );
  //     }

  //     checkingSession.botReply = 'normal';
  //     await checkingSession.save();
  //   }
  // } else if (!checkingSession.refRequired) {
  //   // ************* Receiving interactive reply **************
  //   if (msgType === 'interactive') {
  //     if (checkingSession.botReply !== 'proceeding') {
  //       checkingSession.botReply = 'proceeding';
  //       await checkingSession.save();

  //       const interactive =
  //         req.body.entry[0].changes[0].value.messages[0].interactive;

  //       const replyMessage = await Message.findOne({
  //         whatsappID: selectedMessage.context.id,
  //       });

  //       // ************** the client reply to the last bot message
  //       if (
  //         replyMessage &&
  //         replyMessage._id.equals(selectedSession.lastBotMessage)
  //       ) {
  //         // if (replyMessage?._id.equals(selectedSession.lastBotMessage)) {
  //         let msgOption;

  //         if (interactive.type === 'button_reply') {
  //           const replyButtons = replyMessage.interactive.action.buttons;
  //           // console.log('replyButtons', replyButtons);
  //           const button = replyButtons.filter(
  //             (btn) => btn.reply.id === interactive.button_reply.id
  //           )[0];
  //           // console.log('button', button);

  //           //===========> Selecting reply message
  //           msgOption = button.reply;
  //         } else if (interactive.type === 'list_reply') {
  //           // to join all options in one array
  //           const listOptions = [];
  //           replyMessage.interactive.action.sections.map((section) => {
  //             section.rows.map((row) => {
  //               listOptions.push({
  //                 id: row.id,
  //                 title: row.title,
  //                 description: row.description,
  //               });
  //             });
  //           });
  //           // console.log('listOptions', listOptions);

  //           const selectedOption = listOptions.filter(
  //             (option) => option.id === interactive.list_reply.id
  //           )[0];
  //           // console.log('selectedOption', selectedOption);

  //           //===========> Selecting reply message
  //           msgOption = selectedOption;
  //         }

  //         const msgToBeSent = await checkInteractiveHandler(
  //           msgOption,
  //           selectedSession,
  //           selectedChat
  //         );

  //         //===========> Sending an intro message
  //         if (
  //           msgOption.id === 'inspector_phone' &&
  //           msgToBeSent.type === 'contacts'
  //         ) {
  //           const introMsg = {
  //             type: 'text',
  //             text: 'رقم الفاحص الفني الخاص بمشروعكم',
  //           };
  //           await sendMessageHandler(
  //             req,
  //             introMsg,
  //             selectedChat,
  //             selectedSession
  //           );
  //         }

  //         //===========> Sending first reply message
  //         await sendMessageHandler(
  //           req,
  //           msgToBeSent,
  //           selectedChat,
  //           selectedSession
  //         );

  //         //===========> Sending a footer message
  //         if (
  //           msgOption.id === 'inspector_phone' &&
  //           msgToBeSent.type === 'contacts'
  //         ) {
  //           const footerMsg = {
  //             type: 'text',
  //             text: 'يرجى التواصل مع المهندس عن طريق الواتس اب وسيتم الرد عليك خلال يوم عمل',
  //           };
  //           await sendMessageHandler(
  //             req,
  //             footerMsg,
  //             selectedChat,
  //             selectedSession
  //           );
  //         }

  //         //===========> Sending second reply message
  //         if (
  //           [
  //             'inspector_phone',
  //             'visits_reports',
  //             'project_tickets',
  //             'missing_data',
  //             'payment_status',
  //             'contractor_instructions',
  //             'inspection_stages',
  //             'common_questions',
  //             'complete_building',
  //             'work_hours',
  //           ].includes(msgOption.id)
  //         ) {
  //           const interactiveObj = interactiveMessages.filter(
  //             (message) => message.id === 'check'
  //           )[0]; // from test data
  //           const interactive = { ...interactiveObj };
  //           delete interactive.id;

  //           const secondMsgToBeSent = { type: 'interactive', interactive };
  //           await sendMessageHandler(
  //             req,
  //             secondMsgToBeSent,
  //             selectedChat,
  //             selectedSession
  //           );
  //         }

  //         //===========> Following action (archive, transfer, ...)
  //         // ***** Archive
  //         if (['end'].includes(msgOption.id)) {
  //           // Add end date to the session and remove it from chat
  //           selectedSession.end = Date.now();
  //           selectedSession.status = 'finished';
  //           selectedSession.timer = undefined;
  //           selectedSession.botTimer = undefined;
  //           await selectedSession.save();

  //           // =======> Create chat history session
  //           const chatHistoryData = {
  //             chat: selectedChat._id,
  //             user: selectedSession.user,
  //             actionType: 'archive',
  //             archive: 'bot',
  //           };
  //           await ChatHistory.create(chatHistoryData);

  //           // Updating chat
  //           selectedChat.currentUser = undefined;
  //           selectedChat.team = undefined;
  //           selectedChat.status = 'archived';
  //           selectedChat.lastSession = undefined;
  //           await selectedChat.save();

  //           // Removing chat from bot user chats
  //           await User.findByIdAndUpdate(
  //             selectedSession.user,
  //             { $pull: { chats: selectedChat._id } },
  //             { new: true, runValidators: true }
  //           );
  //         }

  //         // ***** Transfer
  //         if (['inquiries', 'customer_service'].includes(msgOption.id)) {
  //           // =========> Selecting team and user
  //           const selectedTeam = await Team.findOne({ default: true });

  //           let teamUsers = await Promise.all(
  //             selectedTeam.users.map(async function (user) {
  //               let teamUser = await User.findById(user);
  //               return teamUser;
  //             })
  //           );
  //           // console.log('teamUsers', teamUsers);

  //           // status sorting order
  //           const statusSortingOrder = [
  //             'Online',
  //             'Service hours',
  //             'Offline',
  //             'Away',
  //           ];

  //           // teamUsers = teamUsers.sort((a, b) => a.chats.length - b.chats.length);
  //           teamUsers = teamUsers.sort((a, b) => {
  //             const orderA = statusSortingOrder.indexOf(a.status);
  //             const orderB = statusSortingOrder.indexOf(b.status);

  //             // If 'status' is the same, then sort by chats length
  //             if (orderA === orderB) {
  //               return a.chats.length - b.chats.length;
  //             }

  //             // Otherwise, sort by 'status'
  //             return orderA - orderB;
  //           });
  //           // console.log('teamUsers', teamUsers);

  //           // ========> Finishing bot session
  //           selectedSession.end = Date.now();
  //           selectedSession.status = 'finished';
  //           selectedSession.timer = undefined;
  //           selectedSession.botTimer = undefined;
  //           await selectedSession.save();

  //           // ==========> Creating new session
  //           const newSession = await Session.create({
  //             chat: selectedChat._id,
  //             user: teamUsers[0]._id,
  //             team: selectedTeam._id,
  //             status: 'onTime',
  //           });

  //           // =======> Create chat history session
  //           const chatHistoryData = {
  //             chat: selectedChat._id,
  //             user: selectedChat.currentUser,
  //             actionType: 'transfer',
  //             transfer: {
  //               type: 'bot',
  //               to: teamUsers[0]._id,
  //               toTeam: selectedTeam._id,
  //             },
  //           };
  //           await ChatHistory.create(chatHistoryData);

  //           // =======> New Chat Notification
  //           const newChatNotificationData = {
  //             type: 'messages',
  //             user: teamUsers[0]._id,
  //             chat: selectedChat._id,
  //             event: 'newChat',
  //           };

  //           const newChatNotification = await Notification.create(
  //             newChatNotificationData
  //           );
  //           console.log(
  //             'newChatNotification -------------',
  //             newChatNotification
  //           );

  //           // updating notifications event in socket io
  //           if (req.app.connectedUsers[teamUsers[0]._id]) {
  //             req.app.connectedUsers[teamUsers[0]._id].emit(
  //               'updatingNotifications'
  //             );
  //           }

  //           // ==========> Updating chat
  //           selectedChat.lastSession = newSession._id;
  //           selectedChat.team = selectedTeam._id;
  //           selectedChat.currentUser = teamUsers[0]._id;
  //           await selectedChat.save();

  //           //  ******************************************* ////////////////////////////////////////////////////////////////
  //           //  ******************************************* ////////////////////////////////////////////////////////////////
  //           //  ******************************************* ////////////////////////////////////////////////////////////////
  //           // ************ where to send another message depending on service hours

  //           const selectedTeamServiceHours = await Service.findById(
  //             selectedTeam.serviceHours
  //           );
  //           // console.log('selectedTeamServiceHours', selectedTeamServiceHours);
  //           const selectedTeamConversation = await Conversation.findById(
  //             selectedTeam.conversation
  //           );
  //           // console.log('selectedTeamConversation', selectedTeamConversation);

  //           const msgText = serviceHoursUtils.checkInsideServiceHours(
  //             selectedTeamServiceHours.durations
  //           )
  //             ? selectedTeamConversation.bodyOn
  //             : selectedTeamConversation.bodyOff;
  //           const msgToBeSent = {
  //             type: 'text',
  //             text: msgText,
  //           };
  //           await sendMessageHandler(
  //             req,
  //             msgToBeSent,
  //             selectedChat,
  //             newSession
  //           );
  //           //  *******************************************

  //           // Adding the selected chat to the user chats
  //           if (!teamUsers[0].chats.includes(selectedChat._id)) {
  //             await User.findByIdAndUpdate(
  //               teamUsers[0]._id,
  //               { $push: { chats: selectedChat._id } },
  //               { new: true, runValidators: true }
  //             );
  //           }

  //           // Removing chat from bot user chats
  //           await User.findByIdAndUpdate(
  //             selectedSession.user,
  //             { $pull: { chats: selectedChat._id } },
  //             { new: true, runValidators: true }
  //           );
  //         }

  //         // ************** the client doesn't reply to the last bot message
  //       } else {
  //         //===========> Sending error text message
  //         const textErrorMsg = {
  //           type: 'text',
  //           text: 'عفوا لم استطع التعرف على اختيارك.',
  //         };
  //         await sendMessageHandler(
  //           req,
  //           textErrorMsg,
  //           selectedChat,
  //           selectedSession
  //         );

  //         //===========> Sending error interactive message
  //         const interactiveMsgObj = interactiveMessages.filter(
  //           (item) => item.id === 'error'
  //         )[0];
  //         const interactiveMsg = { ...interactiveMsgObj };
  //         delete interactiveMsg.id;
  //         const interactiveReplyMsg = {
  //           type: 'interactive',
  //           interactive: interactiveMsg,
  //         };

  //         await sendMessageHandler(
  //           req,
  //           interactiveReplyMsg,
  //           selectedChat,
  //           selectedSession
  //         );
  //       }

  //       checkingSession.botReply = 'normal';
  //       await checkingSession.save();
  //     }
  //   } else {
  //     // // ******** Checking for interactive reply
  //     // selectedSession.refRequired = false;
  //     // selectedSession.referenceNo = undefined;
  //     // await selectedSession.save();

  //     if (checkingSession.botReply === 'normal') {
  //       checkingSession.botReply = 'proceeding';
  //       await checkingSession.save();

  //       //===========> Sending error text message
  //       const textErrorMsg = {
  //         type: 'text',
  //         text: 'عفوا لم استطع التعرف على اختيارك.',
  //       };
  //       await sendMessageHandler(
  //         req,
  //         textErrorMsg,
  //         selectedChat,
  //         selectedSession
  //       );

  //       //===========> Sending error interactive message
  //       const interactiveMsgObj = interactiveMessages.filter(
  //         (item) => item.id === 'error'
  //       )[0];
  //       const interactiveMsg = { ...interactiveMsgObj };
  //       delete interactiveMsg.id;
  //       const interactiveReplyMsg = {
  //         type: 'interactive',
  //         interactive: interactiveMsg,
  //       };

  //       await sendMessageHandler(
  //         req,
  //         interactiveReplyMsg,
  //         selectedChat,
  //         selectedSession
  //       );

  //       checkingSession.botReply = 'error';
  //       await checkingSession.save();
  //     }
  //   }
  // }

  // ************* Receiving interactive reply **************
  if (msgType === 'interactive') {
    // if (checkingSession.botReply !== 'proceeding') {
    checkingSession.botReply = 'proceeding';
    await checkingSession.save();

    const interactive =
      req.body.entry[0].changes[0].value.messages[0].interactive;

    const replyMessage = await Message.findOne({
      whatsappID: selectedMessage.context.id,
    });

    // ************** the client reply to the last bot message
    if (
      replyMessage &&
      replyMessage._id.equals(selectedSession.lastBotMessage)
    ) {
      // if (replyMessage?._id.equals(selectedSession.lastBotMessage)) {
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

      //===========> Sending first reply message
      await sendMessageHandler(req, msgToBeSent, selectedChat, selectedSession);

      //===========> Following action (archive, transfer, ...)
      // ***** Archive
      if (['11', '12', '13', '14', '15'].includes(msgOption.id)) {
        // Add end date to the session and remove it from chat
        selectedSession.end = Date.now();
        selectedSession.status = 'finished';
        selectedSession.timer = undefined;
        selectedSession.botTimer = undefined;
        await selectedSession.save();

        // =======> Create chat history session
        const chatHistoryData = {
          chat: selectedChat._id,
          user: selectedSession.user,
          actionType: 'archive',
          archive: 'bot',
        };
        await ChatHistory.create(chatHistoryData);

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

      // ************** the client doesn't reply to the last bot message
    } else {
      //===========> Sending error text message
      const textErrorMsg = {
        type: 'text',
        text: 'عفوا لم استطع التعرف على اختيارك.',
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

    checkingSession.botReply = 'normal';
    await checkingSession.save();
    // }
  } else {
    // ******** Checking for interactive reply

    // if (checkingSession.botReply === 'normal') {
    //   checkingSession.botReply = 'proceeding';
    //   await checkingSession.save();

    //   //===========> Sending error text message
    //   const textErrorMsg = {
    //     type: 'text',
    //     text: 'عفوا لم استطع التعرف على اختيارك.',
    //   };
    //   await sendMessageHandler(
    //     req,
    //     textErrorMsg,
    //     selectedChat,
    //     selectedSession
    //   );

    //   //===========> Sending error interactive message
    //   const interactiveMsgObj = interactiveMessages.filter(
    //     (item) => item.id === 'error'
    //   )[0];
    //   const interactiveMsg = { ...interactiveMsgObj };
    //   delete interactiveMsg.id;
    //   const interactiveReplyMsg = {
    //     type: 'interactive',
    //     interactive: interactiveMsg,
    //   };

    //   await sendMessageHandler(
    //     req,
    //     interactiveReplyMsg,
    //     selectedChat,
    //     selectedSession
    //   );

    //   checkingSession.botReply = 'error';
    //   await checkingSession.save();
    // }

    //===========> Sending error text message
    const textErrorMsg = {
      type: 'text',
      text: 'عفوا لم استطع التعرف على اختيارك.',
    };
    await sendMessageHandler(req, textErrorMsg, selectedChat, selectedSession);

    //===========> Sending error interactive message
    const interactiveMsgObj = interactiveMessages.filter(
      (item) => item.id === 'checkFeedback'
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

  // ************* Updating session botTimer **************
  const delayMins = 2;
  // const delayMins = process.env.BOT_EXPIRE_TIME;
  let botTimer = new Date();
  botTimer = botTimer.setTime(botTimer.getTime() + delayMins * 60 * 1000);

  selectedSession.botTimer = botTimer;
  selectedSession.reminder = true;
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
