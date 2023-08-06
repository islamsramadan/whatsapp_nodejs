const axios = require('axios');

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

exports.listenToWebhook = (req, res) => {
  // console.log(JSON.stringify(req.body, null, 2));

  if (req.body.object) {
    console.log('inside body param');

    if (
      req.body.entry &&
      req.body.entry[0].changes &&
      req.body.entry[0].changes[0].value.messages &&
      req.body.entry[0].changes[0].value.messages[0]
    ) {
      const phoneNumberID =
        req.body.entry[0].changes[0].value.metadata.phone_number_id;
      const from = req.body.entry[0].changes[0].value.messages[0].from;
      const msgBody = req.body.entry[0].changes[0].value.messages[0].text.body;

      console.log('phoneNumberID', phoneNumberID);
      console.log('from', from);
      console.log('msgBody', msgBody);

      axios({
        method: 'post',
        url: `https://graph.facebook.com/v17.0/${phoneNumberID}/messages`,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        },
        data: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: from,
          type: 'text',
          text: {
            preview_url: false,
            body: "hello it's me and this is your message: " + msgBody,
          },
        }),
      })
        .then((response) => {
          console.log('Response ==============', JSON.stringify(response.data));
        })
        .catch((error) => {
          console.log(error);
        });

      console.log('req.body', JSON.stringify(req.body, null, 2));
      res.sendStatus(200);
    } else {
      res.sendStatus(404);
    }
  }
};
