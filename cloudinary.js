const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Configure Cloudinary with your credentials
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME, // it's better to keep credentials in environment variables
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
});

// Set up Cloudinary storage for multer
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => ({
    folder: 'card-gallery', // Folder where images will be uploaded
    format: 'png', // Specify the image format, adjust as necessary
    public_id: `${file.fieldname}-${Date.now()}`, // Optionally you can modify the public ID
  }),
});

// Multer setup with Cloudinary storage
const upload = multer({ storage });

module.exports = { upload, cloudinary };
