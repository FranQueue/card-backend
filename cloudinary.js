// cloudinary.js
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    let folder = 'cards/unknown'; // Default folder
    if (file.fieldname === 'rawImage') folder = 'cards/raw';
    if (file.fieldname === 'cardImage') folder = 'cards/rendered';

    return {
      folder,
      resource_type: 'image',
      format: 'png',
    };
  },
});

const upload = multer({ storage });

module.exports = { cloudinary, upload };
