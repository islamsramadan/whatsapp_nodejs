const axios = require('axios');
const multer = require('multer');
const xlsx = require('xlsx');
const https = require('https');
const fs = require('fs');
const path = require('path');

const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

const Message = require('../models/messageModel');
const Chat = require('../models/chatModel');
const Team = require('../models/teamModel');
const Session = require('../models/sessionModel');
const User = require('../models/userModel');
const ChatHistory = require('../models/historyModel');

const whatsappVersion = process.env.WHATSAPP_VERSION;
const whatsappToken = process.env.WHATSAPP_TOKEN;
const whatsappPhoneID = process.env.WHATSAPP_PHONE_ID;
const whatsappPhoneNumber = process.env.WHATSAPP_PHONE_NUMBER;
const whatsappAccountID = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
const productionLink = process.env.PRODUCTION_LINK;

// Function to download broadcast file
const downloadFile = (url) => {
  return new Promise((resolve, reject) => {
    https
      .get(url, (response) => {
        // Check if response is successful
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to get ${url}: ${response.statusCode}`));
          return;
        }

        const contentDisposition = response.headers['content-disposition'];
        let filename = path.basename(new URL(url).pathname);

        if (contentDisposition) {
          const match = contentDisposition.match(/filename="?(.+)"?/);
          if (match) filename = match[1];
        }

        const filePath = `prodcast-${Date.now()}-${Math.floor(
          Math.random() * 1000
        )}-${filename}`;

        const file = fs.createWriteStream(`public/${filePath}`);

        response.pipe(file);

        file.on('finish', () => {
          file.close(() => resolve(filePath));
        });
      })
      .on('error', (err) => {
        fs.unlink(dest, () => {
          // Ensure to handle destination correctly
          reject(err);
        });
      });
  });
};

exports.sendBroadcast = catchAsync(async (req, res, next) => {
  const insertType = req.body.type;

  if (!insertType) {
    return next(new AppError('Type is required!', 400));
  }

  let jsonData;
  if (insertType === 'sheet') {
    console.log('req.file', req.file);
    const workbook = xlsx.readFile(req.file.path);
    const sheetNameList = workbook.SheetNames;
    jsonData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetNameList[0]]);
  } else if (insertType === 'manual') {
    jsonData = req.body.clients;
  }
  //   console.log('jsonData ============= ', jsonData);

  // ******************************* Start Selecting template **************************************
  const { templateName } = req.body;
  if (!templateName) {
    return next(new AppError('Template name is required!', 400));
  }

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
    return next(new AppError('There is no template with that name!', 404));
  }

  if (template.status !== 'APPROVED') {
    return next(
      new AppError('You can only send templates with status (APPROVED)!', 400)
    );
  }
  // ******************************* End Selecting template **************************************

  // Preparing template for whatsapp payload
  const whatsappPayload = {
    messaging_product: 'whatsapp',
    type: 'template',
    template: {
      name: templateName,
      language: {
        code: template.language,
      },
      components: [],
    },
  };

  //********************************************************************************* */
  // Preparing template for Message database
  const newMessageObj = {
    user: req.user.id,
    from: process.env.WHATSAPP_PHONE_NUMBER,
    type: 'template',
    template: {
      name: templateName,
      language: template.language,
      category: template.category,
      components: [],
    },
  };

  const results = await Promise.all(
    jsonData.map(async (item, i) => {
      // URL of the file to download
      if (req.body.attachment && req.body.attachmentType === 'link') {
        const fileUrl = item[req.body.attachment] || '';

        await downloadFile(fileUrl)
          .then((res) => {
            console.log('res =============================', res);
            console.log('File downloaded successfully.');
            if (res) {
              item.fileName = res;
            }
          })
          .catch((err) => {
            console.error('Error downloading file:', err);
          });
      } else if (req.body.attachment && req.body.attachmentType === 'file') {
        item.fileName = req.body.attachment;
      }

      // *********************************************************************

      const client = item[req.body.number];

      // selecting chat that the message belongs to
      const chat = await Chat.findOne({ client });

      let newChat;
      if (!chat) {
        newChat = await Chat.create({
          client,
          status: 'archived',
        });
      }
      // console.log('chat', chat);

      const selectedChat = chat || newChat;

      const templateForClient = { ...template };
      //********************************************************************************* */
      // Preparing template for whatsapp payload
      const whatsappPayloadForClient = { to: client, ...whatsappPayload };

      whatsappPayloadForClient.template.components = [];
      templateForClient.components.map((component) => {
        if (component.example) {
          let parameters;
          if (component.type === 'HEADER') {
            // format = DOCUMENT / IMAGE / VIDEO / LOCATION
            if (component.format !== 'TEXT') {
              parameters = [{ type: component.format.toLowerCase() }];
              parameters[0][component.format.toLowerCase()] = {
                link: `${productionLink}/${item.fileName}`,
                // link: `${productionLink}/${req.file.filename}`,
              };
              if (component.format === 'DOCUMENT') {
                parameters[0].document = {
                  link: `${productionLink}/${item.fileName}`,
                  filename: item.fileName,
                  // link: `${productionLink}/${req.file.filename}`,
                  // filename: req.file.originalname,
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
                parameters.push({
                  type: 'text',
                  text: item[req.body[el]][0],
                  // text: item[`${req.body[el]}`][0],
                });
                // parameters.push({ type: 'text', text: req.body[el][0] });
              });

              parameters = parametersValues.map((el) => ({
                type: 'text',
                text: item[req.body[el]],
                // text: req.body[el],
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
                text: Array.isArray(req.body[el])
                  ? item[req.body[el]][0]
                  : item[req.body[el]],
              });
            });

            parameters = parametersValues.map((el) => ({
              type: 'text',
              text: item[req.body[el]],
            }));
          }

          whatsappPayloadForClient.template.components.push({
            type: component.type.toLowerCase(),
            parameters: parameters,
          });
        }
      });

      console.log(
        'whatsappPayloadForClient ================',
        i,
        '=====',
        JSON.stringify(whatsappPayloadForClient)
      );
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
          data: JSON.stringify(whatsappPayloadForClient),
        });
      } catch (err) {
        console.log('err --------------------> sendTemplateResponse');
      }

      let newMessage;
      if (sendTemplateResponse) {
        // Preparing template for Message database
        const newMessageObjForClient = {
          chat: selectedChat._id,
          ...newMessageObj,
        };

        newMessageObjForClient.template.components = [];
        templateForClient.components.map((component) => {
          const templateComponent = { type: component.type };

          if (component.type === 'HEADER') {
            templateComponent.format = component.format;

            if (component.example) {
              let parameters;

              // format = DOCUMENT / IMAGE / VIDEO / LOCATION
              if (component.format !== 'TEXT') {
                parameters = [{ type: component.format.toLowerCase() }];
                parameters[0][component.format.toLowerCase()] = {
                  link: `${productionLink}/${item.fileName}`,
                  // link: `${productionLink}/${req.file.filename}`,
                };
                if (component.format === 'DOCUMENT') {
                  parameters[0].document = {
                    link: `${productionLink}/${item.fileName}`,
                    filename: item.fileName,
                    // link: `${productionLink}/${req.file.filename}`,
                    // filename: req.file.originalname,
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
                  parameters.push({
                    type: 'text',
                    text: item[req.body[el]][0],
                  });
                  // parameters.push({ type: 'text', text: req.body[el][0] });
                });

                parameters = parametersValues.map((el) => ({
                  type: 'text',
                  text: item[req.body[el]],
                  // text: req.body[el],
                }));
              }

              // **************************************************************
              // **************************************************************
              // **************************************************************

              if (component.format === 'TEXT') {
                templateComponent.text = component.text;

                for (let i = 0; i < parameters.length; i++) {
                  templateComponent.text = templateComponent.text.replace(
                    `{{${i + 1}}}`,
                    parameters[i].text
                  );
                }
              } else {
                templateComponent[`${component.format.toLowerCase()}`] = {
                  link: item.fileName,
                  // link: req.file.filename,
                };
                if (component.format === 'DOCUMENT') {
                  templateComponent.document = {
                    link: item.fileName,
                    filename: item.fileName,
                    // link: req.file.filename,
                    // filename: req.file.originalname,
                  };
                }
              }
            } else {
              templateComponent[`${component.format.toLowerCase()}`] =
                component[`${component.format.toLowerCase()}`];
            }
          } else if (component.type === 'BODY') {
            templateComponent.text = component.text;
            // if (component.example) {
            //   const bodyParameters =
            //     whatsappPayloadForClient.template.components.filter(
            //       (comp) => comp.type === 'body'
            //     )[0].parameters;
            //   // console.log('bodyParameters', bodyParameters);
            //   for (let i = 0; i < bodyParameters.length; i++) {
            //     templateComponent.text = templateComponent.text.replace(
            //       `{{${i + 1}}}`,
            //       bodyParameters[i].text
            //     );
            //   }
            // }
            if (component.example) {
              parameters = [];
              let parametersValues =
                component.example[`${component.type.toLowerCase()}_text`];
              parametersValues = Array.isArray(parametersValues[0])
                ? parametersValues[0]
                : parametersValues;

              parametersValues.map((el) => {
                parameters.push({
                  type: 'text',
                  text: Array.isArray(req.body[el])
                    ? item[req.body[el]][0]
                    : item[req.body[el]],
                });
              });

              parameters = parametersValues.map((el) => ({
                type: 'text',
                text: item[req.body[el]],
              }));

              for (let i = 0; i < parameters.length; i++) {
                templateComponent.text = templateComponent.text.replace(
                  `{{${i + 1}}}`,
                  parameters[i].text
                );
              }
            }
          } else if (component.type === 'BUTTONS') {
            templateComponent.buttons = component.buttons;
          } else {
            templateComponent.text = component.text;
          }

          newMessageObjForClient.template.components.push(templateComponent);
        });

        // Adding the template message to database
        newMessage = await Message.create({
          ...newMessageObjForClient,
          whatsappID: sendTemplateResponse.data.messages[0].id,
        });

        selectedChat.lastMessage = newMessage._id;
        await selectedChat.save();
      }

      //********************************************************************************* */
      // updating event in socket io
      req.app.io.emit('updating');

      // console.log('item ***********************************', item);

      return {
        item,
        client,
        message: newMessage ? newMessage._id : 'failed',
      };
    })
  );

  // console.log('results ======================== ', results);
  //   console.log('jsonData ======================== ', jsonData);

  res.status(201).json({
    status: 'success',
    data: {
      // template,
      // whatsappPayload,
      // wahtsappResponse: sendTemplateResponse?.data,
      // message: newMessage,
      jsonData,
      // clients,
      results,
    },
  });
});
