const mongoose = require('mongoose');
const { default: axios } = require('axios');

const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const { sendEmail } = require('../utils/emailHandler');
const { mailerSendEmail } = require('../utils/emailHandler');

const Chat = require('../models/chatModel');
const Message = require('../models/messageModel');

const whatsappVersion = process.env.WHATSAPP_VERSION;
const whatsappToken = process.env.WHATSAPP_TOKEN;
const whatsappPhoneID = process.env.WHATSAPP_PHONE_ID;
const whatsappPhoneNumber = process.env.WHATSAPP_PHONE_NUMBER;
const whatsappAccountID = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
const productionLink = process.env.PRODUCTION_LINK;

exports.notifyClientHandler = async (req, ticket) => {
  const client = ticket.client;

  // ====================> Sending ticket email
  if (client.email) {
    sendEmail(
      client.email,
      `Ticket-${ticket._id}-${ticket.name}`,
      ticket.description
    );

    const attachments = [
      { file: '1.png', filename: '1.png' },
      { file: '3.png', filename: '3.png' },
      { file: 'test pdf.pdf', filename: 'test pdf.pdf' },
      { file: 'test word.docx', filename: 'test word.docx' },
    ];
    const variables = [
      {
        email: 'islamlaam@gmail.com',
        substitutions: [
          {
            var: 'date',
            value: 'test',
          },
          {
            var: 'name',
            value: 'test',
          },
          {
            var: 'total',
            value: 'test',
          },
          {
            var: 'amount',
            value: 'test',
          },
          {
            var: 'due_date',
            value: 'test',
          },
          {
            var: 'action_url',
            value: 'test',
          },
          {
            var: 'invoice_id',
            value: 'test',
          },
          {
            var: 'description',
            value: 'test',
          },
          {
            var: 'support_url',
            value: 'test',
          },
          {
            var: 'account.name',
            value: 'test',
          },
        ],
      },
    ];
    const emailDetails = {
      attachments: [],
      to: client.email,
      subject: `ticket-${ticket._id}`,
      //   text: 'this email to inform you that your ticket has been created',
      text: ticket.description,
      // html: '',
      //   template: 'x2p0347kqdklzdrn',
      //   variables,
    };

    mailerSendEmail(emailDetails);
  }

  // ====================> Sending ticket whatsapp template
  if (client.number) {
    const templateName = 'new_ticket';

    await sendTicketTemplate(req, client.number, templateName);

    await sendTicketSms(client.number);
  }
};

