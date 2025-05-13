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

// Add this helper function
const processArtworkImage = async (buffer) => {
  // First resize while maintaining aspect ratio
  const resized = await sharp(buffer)
    .resize({
      width: 800,
      height: 800,
      fit: 'inside',
      withoutEnlargement: true,
      background: { r: 255, g: 255, b: 255, alpha: 0 }
    })
    .png({ quality: 80 })
    .toBuffer();

  // Get dimensions of resized image
  const { width, height } = await sharp(resized).metadata();

  // Calculate centering offsets
  const offsetX = Math.max(0, Math.floor((800 - width) / 2));
  const offsetY = Math.max(0, Math.floor((800 - height) / 2));

  // Create final image with transparent background
  return sharp({
    create: {
      width: 800,
      height: 800,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
  .composite([{
    input: resized,
    top: offsetY,
    left: offsetX
  }])
  .png()
  .toBuffer();
};

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

    // Process card image (unchanged)
    const highResCardBuffer = await sharp(cardBuffer)
  .resize({
    width: 768,
    height: 1234,
    fit: 'contain',  // Changed from 'cover' to maintain aspect ratio
    background: { r: 0, g: 0, b: 0, alpha: 0 } // Transparent background
  })
  .png({ quality: 90 }) // Changed from JPEG to PNG for transparency
  .toBuffer();

    // Process artwork image with new improved method
    let artUpload = null;
    if (rawBuffer) {
      // Step 1: Resize while maintaining aspect ratio
      const resizedArtBuffer = await sharp(rawBuffer)
        .resize({
          width: 800,
          height: 800,
          fit: 'inside',
          withoutEnlargement: true,
          background: { r: 255, g: 255, b: 255, alpha: 0 }
        })
        .png({ quality: 80 })
        .toBuffer();

      // Step 2: Get dimensions for centering
      const { width, height } = await sharp(resizedArtBuffer).metadata();
      const offsetX = Math.max(0, Math.floor((800 - width) / 2));
      const offsetY = Math.max(0, Math.floor((800 - height) / 2));

      // Step 3: Create final centered image on transparent background
      const finalArtBuffer = await sharp({
        create: {
          width: 800,
          height: 800,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        }
      })
      .composite([{
        input: resizedArtBuffer,
        top: offsetY,
        left: offsetX
      }])
      .png()
      .toBuffer();

      // Upload processed artwork to Cloudinary
      artUpload = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: 'card-gallery/artwork',
            resource_type: 'image',
            format: 'png',
            quality: 'auto:best',
            transformation: [
              { width: 800, height: 800, crop: 'pad', background: 'transparent' }
            ]
          },
          (error, result) => error ? reject(error) : resolve(result)
        );

        const bufferStream = new stream.PassThrough();
        bufferStream.end(finalArtBuffer);
        bufferStream.pipe(uploadStream);
      });
    }

    // Upload card image (unchanged)
    const cardUpload = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'card-gallery/cards',
          resource_type: 'image',
          format: 'png',
          quality: 'auto:best', // Higher quality setting
          transformation: [
            { width: 768, height: 1234, crop: 'limit' } // Ensure dimensions
          ]
        },
        (error, result) => error ? reject(error) : resolve(result)
      );
    
      const bufferStream = new stream.PassThrough();
      bufferStream.end(highResCardBuffer); // Using our new high-res buffer
      bufferStream.pipe(uploadStream);
    });

    // Create and save card document
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
      cardUrl: cardUpload.secure_url,
      cardFileName: cardUpload.public_id,
      artUrl: artUpload?.secure_url || null,
      artFileName: artUpload?.public_id || null,
      thumbnailUrl: cardUpload.secure_url.replace('/upload/', '/upload/w_384,h_617,c_fill/')
    });

    await newCard.save();
    
    res.status(201).json({
      success: true,
      card: newCard,
      imageDetails: {
        width: 768,
        height: 1234,
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
      // Use the thumbnail URL if it exists, otherwise create one from the high-res image
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

      const compressedRawBuffer = await sharp(req.files.rawImage[0].buffer)
    .resize({
      width: 800,
      height: 800,
      fit: 'inside',
      withoutEnlargement: true,
      background: { r: 255, g: 255, b: 255, alpha: 0 }
    })
    .png({ quality: 80, compressionLevel: 9 })
    .toBuffer();

  artUpload = await new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'card-gallery/artwork',
        resource_type: 'image',
        format: 'png',
        quality: 'auto:best',
        transformation: [
          { width: 800, height: 800, crop: 'scale' }
        ]
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
    
      // Process to high resolution
      const highResCardBuffer = await sharp(req.files.cardImage[0].buffer)
        .resize({
          width: 768,
          height: 1234,
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 } // Transparent background
        })
        .png({ quality: 90 })
        .toBuffer();
    
      const cardUpload = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: 'card-gallery/cards',
            resource_type: 'image',
            format: 'png',
            quality: 'auto:best',
            transformation: [
              { width: 768, height: 1234, crop: 'limit' }
            ]
          },
          (error, result) => error ? reject(error) : resolve(result)
        );
    
        const bufferStream = new stream.PassThrough();
        bufferStream.end(highResCardBuffer);
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