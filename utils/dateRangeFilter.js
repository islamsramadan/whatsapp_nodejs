const moment = require('moment-timezone');

const timeZone = process.env.TZ;

const getDateRange = (start, end) => {
  // Step 1: Create moment objects for the start and end of the day in the target timezone
  const startOfDayZoned = moment.tz(start, timeZone).startOf('day');
  const endOfDayZoned = moment.tz(end, timeZone).endOf('day');
  //   console.log('timeZone', timeZone);

  // Step 2: Convert to UTC
  const startOfDayUTC = startOfDayZoned.toDate(); // Convert to native JS Date in UTC
  const endOfDayUTC = endOfDayZoned.toDate(); // Convert to native JS Date in UTC

  //   console.log(`Start of day UTC: ---${new Date(start)}--- ${startOfDayUTC}`);
  //   console.log(`End of day UTC: ${endOfDayUTC}`);

  return { start: startOfDayUTC, end: endOfDayUTC };
};

module.exports = getDateRange;
