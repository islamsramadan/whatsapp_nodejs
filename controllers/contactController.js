const Contact = require('../models/contactModel');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');

exports.updateContact = catchAsync(async (req, res, next) => {
  const contact = await Contact.findOne({ number: req.params.contactNumber });
  if (!contact) {
    return next(new AppError('No contact found with that number', 404));
  }

  if (req.body.type === 'reset') {
    //Reset contact name
    contact.name = contact.externalName || contact.whatsappName;
    contact.updater = req.user._id;
    await contact.save();

    //Update contact name
  } else if (req.body.type === 'update') {
    if (!req.body.name) {
      return next(new AppError('Contact name is required!', 400));
    }
    contact.name = req.body.name;
    contact.updater = req.user._id;
    await contact.save();
  } else {
    return next(new AppError('Type is required!', 400));
  }

  res.status(200).json({
    status: 'success',
    message: 'Contact updated successfully!!',
    contact,
  });
});
