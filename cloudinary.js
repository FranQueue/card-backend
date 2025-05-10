// cloudinary.js
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    let folder = 'cards/unknown';
    if (file.fieldname === 'rawImage') folder = 'cards/raw';
    if (file.fieldname === 'cardImage') folder = 'cards/rendered';

    return {
      folder,
      resource_type: 'image',
      format: 'png', // You can keep this or infer from file
    };
  },
});

const upload = multer({ storage });

module.exports = { cloudinary, upload };
