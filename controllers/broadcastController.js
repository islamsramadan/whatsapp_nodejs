const axios = require('axios');
const xlsx = require('xlsx');
const https = require('https');
const fs = require('fs');
const path = require('path');
const json2xls = require('json2xls');
// const moment = require('moment');

const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

const Message = require('../models/messageModel');
const Chat = require('../models/chatModel');
const Broadcast = require('../models/broadcastModel');

const whatsappVersion = process.env.WHATSAPP_VERSION;
const whatsappToken = process.env.WHATSAPP_TOKEN;
const whatsappPhoneID = process.env.WHATSAPP_PHONE_ID;
const whatsappPhoneNumber = process.env.WHATSAPP_PHONE_NUMBER;
const whatsappAccountID = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
const productionLink = process.env.PRODUCTION_LINK;

const isValidDate = (value) => {
  if (typeof value === 'string' && isNaN(value)) {
    const date = new Date(value);
    return !isNaN(date.getTime());
  }
  return false;
};

const convertDate = (timestamp) => {
  const date = new Date(timestamp * 1);

  const hours =
    (date.getHours() + '').length > 1 ? date.getHours() : `0${date.getHours()}`;

  const minutes =
    (date.getMinutes() + '').length > 1
      ? date.getMinutes()
      : `0${date.getMinutes()}`;

  const seconds =
    (date.getSeconds() + '').length > 1
      ? date.getSeconds()
      : `0${date.getSeconds()}`;

  const dateString = date.toDateString();

  const dateFormat = `${dateString}, ${hours}:${minutes}:${seconds}`;

  return dateFormat;
};

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
  let countryCode = req.body.countryCode;

  if (!insertType || !['sheet', 'manual'].includes(insertType)) {
    return next(new AppError('Type is required!', 400));
  }

  if (insertType === 'sheet' && !countryCode) {
    return next(new AppError('Country Code is required!'));
  }

  // remove + from country code if found
  if (countryCode && countryCode.startsWith('+')) {
    countryCode = countryCode.slice(1);
  }

  let jsonData;
  if (insertType === 'sheet') {
    // console.log('req.file', req.file);
    // const workbook = xlsx.readFile(req.file.path);
    // const sheetNameList = workbook.SheetNames;
    // jsonData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetNameList[0]]);

    const workbook = xlsx.readFile(req.file.path, {
      cellText: true, // Ensure all values are read as strings
      cellDates: false, // Disable date parsing
      raw: false, // Do not keep original value types
    });
    const sheetNameList = workbook.SheetNames;
    jsonData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetNameList[0]], {
      header: 0, // Generate an array of arrays
      raw: false, // Ensure all values are strings
    });

    // // Format dates in the JSON data
    // jsonData = jsonData.map((row) => {
    //   const newRow = Object.fromEntries(
    //     Object.entries(row).map(([key, value]) => {
    //       if (isValidDate(value)) {
    //         return [key, moment(value).format('DD/MM/YYYY')];
    //       } else {
    //         return [key, value];
    //       }
    //     }) // Example transformation
    //   );

    //   return newRow;
    // });
  } else if (insertType === 'manual') {
    jsonData = req.body.clients;
  }
  //   console.log('jsonData ============= ', jsonData);

  // ******************************* Start Selecting template **************************************
  const { templateName } = req.body;
  if (!templateName) {
    return next(new AppError('Template name is required!', 400));
  }

  console.log(
    'jsonData ============================================= ',
    jsonData
  );
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
      if (
        insertType === 'sheet' &&
        req.body.attachment &&
        req.body.attachmentType === 'link'
      ) {
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
      } else if (
        insertType === 'sheet' &&
        req.body.attachment &&
        req.body.attachmentType === 'file'
      ) {
        item.fileName = req.body.attachment;
      }

      // *********************************************************************
      // some validation for client number
      if (
        (insertType === 'sheet' && !item[req.body.number]) ||
        (insertType === 'manual' && !item.number)
      ) {
        return { client: 'invalid number', status: 'failed' };
      }

      let client;
      if (insertType === 'sheet') {
        client = item[req.body.number];

        //remove space in phone number
        // client = client.replaceAll(' ', '');
        client = client.replace(/ /g, '');

        if (client?.startsWith('+')) {
          client = client.slice(1);
        } else if (client?.startsWith(`00${countryCode}`)) {
          client = client.slice(2);
        } else if (client?.startsWith('0')) {
          client = client.slice(1);
          client = `${countryCode}${client}`;
        } else if (
          ((countryCode === '966' || countryCode === '971') &&
            client?.startsWith('5')) ||
          (countryCode === '20' && client?.startsWith('1'))
        ) {
          client = `${countryCode}${client}`;
        }
      } else if (insertType === 'manual') {
        client = item.number;
        if (client?.startsWith('+')) client = client.slice(1);
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
          // res.status(201).send(newChat);
        } catch (error) {
          return { client, status: 'failed' };
        }
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
                  text:
                    insertType === 'sheet'
                      ? item[req.body[el]][0]
                      : item[el][0],
                  // text: item[`${req.body[el]}`][0],
                });
                // parameters.push({ type: 'text', text: req.body[el][0] });
              });

              parameters = parametersValues.map((el) => ({
                type: 'text',
                text: insertType === 'sheet' ? item[req.body[el]] : item[el],
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

            // parametersValues.map((el) => {
            //   parameters.push({
            //     type: 'text',
            //     text: Array.isArray(req.body[el])
            //       ? item[req.body[el]][0]
            //       : item[req.body[el]],
            //   });
            // });

            parametersValues.map((el) => {
              parameters.push({
                type: 'text',
                text: Array.isArray(req.body[el])
                  ? insertType === 'sheet'
                    ? item[req.body[el]][0]
                    : item[el][0]
                  : insertType === 'sheet'
                  ? item[req.body[el]]
                  : item[el],
              });
            });

            parameters = parametersValues.map((el) => ({
              type: 'text',
              text: insertType === 'sheet' ? item[req.body[el]] : item[el],
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
                    text:
                      insertType === 'sheet'
                        ? item[req.body[el]][0]
                        : item[el][0],
                  });
                  // parameters.push({ type: 'text', text: req.body[el][0] });
                });

                parameters = parametersValues.map((el) => ({
                  type: 'text',
                  text: insertType === 'sheet' ? item[req.body[el]] : item[el],
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

              //   parametersValues.map((el) => {
              //     parameters.push({
              //       type: 'text',
              //       text: Array.isArray(req.body[el])
              //         ? item[req.body[el]][0]
              //         : item[req.body[el]],
              //     });
              //   });
              parametersValues.map((el) => {
                parameters.push({
                  type: 'text',
                  text: Array.isArray(req.body[el])
                    ? insertType === 'sheet'
                      ? item[req.body[el]][0]
                      : item[el][0]
                    : insertType === 'sheet'
                    ? item[req.body[el]]
                    : item[el],
                });
              });

              parameters = parametersValues.map((el) => ({
                type: 'text',
                text: insertType === 'sheet' ? item[req.body[el]] : item[el],
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

      const result = { client };
      if (newMessage) {
        result.message = newMessage._id;
      } else {
        result.status = 'failed';
      }

      return result;
    })
  );
  // updating event in socket io
  req.app.io.emit('updating');

  // console.log('results ======================== ', results);
  // console.log('jsonData ======================== ', jsonData);

  const broadcastData = {
    template: templateName,
    user: req.user._id,
    results,
    type: insertType,
  };

  if (insertType === 'sheet') {
    broadcastData.sheet = req.file.filename;
  } else if (insertType === 'manual') {
    broadcastData.manual = jsonData;
  }

  const newBroadCast = await Broadcast.create(broadcastData);

  res.status(201).json({
    status: 'success',
    data: {
      template: templateName,
      Broadcast: newBroadCast?._id,
      results,
      jsonData,
    },
  });
});

exports.getAllBroadcasts = catchAsync(async (req, res, next) => {
  const getBroadcastData = (broadcast) => {
    let pending = 0;
    let failed = 0;
    let sent = 0;
    let delivered = 0;
    let read = 0;
    broadcast.results.map((result) => {
      if (
        (result.status && result.status === 'failed') ||
        result.message.status === 'failed'
      ) {
        failed += 1;
      } else if (result.message.status === 'pending') {
        pending += 1;
      } else if (result.message.status === 'sent') {
        sent += 1;
      } else if (result.message.status === 'delivered') {
        delivered += 1;
      } else if (result.message.status === 'read') {
        read += 1;
      }
    });

    return {
      totalMessages: broadcast.results.length,
      pending,
      failed,
      sent,
      delivered,
      read,
    };
  };

  const page = req.query.page || 1;
  let broadcasts, totalResults, totalPages;

  const filterObj = {};
  if (req.query.users) {
    const users = req.query.users.split(',');
    filterObj.user = { $in: users };
  }

  if (req.query.templates) {
    const templates = req.query.templates.split(',');
    filterObj.template = { $in: templates };
  }

  if (req.query.startDate) {
    filterObj.createdAt = { $gt: new Date(req.query.startDate) };
  }
  if (req.query.endDate) {
    const endDate = new Date(req.query.endDate);
    endDate.setDate(endDate.getDate() + 1);

    filterObj.createdAt = {
      ...filterObj.createdAt,
      $lt: endDate,
    };
  }

  broadcasts = await Broadcast.find(filterObj)
    .populate('user', 'firstName lastName')
    .populate('results.message', 'status delivered sent createdAt')
    .sort('-createdAt')
    .skip((page - 1) * 20)
    .limit(20);

  broadcasts = broadcasts.map((broadcast) => ({
    _id: broadcast._id,
    template: broadcast.template,
    user: broadcast.user,
    time: convertDate(broadcast.createdAt),
    results: broadcast.results.length,
    broadcastData: getBroadcastData(broadcast),
  }));

  totalResults = await Broadcast.count(filterObj);
  totalPages = Math.ceil(totalResults / 20);

  res.status(200).json({
    status: 'success',
    results: broadcasts.length,
    data: {
      totalResults,
      totalPages,
      page,
      broadcasts,
    },
  });
});

exports.getOneBroadcast = catchAsync(async (req, res, next) => {
  const broadcast = await Broadcast.findById(req.params.broadcastID).populate(
    'results.message',
    'status delivered sent createdAt'
  );

  const type = req.query.type;

  if (type && type === 'sheet') {
    const results = broadcast.results.map((result) => ({
      client: result.client,
      status: result.status || result.message.status,
      time: result.message
        ? result.message.read ||
          result.message.delivered ||
          result.message.sent ||
          convertDate(result.message.createdAt)
        : convertDate(broadcast.createdAt),
      messageID: result.message?._id,
    }));

    // Convert JSON to Excel
    const xls = json2xls(results);

    // Generate a unique filename
    const fileName = `broadcast_${broadcast._id}.xlsx`;

    // Write the Excel file to disk
    fs.writeFileSync(fileName, xls, 'binary');

    // Send the Excel file as a response
    res.download(fileName, () => {
      // Remove the file after sending
      fs.unlinkSync(fileName);
    });
  } else {
    let pending = 0;
    let failed = 0;
    let sent = 0;
    let delivered = 0;
    let read = 0;
    broadcast.results.map((result) => {
      if (
        (result.status && result.status === 'failed') ||
        result.message.status === 'failed'
      ) {
        failed += 1;
      } else if (result.message.status === 'pending') {
        pending += 1;
      } else if (result.message.status === 'sent') {
        sent += 1;
      } else if (result.message.status === 'delivered') {
        delivered += 1;
      } else if (result.message.status === 'read') {
        read += 1;
      }
    });
    const data = {
      totalMessages: broadcast.results.length,
      pending,
      failed,
      sent,
      delivered,
      read,
    };

    res.status(200).json({
      status: 'success',
      data,
    });
  }
});

//http://localhost:8080/api/v1/broadcast/grouped?templates=malath_appointment,malath_missing_data
exports.getAllBroadcastsByMonth = catchAsync(async (req, res, next) => {
  const type = req.query.type;
  const getBroadcastData = (broadcast) => {
    let pending = 0;
    let failed = 0;
    let sent = 0;
    let delivered = 0;
    let read = 0;
    broadcast.results.map((result) => {
      if (
        (result.status && result.status === 'failed') ||
        result.message.status === 'failed'
      ) {
        failed += 1;
      } else if (result.message.status === 'pending') {
        pending += 1;
      } else if (result.message.status === 'sent') {
        sent += 1;
      } else if (result.message.status === 'delivered') {
        delivered += 1;
      } else if (result.message.status === 'read') {
        read += 1;
      }
    });

    return {
      totalMessages: broadcast.results.length,
      pending,
      failed,
      sent,
      delivered,
      read,
    };
  };

  let broadcasts;

  const filterObj = {};
  if (req.query.users) {
    const users = req.query.users.split(',');
    filterObj.user = { $in: users };
  }

  if (req.query.templates) {
    const templates = req.query.templates.split(',');
    filterObj.template = { $in: templates };
  }

  if (req.query.startDate) {
    filterObj.createdAt = { $gt: new Date(req.query.startDate) };
  }
  if (req.query.endDate) {
    const endDate = new Date(req.query.endDate);
    endDate.setDate(endDate.getDate() + 1);

    filterObj.createdAt = {
      ...filterObj.createdAt,
      $lt: endDate,
    };
  }

  broadcasts = await Broadcast.find(filterObj)
    .populate('user', 'firstName lastName')
    .populate('results.message', 'status delivered sent createdAt')
    .sort('-createdAt');

  // broadcasts = broadcasts.map((broadcast) => ({
  //   _id: broadcast._id,
  //   template: broadcast.template,
  //   user: broadcast.user,
  //   time: convertDate(broadcast.createdAt),
  //   results: broadcast.results.length,
  //   broadcastData: getBroadcastData(broadcast),
  // }));

  const formatDate = (date) => {
    // const dateString = date.toISOString().split('T')[0];
    // // const month = date.toGetMonth();
    // return date.getMonth();

    console.log('date ======================== ', date.getDate(), date);

    // Get the day of the month
    const day = String(date.getDate()).padStart(2, '0');

    // Get the month name
    const monthNames = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];
    const month = monthNames[date.getMonth()];

    // Format the date as "DD Month"
    // return `${day} ${month}`;
    return `${month}`;
  };

  const groupedBroadcasts = {};

  broadcasts.forEach((broadcast) => {
    const ticketDate = new Date(broadcast.createdAt);

    const month = formatDate(ticketDate);

    if (!groupedBroadcasts[month]) {
      groupedBroadcasts[month] = {
        month: month,
        totalMessages: 0,
        pending: 0,
        sent: 0,
        delivered: 0,
        read: 0,
        failed: 0,
      };
    }

    const boradcastData = getBroadcastData(broadcast);

    groupedBroadcasts[month].totalMessages += boradcastData.totalMessages;
    groupedBroadcasts[month].pending += boradcastData.pending;
    groupedBroadcasts[month].sent += boradcastData.sent;
    groupedBroadcasts[month].delivered += boradcastData.delivered;
    groupedBroadcasts[month].read += boradcastData.read;
    groupedBroadcasts[month].failed += boradcastData.failed;
  });

  if (type && type === 'sheet') {
    const results = Object.values(groupedBroadcasts);

    console.log('results', results);

    // Convert JSON to Excel
    const xls = json2xls(results);

    // Generate a unique filename
    const fileName = `broadcast_${Date.now()}.xlsx`;

    // Write the Excel file to disk
    fs.writeFileSync(fileName, xls, 'binary');

    // Send the Excel file as a response
    res.download(fileName, () => {
      // Remove the file after sending
      fs.unlinkSync(fileName);
    });
  } else {
    res.status(200).json({
      status: 'success',
      data: {
        groupedBroadcasts,
      },
    });
  }
});
