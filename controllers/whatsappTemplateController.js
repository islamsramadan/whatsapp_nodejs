const axios = require('axios');

const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');

const whatsappVersion = process.env.WHATSAPP_VERSION;
const whatsappAccountID = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
const whatsappToken = process.env.WHATSAPP_TOKEN;

exports.getAllWhatsappTemplates = catchAsync(async (req, res, next) => {
  const queryKeys = Object.keys(req.query);
  const queryValues = Object.values(req.query);

  let queryString = '';
  for (let i = 0; i < queryKeys.length; i++) {
    if (i === 0) queryString = `?${queryKeys[i]}=${queryValues[i]}`;
    if (i > 0) queryString = `${queryString}&${queryKeys[i]}=${queryValues[i]}`;
  }
  //   console.log('queryString', queryString);

  const response = await axios.request({
    method: 'get',
    url: `https://graph.facebook.com/${whatsappVersion}/${whatsappAccountID}/message_templates${queryString}`,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${whatsappToken}`,
    },
  });

  //   console.log('response', response.data);

  res.status(200).json({
    status: 'success',
    results: response.data.data?.length,
    data: {
      templates: response.data.data,
    },
  });
});

exports.createWhatsappTemplate = catchAsync(async (req, res, next) => {
  const categoryArray = ['authentication', 'marketing', 'utility'];
  const languageArray = ['ar', 'en_US', 'en'];
  const { name, category, language } = req.body;

  if (!name || !category || !language) {
    return next(
      new AppError('Template name, language and category are required!', 400)
    );
  }

  const nameRegEx = /^[a-z_]{1,512}$/;
  if (!nameRegEx.test(name)) {
    return next(
      new AppError(
        'Template name can only have lowercase letters and underscores with maximum characters of 512!',
        400
      )
    );
  }

  if (!categoryArray.includes(category.toLowerCase())) {
    return next(new AppError('Invalid template category!', 400));
  }

  const whatsappTemplateData = {
    name,
    language,
    category,
    allow_category_change: true,
  };

  res.status(201).json({
    status: 'success',
    data: {
      //   template,
      whatsappTemplateData,
    },
  });
});
