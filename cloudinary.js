// cloudinary.js
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const path = require('path');

cloudinary.config({
  cloud_name: 'dbb1fjhhf',
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

console.log('Cloudinary config:', cloudinary.config());

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ storage });

module.exports = { cloudinary, upload };
