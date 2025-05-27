const moment = require('moment-timezone');

const timeZone = process.env.TZ;

const getDateRange = (start, end) => {
  // Step 1: Create moment objects for the start and end of the day in the target timezone
  const startOfDayZoned = moment.tz(start, timeZone).startOf('day');
  //   console.log('timeZone', timeZone);

  // Step 2: Convert to UTC
  const startOfDayUTC = startOfDayZoned.toDate(); // Convert to native JS Date in UTC

  const result = { start: startOfDayUTC };

  if (end) {
    const endOfDayZoned = moment.tz(end, timeZone).endOf('day');
    const endOfDayUTC = endOfDayZoned.toDate(); // Convert to native JS Date in UTC

    result.end = endOfDayUTC;
  }

  return result;
};

module.exports = getDateRange;
