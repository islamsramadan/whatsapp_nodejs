const multer = require('multer');
const AppError = require('../utils/appError');

const multerStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    // console.log('file==============', file);
    // cb(
    //   null,
    //   file.mimetype.split('/')[0] === 'image'
    //     ? 'public/img'
    //     : file.mimetype.split('/')[0] === 'video'
    //     ? 'public/videos'
    //     : file.mimetype.split('/')[0] === 'audio'
    //     ? 'public/audios'
    //     : 'public/docs'
    // );
    cb(null, 'public');
  },
  filename: (req, file, cb) => {
    const ext =
      file.mimetype.split('/')[0] === 'image' ||
      file.mimetype.split('/')[0] === 'video' ||
      file.mimetype.split('/')[0] === 'audio'
        ? file.mimetype.split('/')[1]
        : file.originalname.split('.')[file.originalname.split('.').length - 1];

    cb(
      null,
      `user-${req.user.id}-${Date.now()}-${Math.floor(
        Math.random() * 1000
      )}.${ext}`
    );
  },
});

const multerFilter = (req, file, cb) => {
  // if (file.mimetype.startsWith('image')) {
  //   cb(null, true);
  // } else {
  //   cb(new AppError('Not an image! Please upload only images.', 400), false);
  // }
  cb(null, true);
};

const upload = multer({
  storage: multerStorage,
  fileFilter: multerFilter,
});

exports.uploadSingleFile = upload.single('file');
exports.uploadMultiFiles = upload.array('files');
// exports.uploadMessageImage = upload.array('files', 2);
exports.uploadFields = upload.any('fields');

exports.resFileName = (req, res, next) => {
  console.log('req.file', req.file);

  if (!req.file) {
    return next(new AppError('No file found!', 400));
  }

  res.status(201).json({
    status: 'success',
    file: req.file.filename,
  });
};

exports.resFilesNames = (req, res, next) => {
  // console.log('req.files ===============================', req.files);

  if (!req.files || req.files.length === 0) {
    return next(new AppError('No file found!', 400));
  }

  const filesNames = [];
  req.files.map((file) => {
    filesNames.push(file.filename);
  });

  res.status(201).json({
    status: 'success',
    filesNames,
  });
};
