const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Configure Cloudinary with your credentials
cloudinary.config({
  cloud_name: franqueue,
  api_key: 755166464866419,
  api_secret: ZzDEuJ9-s2gobRpjh6WayOmLHh8,
});

// Set up Cloudinary storage for multer
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'card-gallery',       // This will be the folder where images are stored on Cloudinary
    allowed_formats: ['png', 'jpg', 'jpeg'],  // Only allow these formats
  },
});

// Multer setup with Cloudinary storage
const upload = multer({ storage });

module.exports = { upload, cloudinary };