const normalDurations = [
  { id: 0, day: 'Sunday' },
  { id: 1, day: 'Monday' },
  { id: 2, day: 'Tuesday' },
  { id: 3, day: 'Wednesday' },
  { id: 4, day: 'Thursday' },
  { id: 5, day: 'Friday' },
  { id: 6, day: 'Saturday' },
];

exports.checkInsideServiceHours = (durations) => {
  const currentTime = new Date();
  // console.log('currentTime', currentTime);

  const curDay = normalDurations.filter(
    (day) => currentTime.getDay() === day.id
  )[0];

  const selectedDay = durations.filter(
    (duration) => duration.day === curDay.day
  )[0];
  // console.log('selectedDay', selectedDay);

  if (!selectedDay) {
    return false;
  }

  const curHours = currentTime.getHours();

  // console.log(
  //   'curHours , selectedDay.from.hours',
  //   curHours,
  //   selectedDay.from.hours
  // );
  if (curHours < selectedDay.from.hours || curHours > selectedDay.to.hours) {
    return false;
  }

  const curMin = currentTime.getMinutes();
  // console.log(
  //   'curHours === selectedDay.from.hours',
  //   curHours,
  //   selectedDay.from.hours
  // );
  if (
    (curHours === selectedDay.from.hours &&
      curMin < selectedDay.from.minutes) ||
    (curHours === selectedDay.to.hours && curMin > selectedDay.to.minutes)
  ) {
    return false;
  }

  return true;
};

exports.getTheNextServiceHours = (durations) => {
  const currentTime = new Date();
  // console.log('currentTime', currentTime);

  const curDay = normalDurations.filter(
    (day) => currentTime.getDay() === day.id
  )[0];
  // console.log('curDay', curDay);

  const selectedDay = durations.filter(
    (duration) => duration.day === curDay.day
  )[0];
  // console.log('selectedDay', selectedDay);

  const curHours = currentTime.getHours();
  // console.log('curHours', curHours);

  const curMin = currentTime.getMinutes();
  // console.log('curMin', curMin);

  if (
    selectedDay &&
    (curHours < selectedDay.from.hours ||
      (curHours === selectedDay.from.hours &&
        curMin < selectedDay.from.minutes))
  ) {
    // code to adjust in the same selected day
    // console.log('================== the same day');

    const seconds = 0;
    const minutes = selectedDay.from.minutes;
    const hours = selectedDay.from.hours;
    const day = currentTime.getDate();
    const month = currentTime.getMonth();
    const year = currentTime.getFullYear();

    const timer = new Date(year, month, day, hours, minutes, seconds);
    // console.log('timer', timer);
    // console.log('timer', timer.getHours());

    return timer;
  } else {
    // code to adjust in the next of selected day
    // console.log('================== the next day');

    let theNextDuration;
    let nextDayID = curDay.id + 1;
    let daysCount = 0;
    while (!theNextDuration) {
      nextDayID = nextDayID === 7 ? 0 : nextDayID;
      let theNextDay = normalDurations.filter(
        (normal) => normal.id === nextDayID
      )[0];
      // console.log('theNextDay', theNextDay);

      theNextDuration = durations.filter(
        (duration) => duration.day === theNextDay.day
      )[0];
      // console.log('theNextDuration', theNextDuration);

      nextDayID++;
      daysCount++;
    }

    // console.log('daysCount', daysCount);

    const seconds = 0;
    const minutes = theNextDuration.from.minutes;
    const hours = theNextDuration.from.hours;
    const day = currentTime.getDate() + daysCount;
    const month = currentTime.getMonth();
    const year = currentTime.getFullYear();

    const timer = new Date(year, month, day, hours, minutes, seconds);
    // console.log('timer', timer);
    // console.log('timer', timer.getHours());

    return timer;
  }
};
