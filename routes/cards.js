const express = require('express');
const { upload, cloudinary } = require('../cloudinary'); // assuming you export from cloudinary.js
const Card = require('../models/Card'); // adjust path if needed

const router = express.Router();

// CREATE card
router.post('/upload', upload.fields([
  { name: 'cardImage', maxCount: 1 },
  { name: 'rawImage', maxCount: 1 },
]), async (req, res) => {
  try {
    const {
      title, subtitle, description,
      hpCost, spCost, offsetX, offsetY,
      titleFontSize, titlePositionY, cardType, imageScale
    } = req.body;

    // 1. Upload FULL CARD IMAGE to Cloudinary
    const cardUpload = await cloudinary.uploader.upload(req.files.cardImage[0].path, {
      folder: 'card-gallery/full-cards',
      transformation: [
        { width: 384, height: 617, crop: 'fill' }
      ]
    });

    // 2. Upload RAW ARTWORK (if exists)
    let artUpload = null;
    if (req.files.rawImage) {
      artUpload = await cloudinary.uploader.upload(req.files.rawImage[0].path, {
        folder: 'card-gallery/artwork'
      });
    }

    // 3. Generate thumbnail URL (Cloudinary auto-transform)
    const thumbnailUrl = cardUpload.secure_url.replace('/upload/', '/upload/w_200,h_320,c_fill/');

    // 4. Save to database
    const card = new Card({
      title, subtitle, description, hpCost, spCost,
      offsetX, offsetY, titleFontSize, titlePositionY,
      cardType, imageScale,
      cardUrl: cardUpload.secure_url,
      cardFileName: cardUpload.public_id,
      artUrl: artUpload?.secure_url || null,
      artFileName: artUpload?.public_id || null,
      thumbnailUrl // Store the pre-generated thumbnail
    });

    await card.save();
    res.status(201).json(card);
  } catch (err) {
    console.error('❌ Upload error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// GET all cards
router.get('/cards', async (req, res) => {
  try {
    const cards = await Card.find().sort({ createdAt: -1 });

    // Ensure thumbnails exist for all cards
    const cardsWithThumbnails = cards.map(card => {
      // If thumbnail doesn't exist, generate it from cardUrl
      if (!card.thumbnailUrl && card.cardUrl) {
        card.thumbnailUrl = card.cardUrl.replace('/upload/', '/upload/w_200,h_320,c_fill/');
      }
      return card;
    });

    res.json(cardsWithThumbnails);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch cards' });
  }
});

// GET one card
router.get('/cards/:id', async (req, res) => {
  try {
    const card = await Card.findById(req.params.id);
    if (!card) return res.status(404).json({ error: 'Card not found' });
    res.json(card);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch card' });
  }
});

// UPDATE card
router.put('/cards/:id', upload.fields([
  { name: 'cardImage', maxCount: 1 },
  { name: 'rawImage', maxCount: 1 },
]), async (req, res) => {
  try {
    const card = await Card.findById(req.params.id);
    if (!card) return res.status(404).json({ error: 'Card not found' });

    const rawFile = req.files['rawImage']?.[0];
    const cardFile = req.files['cardImage']?.[0];

    if (rawFile) {
      if (card.artFileName) await cloudinary.uploader.destroy(card.artFileName);
      card.artUrl = rawFile.path;
      card.artFileName = rawFile.filename;
    }

    if (cardFile) {
      if (card.cardFileName) await cloudinary.uploader.destroy(card.cardFileName);
      card.cardUrl = cardFile.path;
      card.cardFileName = cardFile.filename;
      card.imageUrl = cardFile.path; // Update imageUrl when cardFile is updated
      card.cardImage = cardFile.path; // Update cardImage for frontend compatibility
      card.thumbnailUrl = cardFile.path.replace('/upload/', '/upload/w_200,h_320,c_fill/'); // Update thumbnailUrl
      console.log('Thumbnail URL during update:', card.thumbnailUrl); // Debug log
    }

    Object.assign(card, {
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
      imageScale: req.body.imageScale
    });

    await card.save();
    res.json(card);
  } catch (err) {
    console.error('❌ Update error:', err);
    res.status(500).json({ error: 'Update failed' });
  }
});

// DELETE card
router.delete('/delete/:id', async (req, res) => {
  try {
    const card = await Card.findById(req.params.id);
    if (!card) return res.status(404).json({ error: 'Card not found' });

    if (card.artFileName) await cloudinary.uploader.destroy(card.artFileName);
    if (card.cardFileName) await cloudinary.uploader.destroy(card.cardFileName);

    await card.deleteOne();
    res.json({ message: 'Card deleted' });
  } catch (err) {
    console.error('❌ Delete error:', err);
    res.status(500).json({ error: 'Delete failed' });
  }
});

module.exports = router;
