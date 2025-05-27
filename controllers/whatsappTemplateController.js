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

  let templates = response.data.data || [];
  templates = templates.filter(
    (template) =>
      template.status === 'APPROVED' && template.category !== 'AUTHENTICATION'
  );

  res.status(200).json({
    status: 'success',
    results: templates.length,
    data: {
      templates,
    },
  });
});

exports.createWhatsappTemplate = catchAsync(async (req, res, next) => {
  const categoryArray = ['authentication', 'marketing', 'utility'];
  const languageArray = ['ar', 'en_US', 'en'];

  const { name, category, language, components } = req.body;

  if (
    !name ||
    !category ||
    !language ||
    !components ||
    !Array.isArray(components) ||
    components?.length === 0
  ) {
    return next(
      new AppError(
        'Template name, language, category and components array are required!',
        400
      )
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

  if (!languageArray.includes(language)) {
    return next(new AppError('Invalid template language!', 400));
  }

  if (!categoryArray.includes(category.toLowerCase())) {
    return next(new AppError('Invalid template category!', 400));
  }

  const bodyComponent = components.filter((comp) => comp.type === 'BODY')[0];
  if (!bodyComponent) {
    return next(new AppError('Body component is required!', 400));
  }

  const whatsappTemplateData = {
    name,
    language,
    category: category.toUpperCase(),
    allow_category_change: true,
    components,
  };

  const response = await axios.request({
    method: 'post',
    url: `https://graph.facebook.com/${whatsappVersion}/${whatsappAccountID}/message_templates`,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${whatsappToken}`,
    },
    data: whatsappTemplateData,
  });

  res.status(201).json({
    status: 'success',
    data: {
      response: response.data,
      whatsappTemplateData,
    },
  });
});
