require('dotenv').config();

const multiUpload = upload.fields([
  { name: 'rawImage', maxCount: 1 },
  { name: 'cardImage', maxCount: 1 }
]);

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { upload, cloudinary } = require('./cloudinary');
const Card = require('./models/Card');

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
app.post('/api/upload', multiUpload, async (req, res) => {
  try {
    if (!req.files || !req.files.rawImage) {
      return res.status(400).json({ error: 'No artwork provided' });
    }
  
    const artFile = req.files.rawImage[0]; // User-uploaded artwork
    const cardFile = req.files.cardImage ? req.files.cardImage[0] : null; // Optional: If card render exists
    const card = new Card({
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
  
      // Save URLs and public IDs for both images
      artUrl: artFile.secure_url,
      artFileName: artFile.public_id,
  
      cardUrl: cardFile?.secure_url, // Optional: If card render exists
      cardFileName: cardFile?.public_id,
    });
  
    await card.save();
    res.status(201).json(card);
  } catch (err) {
    console.error('❌ Upload error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Get all saved cards
app.get('/api/cards', async (req, res) => {
  try {
    const cards = await Card.find().sort({ createdAt: -1 });
    res.json(cards);
  } catch (err) {
    console.error('❌ Fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch cards' });
  }
});

// Get a single card by ID (for editing)
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

// Update an existing card (metadata + image, if provided)
app.put('/api/cards/:id', multiUpload, async (req, res) => {
  try {
    const card = await Card.findById(req.params.id);
    if (!card) return res.status(404).json({ error: 'Card not found' });

    let imageUrl = card.imageUrl;
    let fileName = card.fileName;

    if (req.files.rawImage) {
      // Delete old artwork image
      await cloudinary.uploader.destroy(card.artFileName);
      const artFile = req.files.rawImage[0];
      imageUrl = artFile.secure_url;
      fileName = artFile.public_id;
    }
    
    if (req.files.cardImage) {
      // Delete old card image if it exists
      if (card.cardFileName) {
        await cloudinary.uploader.destroy(card.cardFileName);
      }
      const cardFile = req.files.cardImage[0];
      cardUrl = cardFile.secure_url;
      cardFileName = cardFile.public_id;
    }

    // Update metadata regardless of whether there's an image
    const updatedCard = await Card.findByIdAndUpdate(
      req.params.id,
      {
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
        imageUrl,
        fileName,
      },
      { new: true }
    );

    res.json(updatedCard);
  } catch (err) {
    console.error('❌ Update error:', err);
    res.status(500).json({ error: 'Update failed' });
  }
});

// Delete card (from MongoDB and Cloudinary)
app.delete('/api/delete/:id', async (req, res) => {
  try {
    const card = await Card.findById(req.params.id);
    if (!card) return res.status(404).json({ error: 'Card not found' });

    await cloudinary.uploader.destroy(card.artFileName);
if (card.cardFileName) {
  await cloudinary.uploader.destroy(card.cardFileName);
}
    await card.deleteOne();

    res.json({ success: true });
  } catch (err) {
    console.error('❌ Delete failed:', err);
    res.status(500).json({ error: 'Delete failed' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
