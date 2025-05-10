const express = require('express');
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const streamifier = require('streamifier');
const Card = require('../Card'); // Adjust the path if Card.js is elsewhere

const router = express.Router();
const upload = multer();

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});

// Helper to upload buffer to Cloudinary
const uploadToCloudinary = (buffer, folder) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder }, (error, result) => {
      if (result) resolve(result.secure_url);
      else reject(error);
    });
    streamifier.createReadStream(buffer).pipe(stream);
  });
};

// CREATE card route (used in App.jsx's POST /api/upload)
router.post('/upload', upload.fields([
  { name: 'cardImage' },
  { name: 'rawImage' },
]), async (req, res) => {
  try {
    const {
      title, subtitle, description,
      hpCost, spCost, offsetX, offsetY,
      titleFontSize, titlePositionY, cardType, imageScale
    } = req.body;

    const cardBuffer = req.files['cardImage']?.[0]?.buffer;
    const rawBuffer = req.files['rawImage']?.[0]?.buffer;

    let cardUrl = null;
    let artUrl = null;

    if (cardBuffer) cardUrl = await uploadToCloudinary(cardBuffer, 'cards/rendered');
    if (rawBuffer) artUrl = await uploadToCloudinary(rawBuffer, 'cards/raw');

    const card = new Card({
      title, subtitle, description, hpCost, spCost,
      offsetX, offsetY, titleFontSize, titlePositionY,
      cardType, imageScale, cardUrl, artUrl
    });

    await card.save();
    res.json(card);
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET all cards
router.get('/cards', async (req, res) => {
  const cards = await Card.find().sort({ createdAt: -1 });
  res.json(cards);
});

// GET one card
router.get('/cards/:id', async (req, res) => {
  const card = await Card.findById(req.params.id);
  res.json(card);
});

// UPDATE card
router.put('/cards/:id', upload.fields([
  { name: 'cardImage' },
  { name: 'rawImage' },
]), async (req, res) => {
  try {
    const update = { ...req.body };

    const cardBuffer = req.files['cardImage']?.[0]?.buffer;
    const rawBuffer = req.files['rawImage']?.[0]?.buffer;

    if (cardBuffer) update.cardUrl = await uploadToCloudinary(cardBuffer, 'cards/rendered');
    if (rawBuffer) update.artUrl = await uploadToCloudinary(rawBuffer, 'cards/raw');

    const updatedCard = await Card.findByIdAndUpdate(req.params.id, update, { new: true });
    res.json(updatedCard);
  } catch (err) {
    console.error('Update error:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE card
router.delete('/delete/:id', async (req, res) => {
  await Card.findByIdAndDelete(req.params.id);
  res.json({ message: 'Card deleted' });
});

module.exports = router;
