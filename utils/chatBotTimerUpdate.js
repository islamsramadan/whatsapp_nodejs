const cron = require('node-cron');
const { Mutex } = require('async-mutex'); // This will prevent multiple concurrent requests from creating multiple bot reply.
const botRemiderMutex = new Mutex();

const Session = require('../models/sessionModel');
const Chat = require('../models/chatModel');
const { default: axios } = require('axios');
const User = require('../models/userModel');
const Message = require('../models/messageModel');
const ChatHistory = require('../models/historyModel');

const getCronExpression = (timer) => {
  const timerExpression = {
    year: timer.getFullYear(),
    month: timer.getMonth() + 1,
    day: timer.getDate(),
    hour: timer.getHours(),
    minute: timer.getMinutes(),
    second: timer.getSeconds(),
  };

  return `${timerExpression.second} ${timerExpression.minute} ${timerExpression.hour} ${timerExpression.day} ${timerExpression.month} * ${timerExpression.year}`;
};

const sendMessageHandler = async (
  req,
  msgToBeSent,
  chat,
  session,
  whatsappVersion,
  whatsappPhoneID,
  whatsappToken,
  whatsappNumber
) => {
  const newMessageObj = {
    user: chat.currentUser,
    chat: chat._id,
    session: session,
    from: whatsappNumber,
    type: msgToBeSent.type,
  };

  const whatsappPayload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: chat.client,
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
      url: `https://graph.facebook.com/${whatsappVersion}/${whatsappPhoneID}/messages`,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${whatsappToken}`,
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
  chat.lastMessage = newMessage._id;
  chat.status = 'open';
  // updating chat notification to false
  chat.notification = false;
  await chat.save();

  // Updating session to new status ((open))
  session.status = 'open';
  session.timer = undefined;
  if (session.type === 'bot') session.lastBotMessage = newMessage._id;
  await session.save();
};

const sendFeedbackHandler = async (data) => {
  // console.log('data ===========', data);

  // console.log({ Token: process.env.RD_APP_TOKEN, ...data });
  let response;
  try {
    response = await axios.request({
      method: 'post',
      maxBodyLength: Infinity,
      url: 'https://rd0.cpvarabia.com/api/Care/AddSurvey.php',
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

const updateTask = (
  req,
  timer,
  sessionID,
  status,
  delay,
  responseDangerTime,
  whatsappVersion,
  whatsappPhoneID,
  whatsappToken,
  whatsappNumber,
  checkingTimer
) => {
  const cronExpression = getCronExpression(timer);
  // console.log('cronExpression', cronExpression);

  cron.schedule(cronExpression, async () => {
    await botRemiderMutex.runExclusive(async () => {
      // console.log('status', status);
      const session = await Session.findById(sessionID);
      const chat = await Chat.findById(session.chat);

      // console.log(
      //   'session ================================================================',
      //   session
      // );

      if (
        session.botTimer &&
        // session.botTimer === checkingTimer &&
        session.status === 'open' &&
        ((session.botTimer.getTime() === timer.getTime() &&
          status === 'tooLate') ||
          (new Date(
            session.botTimer - delay * (1 - responseDangerTime)
          ).getTime() === timer.getTime() &&
            status === 'danger'))
      ) {
        // console.log('status again', status);
        // console.log(
        //   'session ---------------------------------------------------------------------- ',
        //   status,
        //   session
        // );

        if (status === 'danger' && session.reminder === true) {
          // console.log('danger ====================');

          //========> Remove session reminder
          session.reminder = false;
          await session.save();

          //========> Send reminder message
          const msgToBeSent = {
            type: 'text',
            text: 'ستنتهي المحادثة قريبًا. يرجى الاستمرار.',
          };
          await sendMessageHandler(
            req,
            msgToBeSent,
            chat,
            session,
            whatsappVersion,
            whatsappPhoneID,
            whatsappToken,
            whatsappNumber
          );
        }

        if (status === 'tooLate' && session.status !== 'finished') {
          // console.log('tooLate ====================');

          // Add end date to the session and remove it from chat
          session.end = Date.now();
          session.status = 'finished';
          session.botTimer = undefined;
          await session.save();

          // =======> Create chat history session
          const chatHistoryData = {
            chat: chat._id,
            user: session.user,
            actionType: 'archive',
            archive: 'auto',
          };
          await ChatHistory.create(chatHistoryData);

          // Updating chat
          chat.currentUser = undefined;
          chat.team = undefined;
          chat.status = 'archived';
          chat.lastSession = undefined;
          await chat.save();

          // Removing chat from bot user chats
          await User.findByIdAndUpdate(
            session.user,
            { $pull: { chats: chat._id } },
            { new: true, runValidators: true }
          );

          if (session.type === 'feedback') {
            // =======> Send feed back to RD App
            // const updatedfeedbackSession = await Session.findById(
            //   session._id
            // );
            const feedbackQuestions = session.feedback.map((item, i) => ({
              qid: i,
              text: item.text,
              Value: item.value,
            }));

            const feedbackData = {
              phoneno: chat.client,
              session: session._id,
              questions: feedbackQuestions,
            };
            // console.log('feedbackData ===================', feedbackData);

            await sendFeedbackHandler(feedbackData);
          }
        }

        //updating event in socket io
        req.app.io.emit('updating', { chatID: chat._id });
      }
    });
  });
};

exports.scheduleDocumentUpdateTask = async (
  sessions,
  req,
  delayMins,
  responseDangerTime,
  whatsappVersion,
  whatsappPhoneID,
  whatsappToken,
  whatsappNumber
) => {
  // console.log('sessions', sessions);
  const currentTime = new Date();

  const delayArray = sessions.map((session) => session.botTimer - currentTime);
  // console.log('delayArray', delayArray);

  for (let i = 0; i < delayArray.length; i++) {
    if (delayArray[i] > 0) {
      let session = await Session.findById(sessions[i]._id);

      // ********************
      // if condition need to be revised later
      if (session.botTimer && session.status === 'open') {
        const lateTimer = session.botTimer;
        let dangerTimer = new Date(
          session.botTimer - delayArray[i] * (1 - responseDangerTime)
        );

        // console.log('lateTimer', lateTimer);
        // console.log('dangerTimer', dangerTimer);

        // console.log('session', session);

        const checkingTimer = session.botTimer;

        updateTask(
          req,
          dangerTimer,
          sessions[i]._id,
          'danger',
          delayArray[i],
          responseDangerTime,
          whatsappVersion,
          whatsappPhoneID,
          whatsappToken,
          whatsappNumber,
          checkingTimer
        );
        updateTask(
          req,
          lateTimer,
          sessions[i]._id,
          'tooLate',
          delayArray[i],
          responseDangerTime,
          whatsappVersion,
          whatsappPhoneID,
          whatsappToken,
          whatsappNumber,
          checkingTimer
        );
      }
    }
  }
};
