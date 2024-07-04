const cron = require('node-cron');
const Session = require('../models/sessionModel');
const Message = require('../models/messageModel');

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

const updateTask = (
  req,
  timer,
  sessionID,
  status,
  delay,
  responseDangerTime
) => {
  const cronExpression = getCronExpression(timer);
  // console.log('cronExpression', cronExpression);

  cron.schedule(cronExpression, async () => {
    // console.log('status', status);
    const session = await Session.findById(sessionID);

    // console.log('session', session);

    if (
      session.timer &&
      session.status !== 'finished' &&
      ((session.timer.getTime() === timer.getTime() && status === 'tooLate') ||
        (new Date(
          session.timer - delay * (1 - responseDangerTime)
        ).getTime() === timer.getTime() &&
          status === 'danger'))
    ) {
      // console.log('status again', status);
      session.status = status;
      await session.save();

      //updating event in socket io
      req.app.io.emit('updating');
    }
  });
};

exports.scheduleDocumentUpdateTask = async (
  sessions,
  req,
  responseDangerTime,
  responseTime
) => {
  // console.log('sessions', sessions);
  const currentTime = new Date();

  const delayArray = sessions.map((session) => session.timer - currentTime);
  // console.log('delayArray', delayArray);

  for (let i = 0; i < delayArray.length; i++) {
    if (delayArray[i] > 0) {
      let session = await Session.findById(sessions[i]._id);

      if (session.timer) {
        const lateTimer = session.timer;

        const responseTimeInMelliSeconds =
          (responseTime.hours * 60 + responseTime.minutes) * 60 * 1000;

        const dangerTimer = new Date(
          session.timer - (1 - responseDangerTime) * responseTimeInMelliSeconds
        );

        // console.log('session', session);
        // console.log('lateTimer ============', lateTimer);
        // console.log('dangerTimer ============', dangerTimer);

        updateTask(
          req,
          dangerTimer,
          sessions[i]._id,
          'danger',
          delayArray[i],
          responseDangerTime
        );
        updateTask(
          req,
          lateTimer,
          sessions[i]._id,
          'tooLate',
          delayArray[i],
          responseDangerTime
        );
      }
    }
  }
};

const updatePerfromance = (status, timer, req, message) => {
  const cronExpression = getCronExpression(timer);
  // console.log('cronExpression', cronExpression);

  cron.schedule(cronExpression, async () => {
    // console.log('message ===========', message);

    const session = await Session.findById(message.session);
    let lastUserMessage;

    if (session.lastUserMessage) {
      lastUserMessage = await Message.findById(session.lastUserMessage);
    }

    if (!lastUserMessage || message.createdAt > lastUserMessage.createdAt) {
      const updatedSession = await Session.findById(session._id);
      if (status === 'danger') {
        const dangerSession = await Session.findByIdAndUpdate(
          session._id,
          {
            $set: {
              'performance.onTime':
                updatedSession.performance.onTime > 0
                  ? updatedSession.performance.onTime - 1
                  : 0,
              'performance.danger': updatedSession.performance.danger + 1,
            },
          },
          { new: true, runValidators: true }
        );
        // console.log('dangerSession ===========', dangerSession);
      } else if (status === 'tooLate') {
        const tooLateSession = await Session.findByIdAndUpdate(
          session._id,
          {
            $set: {
              'performance.danger':
                updatedSession.performance.danger > 0
                  ? updatedSession.performance.danger - 1
                  : 0,
              'performance.tooLate': updatedSession.performance.tooLate + 1,
            },
          },
          { new: true, runValidators: true }
        );
        // console.log('tooLateSession ===========', tooLateSession);
      }
    }
  });
};

exports.schedulePerformance = async (
  req,
  message,
  responseDangerTime,
  responseTime
) => {
  const currentTime = new Date();

  const delay = message.timer - currentTime;

  if (delay > 0) {
    const lateTimer = message.timer;

    const responseTimeInMelliSeconds =
      (responseTime.hours * 60 + responseTime.minutes) * 60 * 1000;

    const dangerTimer = new Date(
      message.timer - (1 - responseDangerTime) * responseTimeInMelliSeconds
    );

    // console.log('session', session);
    // console.log('lateTimer ============', lateTimer);
    // console.log('dangerTimer ============', dangerTimer);

    updatePerfromance('danger', dangerTimer, req, message);
    updatePerfromance('tooLate', lateTimer, req, message);
  }
};
