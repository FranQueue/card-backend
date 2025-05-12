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
const sharp = require('sharp');

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
  limits: { fileSize: 20 * 1024 * 1024 } // 20MB max
});

const app = express();
app.get('/api/healthcheck', (req, res) => {
  res.status(200).json({ status: 'ok' });
});
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
    // Ensure cardImage exists in the request
    if (!req.files?.cardImage) {
      return res.status(400).json({ error: 'Card image is required' });
    }

    // Get the raw image buffer if it exists
    const cardBuffer = req.files.cardImage[0].buffer;
    const rawBuffer = req.files?.rawImage?.[0]?.buffer || null;

    // Optional: Apply sharp to resize and compress both images before upload

    // Resize and compress the card image
    const compressedCardBuffer = await sharp(cardBuffer)
      .resize({
        width: 384, // Resize to desired dimensions
        height: 617, 
        fit: 'cover', // Crop if necessary
        position: 'center', // Focus crop on center
      })
      .jpeg({ quality: 60 }) // Reduce quality for further compression (optional)
      .toBuffer(); // Get the resulting buffer

    // If rawImage exists, resize and compress it
    let artUpload = null;
    if (rawBuffer) {
      const compressedRawBuffer = await sharp(rawBuffer)
        .resize({
          width: 600, // Resize as needed for the artwork
          height: 600,
          fit: 'cover',
          position: 'center',
        })
        .jpeg({ quality: 60 }) // Optional compression for raw image
        .toBuffer(); // Get the resulting buffer

      // Upload raw image to Cloudinary
      artUpload = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: 'card-gallery/artwork', // Store in 'artwork' folder
            resource_type: 'image',
            format: 'png', // Keep the image in PNG format
            quality: 'auto', // Let Cloudinary optimize quality
          },
          (error, result) => error ? reject(error) : resolve(result)
        );

        const bufferStream = new stream.PassThrough();
        bufferStream.end(compressedRawBuffer); // Pipe the buffer to upload stream
        bufferStream.pipe(uploadStream);
      });
    }

    // Upload the compressed card image to Cloudinary
    const cardUpload = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'card-gallery/cards', // Store in 'cards' folder
          resource_type: 'image',
          format: 'png',
          quality: 'auto', // Let Cloudinary optimize quality
        },
        (error, result) => error ? reject(error) : resolve(result)
      );

      const bufferStream = new stream.PassThrough();
      bufferStream.end(compressedCardBuffer); // Pipe the compressed card buffer
      bufferStream.pipe(uploadStream);
    });

    console.log('Card image uploaded to Cloudinary:', cardUpload.secure_url);

    // Save the card details to MongoDB
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
      // Updated field names:
      cardUrl: cardUpload.secure_url,
      cardFileName: cardUpload.public_id,
      artUrl: artUpload?.secure_url || null,
      artFileName: artUpload?.public_id || null,
      // Add thumbnail generation:
      thumbnailUrl: cardUpload.secure_url.replace('/upload/', '/upload/w_384,h_617,c_fill/')
    });
    

    // Save the new card to MongoDB
    await newCard.save();
    
    // Send the response back
    res.status(201).json({
      success: true,
      card: newCard,
      imageDetails: {
        width: 384,
        height: 617,
        format: 'png'
      }
    });

  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ 
      error: 'Upload failed',
      message: err.message,
      suggestion: 'Please check your image and try again'
    });
  }
});


// Get all saved cards - No changes needed
app.get('/api/cards', async (req, res) => {
  try {
    const cards = await Card.find().sort({ createdAt: -1 });

    const cardsWithThumbnails = cards.map(card => {
      const thumbnailUrl = card.thumbnailUrl || 
        (card.cardUrl ? card.cardUrl.replace('/upload/', '/upload/w_384,h_617,c_fill/') : null);
      
      return {
        ...card.toObject(),
        thumbnailUrl: thumbnailUrl || '/card-example.png'
      };
    });

    res.json(cardsWithThumbnails);
  } catch (err) {
    console.error('Fetch error:', err);
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
      cardUrl: card.cardUrl,
  cardFileName: card.cardFileName,
  artUrl: card.artUrl || null,
  artFileName: card.artFileName || null,
  thumbnailUrl: card.thumbnailUrl || null
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
      if (card.cardFileName) {
        await cloudinary.uploader.destroy(card.cardFileName);
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

      updates.cardUrl = cardUpload.secure_url;
  updates.cardFileName = cardUpload.public_id;
  updates.thumbnailUrl = cardUpload.secure_url.replace('/upload/', '/upload/w_384,h_617,c_fill/');
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
    if (card.cardFileName) {
      deletePromises.push(cloudinary.uploader.destroy(card.cardFileName));
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

// Temporary endpoint to backfill imageUrl for existing cards
app.post('/api/backfill-image-url', async (req, res) => {
  try {
    const cards = await Card.find();

    const updatePromises = cards.map(async (card) => {
      if (!card.imageUrl && card.fileName) {
        const imageUrl = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/${card.fileName}`;
        card.imageUrl = imageUrl;
        await card.save();
      }
    });

    await Promise.all(updatePromises);

    res.status(200).json({ message: 'Backfill completed successfully' });
  } catch (err) {
    console.error('Error during backfill:', err);
    res.status(500).json({ error: 'Backfill failed', message: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));