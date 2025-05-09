const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Configure Cloudinary with your credentials (ensure .env is loaded correctly)
cloudinary.config({
  cloud_name: dbb1fjhhf,
  api_key: 755166464866419,
  api_secret: ZzDEuJ9-s2gobRpjh6WayOmLHh8,
});

// Set up Cloudinary storage for multer
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => ({
    folder: 'card-gallery', // Folder where images will be uploaded
    public_id: `${file.fieldname}-${Date.now()}`, // Unique public ID based on the field name and timestamp
  }),
});

// Multer setup with Cloudinary storage
const upload = multer({ storage });

module.exports = { upload, cloudinary };
