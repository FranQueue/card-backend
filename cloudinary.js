const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Configure Cloudinary with your credentials
cloudinary.config({
  cloud_name: 'dbb1fjhhf',
  api_key: '755166464866419',
  api_secret: 'ZzDEuJ9-s2gobRpjh6WayOmLHh8',
});

// Set up Cloudinary storage for multer
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => ({
    folder: 'card-gallery',
    format: 'png', // 🔥 This line forces PNG format
  }),
});

// Multer setup with Cloudinary storage
const upload = multer({ storage });

module.exports = { upload, cloudinary };