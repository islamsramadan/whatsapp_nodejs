const cron = require('node-cron');

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
  responseDangerTime
) => {
  // console.log('sessions', sessions);
  const currentTime = new Date();

  const delayArray = sessions.map((session) => session.timer - currentTime);
  // console.log('delayArray', delayArray);

  for (let i = 0; i < delayArray.length; i++) {
    if (delayArray[i] > 0) {
      let session = await Session.findById(sessions[i]._id);

      if (session.timer) {
        let lateTimer = session.timer;
        let dangerTimer = new Date(
          session.timer - delayArray[i] * (1 - responseDangerTime)
        );

        // console.log('session', session);

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
