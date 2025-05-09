const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Configure Cloudinary with your credentials from environment variables
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,  // Load from .env file
  api_key: process.env.API_KEY,        // Load from .env file
  api_secret: process.env.API_SECRET,  // Load from .env file
});

// Set up Cloudinary storage for multer
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => ({
    folder: 'card-gallery',  // Folder where images will be uploaded
    public_id: `${file.fieldname}-${Date.now()}`, // Unique public ID based on field name and timestamp
    transformation: [
      { width: 500, height: 500, crop: 'limit' }, // Optional transformation (resize)
    ],
  }),
});

// Multer setup with Cloudinary storage
const upload = multer({ storage });

// Export the upload middleware and cloudinary instance
module.exports = { upload, cloudinary };
