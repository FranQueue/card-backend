require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { upload, cloudinary } = require('./cloudinary');
const connectDB = require('./db');
const { ObjectId } = require('mongodb');

const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get('/', (req, res) => {
  res.send('✅ Backend is running!');
});

// Upload endpoint (image + metadata)
app.post('/api/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file || !req.body.meta) {
      return res.status(400).json({ error: 'No image or metadata provided' });
    }

    const db = await connectDB();
    const cards = db.collection('cards');

    const meta = JSON.parse(req.body.meta);
    const doc = {
      ...meta,
      imageUrl: req.file.secure_url,
      public_id: req.file.public_id,
      createdAt: new Date(),
    };

    const result = await cards.insertOne(doc);
    res.json({ ...doc, _id: result.insertedId });
  } catch (err) {
    console.error('❌ Upload error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Get gallery from MongoDB
app.get('/api/gallery', async (req, res) => {
  try {
    const db = await connectDB();
    const cards = db.collection('cards');
    const result = await cards.find({}).sort({ createdAt: -1 }).toArray();
    res.json(result);
  } catch (err) {
    console.error('❌ Gallery fetch error:', err);
    res.status(500).json({ error: 'Failed to load gallery' });
  }
});

// Delete card (from MongoDB and Cloudinary)
app.delete('/api/delete/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const db = await connectDB();
    const cards = db.collection('cards');
    const card = await cards.findOne({ _id: new ObjectId(id) });

    if (!card) return res.status(404).json({ error: 'Card not found' });

    await cloudinary.uploader.destroy(card.public_id);
    await cards.deleteOne({ _id: new ObjectId(id) });

    res.json({ success: true });
  } catch (err) {
    console.error('❌ Delete failed:', err);
    res.status(500).json({ error: 'Delete failed' });
  }
});

// Optional: Direct Cloudinary gallery listing (if you ever need raw image data)
app.get('/gallery', async (req, res) => {
  try {
    const result = await cloudinary.api.resources({
      type: 'upload',
      prefix: 'card-gallery/',
    });

    const images = result.resources.map(resource => ({
      url: resource.secure_url,
      fileName: resource.public_id,
    }));

    res.json(images);
  } catch (error) {
    console.error('❌ Cloudinary gallery error:', error);
    res.status(500).json({ error: 'Failed to fetch Cloudinary images' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