const sendTicketTemplate = async (req, client, templateName) => {
  const response = await axios.request({
    method: 'get',
    url: `https://graph.facebook.com/${whatsappVersion}/${whatsappAccountID}/message_templates?name=${templateName}`,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${whatsappToken}`,
    },
  });
  const template = response.data.data[0];
  // console.log('template', template);

  if (!template) {
    // return next(new AppError('There is no template with that name!', 404));
    return;
  }

  if (template.status !== 'APPROVED') {
    // return next(
    //   new AppError('You can only send templates with status (APPROVED)!', 400)
    // );
    return;
  }

  // selecting chat that the message belongs to
  const chat = await Chat.findOne({ client });

  let newChat;
  if (!chat) {
    try {
      newChat = await Chat.create({
        client,
        status: 'archived',
      });
      //   res.status(201).send(newChat);
    } catch (error) {
      return { client, status: 'failed' };
    }
  }
  // console.log('chat', chat);

  const selectedChat = chat || newChat;

  //********************************************************************************* */
  //********************************************************************************* */
  // Preparing template for whatsapp payload
  const whatsappPayload = {
    messaging_product: 'whatsapp',
    to: selectedChat.client,
    type: 'template',
    template: {
      name: templateName,
      language: {
        code: template.language,
      },
      components: [],
    },
  };

  // console.log('template.components =============', template);

  template.components.map((component) => {
    if (component.example) {
      let parameters;
      if (component.type === 'HEADER') {
        // format = DOCUMENT / IMAGE / VIDEO / LOCATION
        if (component.format !== 'TEXT') {
          parameters = [{ type: component.format.toLowerCase() }];
          parameters[0][component.format.toLowerCase()] = {
            link: `${productionLink}/${req.file.filename}`,
          };
          if (component.format === 'DOCUMENT') {
            parameters[0].document = {
              link: `${productionLink}/${req.file.filename}`,
              filename: req.file.originalname,
            };
          }
        } else {
          parameters = [];
          let parametersValues =
            component.example[`${component.type.toLowerCase()}_text`];
          parametersValues = Array.isArray(parametersValues[0])
            ? parametersValues[0]
            : parametersValues;

          parametersValues.map((el) => {
            parameters.push({ type: 'text', text: req.body[el][0] });
          });

          parameters = parametersValues.map((el) => ({
            type: 'text',
            text: req.body[el],
          }));
        }
      } else {
        parameters = [];
        let parametersValues =
          component.example[`${component.type.toLowerCase()}_text`];
        parametersValues = Array.isArray(parametersValues[0])
          ? parametersValues[0]
          : parametersValues;

        parametersValues.map((el) => {
          parameters.push({
            type: 'text',
            text: Array.isArray(req.body[el]) ? req.body[el][0] : req.body[el],
          });
        });

        parameters = parametersValues.map((el) => ({
          type: 'text',
          text: req.body[el],
        }));
      }

      whatsappPayload.template.components.push({
        type: component.type.toLowerCase(),
        parameters: parameters,
      });
    }
  });

  //********************************************************************************* */
  // Preparing template for data base
  const newMessageObj = {
    user: req.user.id,
    chat: selectedChat.id,
    from: process.env.WHATSAPP_PHONE_NUMBER,
    type: 'template',
    template: {
      name: templateName,
      language: template.language,
      category: template.category,
      components: [],
    },
  };

  template.components.map((component) => {
    const templateComponent = { type: component.type };

    if (component.type === 'HEADER') {
      templateComponent.format = component.format;

      if (component.example) {
        const headerParameters = whatsappPayload.template.components.filter(
          (comp) => comp.type === 'header'
        )[0].parameters;
        // console.log('headerParameters', headerParameters);

        if (component.format === 'TEXT') {
          templateComponent.text = component.text;

          for (let i = 0; i < headerParameters.length; i++) {
            templateComponent.text = templateComponent.text.replace(
              `{{${i + 1}}}`,
              headerParameters[i].text
            );
          }
        } else {
          templateComponent[`${component.format.toLowerCase()}`] = {
            link: req.file.filename,
          };
          if (component.format === 'DOCUMENT') {
            templateComponent.document = {
              link: req.file.filename,
              filename: req.file.originalname,
            };
          }
        }
      } else {
        templateComponent[`${component.format.toLowerCase()}`] =
          component[`${component.format.toLowerCase()}`];
      }
    } else if (component.type === 'BODY') {
      templateComponent.text = component.text;
      if (component.example) {
        const bodyParameters = whatsappPayload.template.components.filter(
          (comp) => comp.type === 'body'
        )[0].parameters;
        // console.log('bodyParameters', bodyParameters);
        for (let i = 0; i < bodyParameters.length; i++) {
          templateComponent.text = templateComponent.text.replace(
            `{{${i + 1}}}`,
            bodyParameters[i].text
          );
        }
      }
    } else if (component.type === 'BUTTONS') {
      templateComponent.buttons = component.buttons;
    } else {
      templateComponent.text = component.text;
    }

    newMessageObj.template.components.push(templateComponent);
  });

  // console.log('whatsappPayload', whatsappPayload);

  // Sending the template message to the client via whatsapp api
  let sendTemplateResponse;
  try {
    sendTemplateResponse = await axios.request({
      method: 'post',
      maxBodyLength: Infinity,
      url: `https://graph.facebook.com/${whatsappVersion}/${whatsappPhoneID}/messages`,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
      },
      data: JSON.stringify(whatsappPayload),
    });
  } catch (err) {
    console.log('err', err);
  }

  if (!sendTemplateResponse) {
    // return next(
    //   new AppError(
    //     "Template couldn't be sent, Try again with all the variables required!",
    //     400
    //   )
    // );
    return;
  }

  // Adding the template message to database
  const newMessage = await Message.create({
    ...newMessageObj,
    whatsappID: sendTemplateResponse.data.messages[0].id,
  });

  //********************************************************************************* */
  // Adding the sent message as last message in the chat and update chat status
  selectedChat.lastMessage = newMessage._id;
  await selectedChat.save();

  //updating event in socket io
  req.app.io.emit('updating', { chatID: selectedChat._id });
};

const sendTicketSms = async (number) => {
  let data = JSON.stringify({
    userName: process.env.MSEGAT_USERNAME,
    numbers: number,
    userSender: process.env.MSEGAT_SENDER,
    apiKey: process.env.MSEGAT_API_KEY,
    msg: 'Testing cpv arabia sms',
  });

  console.log('data ================= ', data);
  let config = {
    method: 'post',
    maxBodyLength: Infinity,
    url: 'https://www.msegat.com/gw/sendsms.php',
    headers: {
      'Content-Type': 'application/json',
      Cookie: 'SERVERID=MBE1; userCurrency=SAR; userLang=Ar',
    },
    data: data,
  };

  axios
    .request(config)
    .then((response) => {
      console.log(JSON.stringify(response.data));
    })
    .catch((error) => {
      console.log(error);
    });
};
