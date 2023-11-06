// const MongoClient = require('mongodb').MongoClient;

exports.connectToMongoDB = async () => {
  const client = new MongoClient(uri, { useNewUrlParser: true });
  try {
    await client.connect();
    console.log('Connected to the MongoDB database');
    return client;
  } catch (err) {
    console.error('Error connecting to the MongoDB database:', err);
    throw err;
  }
};

exports.updateDocumentsBasedOnTimer = async (client) => {
  // Your update logic here
};

const scheduleDocumentUpdateTask = (customDate) => {
  // Connect to the MongoDB database
  connectToMongoDB()
    .then((client) => {
      // Calculate the delay until the custom date
      const currentTime = new Date();
      const delay = customDate - currentTime;

      if (delay > 0) {
        const cronExpression = `*/${delay / 60000} * * * * *`; // Convert delay to minutes
        cron.schedule(cronExpression, () => {
          db.updateDocumentsBasedOnTimer(client);
        });

        console.log(`Scheduled update at ${customDate}`);
      } else {
        console.log('The specified date has already passed.');
      }

      // ... Rest of your application setup ...
    })
    .catch((err) => {
      console.error('Unable to start the application:', err);
    });
};
