const express = require('express');
const cors = require('cors');
const { upload, cloudinary } = require('./cloudinary');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Backend is running!');
});

// Upload endpoint
app.get('/api/gallery', async (req, res) => {
  try {
    const result = await cloudinary.search
      .expression('folder:card-gallery')
      .sort_by('created_at', 'desc')
      .max_results(30)
      .execute();

    const images = result.resources.map((file) => ({
      url: file.secure_url,
      fileName: file.public_id
    }));

    res.json(images);
  } catch (err) {
    console.error('Gallery fetch failed', err);
    res.status(500).json({ error: 'Failed to fetch gallery' });
  }
});

// Get gallery images
app.get('/gallery', async (req, res) => {
  try {
    const result = await cloudinary.api.resources({
      type: 'upload',
      prefix: 'card-gallery/'
    });
    
    const images = result.resources.map(resource => ({
      url: resource.secure_url,
      fileName: resource.public_id
    }));
    
    res.json(images);
  } catch (error) {
    console.error('Gallery fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch gallery' });
  }
});

// Delete image
app.delete('/delete', async (req, res) => {
  try {
    const { fileName } = req.query;
    await cloudinary.uploader.destroy(fileName);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Delete failed' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));