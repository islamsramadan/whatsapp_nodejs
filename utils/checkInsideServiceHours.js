exports.checkInsideServiceHours = (durations) => {
  const normalDurations = [
    { id: 1, day: 'Monday' },
    { id: 2, day: 'Tuesday' },
    { id: 3, day: 'Wednesday' },
    { id: 4, day: 'Thursday' },
    { id: 5, day: 'Friday' },
    { id: 6, day: 'Saturday' },
    { id: 7, day: 'Sunday' },
  ];
  let currentTime = new Date();

  const curDay = normalDurations.filter(
    (day) => currentTime.getDay() === day.id
  )[0];

  const selectedDay = durations.filter(
    (duration) => duration.day === curDay.day
  )[0];

  if (!selectedDay) {
    return false;
  }

  const curHours = currentTime.getHours();

  if (curHours < selectedDay.from.hours || curHours > selectedDay.to.hours) {
    return false;
  }

  const curMin = currentTime.getMinutes();
  if (
    (curHours === selectedDay.from.hours &&
      curMin < selectedDay.from.minutes) ||
    (curHours === selectedDay.to.hours && curMin > selectedDay.to.minutes)
  ) {
    return false;
  }

  return true;
};
