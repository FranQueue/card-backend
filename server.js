require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const multer = require('multer');
const { cloudinary } = require('./cloudinary');
const Card = require('./models/Card');
const fs = require('fs');
const path = require('path');
const stream = require('stream');

// Environment verification
console.log('CLOUDINARY_CLOUD_NAME:', process.env.CLOUDINARY_CLOUD_NAME);
console.log('CLOUDINARY_API_KEY:', process.env.CLOUDINARY_API_KEY ? '✓' : 'MISSING');
console.log('CLOUDINARY_API_SECRET:', process.env.CLOUDINARY_API_SECRET ? '✓' : 'MISSING');
console.log('MONGODB_URI:', process.env.MONGODB_URI ? '✓' : 'MISSING');

// Create uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(), // Store file in memory (no temp files)
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB max
});

const app = express();
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

mongoose.connection.on('connected', () => {
  console.log('✅ MongoDB connected');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB connection error:', err);
});

// Health Check
app.get('/', (req, res) => {
  res.send('✅ Backend is running!');
});

// Upload a new card with image and metadata
app.post('/api/upload', upload.fields([
  { name: 'cardImage', maxCount: 1 },
  { name: 'rawImage', maxCount: 1 }
]), async (req, res) => {
  try {
    console.log('Upload request received. Files:', {
      cardImage: req.files?.cardImage?.[0]?.originalname,
      rawImage: req.files?.rawImage?.[0]?.originalname
    });

    if (!req.files?.cardImage) {
      return res.status(400).json({ error: 'Card image is required' });
    }

    // Helper function for Cloudinary upload
    const uploadToCloudinary = (file, folder, transformations) => {
      return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: folder,
            resource_type: 'image',
            transformation: transformations
          },
          (error, result) => error ? reject(error) : resolve(result)
        );

        // Create stream from buffer
        const bufferStream = new stream.PassThrough();
        bufferStream.end(file.buffer);
        bufferStream.pipe(uploadStream);
      });
    };

    // Upload card image
    const cardUpload = await uploadToCloudinary(
      req.files.cardImage[0],
      'card-gallery/cards',
      [
        { width: 384, height: 617, crop: 'pad', background: 'transparent', gravity: 'center' }
      ]
    );

    // Upload raw artwork if provided
    let artUpload = null;
    if (req.files?.rawImage) {
      artUpload = await uploadToCloudinary(
        req.files.rawImage[0],
        'card-gallery/artwork',
        [
          { width: 800, crop: 'scale', quality: 'auto:best' }
        ]
      );
    }

    // Save to MongoDB
    const newCard = new Card({
      title: req.body.title,
      subtitle: req.body.subtitle,
      description: req.body.description,
      hpCost: req.body.hpCost,
      spCost: req.body.spCost,
      offsetX: req.body.offsetX,
      offsetY: req.body.offsetY,
      titleFontSize: req.body.titleFontSize,
      titlePositionY: req.body.titlePositionY,
      cardType: req.body.cardType,
      imageScale: req.body.imageScale,
      imageUrl: cardUpload.secure_url,
      fileName: cardUpload.public_id,
      artUrl: artUpload?.secure_url || null,
      artFileName: artUpload?.public_id || null
    });

    await newCard.save();
    res.status(201).json(newCard);

  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ 
      error: 'Upload failed',
      message: err.message
    });
  }
});

// Get all saved cards - No changes needed
app.get('/api/cards', async (req, res) => {
  try {
    const cards = await Card.find().sort({ createdAt: -1 });
    res.json(cards);
  } catch (err) {
    console.error('❌ Fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch cards' });
  }
});

// Get a single card by ID - No changes needed
app.get('/api/cards/:id', async (req, res) => {
  try {
    const card = await Card.findById(req.params.id);
    if (!card) return res.status(404).json({ error: 'Card not found' });
    res.json(card);
  } catch (err) {
    console.error('❌ Fetch one card error:', err);
    res.status(500).json({ error: 'Failed to fetch card' });
  }
});

// Update an existing card - Added null checks for art fields
app.put('/api/cards/:id', upload.fields([
  { name: 'cardImage', maxCount: 1 },
  { name: 'rawImage', maxCount: 1 }
]), async (req, res) => {
  try {
    const card = await Card.findById(req.params.id);
    if (!card) return res.status(404).json({ error: 'Card not found' });

    let updates = {
      title: req.body.title,
      subtitle: req.body.subtitle,
      description: req.body.description,
      hpCost: req.body.hpCost,
      spCost: req.body.spCost,
      offsetX: req.body.offsetX,
      offsetY: req.body.offsetY,
      titleFontSize: req.body.titleFontSize,
      titlePositionY: req.body.titlePositionY,
      cardType: req.body.cardType,
      imageScale: req.body.imageScale,
      // Preserve existing art fields if not updating
      artUrl: card.artUrl || null,
      artFileName: card.artFileName || null
    };

    // Handle raw image update if provided
    if (req.files?.rawImage?.[0]) {
      if (card.artFileName) {
        await cloudinary.uploader.destroy(card.artFileName);
      }

      const artUpload = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          { 
            resource_type: 'auto',
            folder: 'card-gallery' // Add this
          },
          (error, result) => error ? reject(error) : resolve(result)
        );
        
        const bufferStream = new stream.PassThrough();
        bufferStream.end(req.files.rawImage[0].buffer);
        bufferStream.pipe(uploadStream);
      });

      updates.artUrl = artUpload.secure_url;
      updates.artFileName = artUpload.public_id;

      if (req.files.rawImage[0].path) {
        fs.unlinkSync(req.files.rawImage[0].path);
      }
    }

    // Handle card image update if provided
    if (req.files?.cardImage?.[0]) {
      if (card.fileName) {
        await cloudinary.uploader.destroy(card.fileName);
      }

      const cardUpload = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          { resource_type: 'auto' },
          (error, result) => error ? reject(error) : resolve(result)
        );
        
        const bufferStream = new stream.PassThrough();
        bufferStream.end(req.files.cardImage[0].buffer);
        bufferStream.pipe(uploadStream);
      });

      updates.imageUrl = cardUpload.secure_url;
      updates.fileName = cardUpload.public_id;

      if (req.files.cardImage[0].path) {
        fs.unlinkSync(req.files.cardImage[0].path);
      }
    }

    const updatedCard = await Card.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true }
    );

    res.json(updatedCard);
  } catch (err) {
    console.error('❌ Update error:', {
      message: err.message,
      stack: err.stack,
      body: req.body,
      files: req.files
    });
    res.status(500).json({ 
      error: 'Update failed',
      message: err.message 
    });
  }
});

// Delete card
app.delete('/api/cards/:id', async (req, res) => {
  try {
    const card = await Card.findById(req.params.id);
    if (!card) return res.status(404).json({ error: 'Card not found' });

    // Delete images from Cloudinary
    const deletePromises = [];
    if (card.artFileName) {
      deletePromises.push(cloudinary.uploader.destroy(card.artFileName));
    }
    if (card.fileName) {
      deletePromises.push(cloudinary.uploader.destroy(card.fileName));
    }

    await Promise.all(deletePromises);
    await card.deleteOne();

    res.json({ success: true });
  } catch (err) {
    console.error('❌ Delete failed:', err);
    res.status(500).json({ 
      error: 'Delete failed',
      message: err.message 
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));