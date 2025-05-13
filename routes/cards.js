const express = require('express');
const { upload, cloudinary } = require('../cloudinary'); // assuming you export from cloudinary.js
const Card = require('../models/Card'); // adjust path if needed

const router = express.Router();

// CREATE card
router.post('/upload', upload.fields([
  { name: 'cardImage', maxCount: 1 },
  { name: 'rawImage', maxCount: 1 }
]), async (req, res) => {
  try {
    // 1. Upload FULL CARD IMAGE to Cloudinary
    const cardUpload = await cloudinary.uploader.upload(req.files.cardImage[0].path, {
      folder: 'card-gallery/full-cards',
      transformation: [{ width: 384, height: 617, crop: 'fill', background: 'auto' }]
    });

    // 2. Upload RAW ARTWORK (if exists)
    let artUpload = null;
    if (req.files.rawImage) {
      artUpload = await cloudinary.uploader.upload(req.files.rawImage[0].path, {
        folder: 'card-gallery/artwork'
      });
    }

    // 3. Generate thumbnail URL
    const thumbnailUrl = cardUpload.secure_url.replace('/upload/', '/upload/w_384,h_617,c_fill/');

    // 4. Save to database (USE cardUrl NOT imageUrl)
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
      cardUrl: cardUpload.secure_url,       // Changed from imageUrl
      cardFileName: cardUpload.public_id,   // Changed from fileName
      artUrl: artUpload?.secure_url || null,
      artFileName: artUpload?.public_id || null,
      thumbnailUrl
    });

    await card.save();
    res.status(201).json(card);
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// GET all cards
router.get('/cards', async (req, res) => {
  try {
    const cards = await Card.find().sort({ createdAt: -1 });

    const cardsWithThumbnails = cards.map(card => {
      // Use cardUrl as the primary source for thumbnails
      if (card.cardUrl && !card.thumbnailUrl) {
        card.thumbnailUrl = card.cardUrl.includes('/upload/') 
          ? card.cardUrl.replace('/upload/', '/upload/w_384,h_617,c_fill/')
          : `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/w_200,h_320,c_fill/${card.cardFileName}`;
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
  { name: 'rawImage', maxCount: 1 }
]), async (req, res) => {
  try {
    const card = await Card.findById(req.params.id);
    if (!card) return res.status(404).json({ error: 'Card not found' });

    // Handle raw image update
    if (req.files?.rawImage?.[0]) {
      if (card.artFileName) {
        await cloudinary.uploader.destroy(card.artFileName);
      }
      
      const artUpload = await cloudinary.uploader.upload(req.files.rawImage[0].path, {
        folder: 'card-gallery/artwork'
      });
      
      card.artUrl = artUpload.secure_url;
      card.artFileName = artUpload.public_id;
    }

    // Handle card image update
    if (req.files?.cardImage?.[0]) {
      if (card.cardFileName) {
        await cloudinary.uploader.destroy(card.cardFileName);
      }
      
      const cardUpload = await cloudinary.uploader.upload(req.files.cardImage[0].path, {
        folder: 'card-gallery/full-cards',
        transformation: [{ width: 384, height: 617, crop: 'fill' }]
      });

      card.cardUrl = cardUpload.secure_url;            // Changed from imageUrl
      card.cardFileName = cardUpload.public_id;        // Changed from fileName
      card.thumbnailUrl = cardUpload.secure_url.replace('/upload/', '/upload/w_384,h_617,c_fill/');
    }

    // Update other fields
    const updatableFields = ['title', 'subtitle', 'description', 'hpCost', 'spCost', 
                           'offsetX', 'offsetY', 'titleFontSize', 'titlePositionY', 
                           'cardType', 'imageScale'];
    
    updatableFields.forEach(field => {
      if (req.body[field] !== undefined) {
        card[field] = req.body[field];
      }
    });

    await card.save();
    res.json(card);
  } catch (err) {
    console.error('Update error:', err);
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

router.post('/migrate-thumbnails', async (req, res) => {
  try {
    const cards = await Card.find();
    let updatedCount = 0;

    for (const card of cards) {
      if (card.cardUrl && !card.thumbnailUrl) {
        card.thumbnailUrl = card.cardUrl.includes('/upload/') 
          ? card.cardUrl.replace('/upload/', '/upload/w_384,h_617,c_fill/')
          : `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/w_200,h_320,c_fill/${card.cardFileName}`;
        await card.save();
        updatedCount++;
      }
    }

    res.json({ 
      message: `Updated ${updatedCount} cards`,
      totalCards: cards.length 
    });
  } catch (err) {
    res.status(500).json({ error: 'Migration failed' });
  }
});

module.exports = router;
