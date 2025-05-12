const mongoose = require('mongoose');

const cardSchema = new mongoose.Schema({
  title: String,
  subtitle: String,
  description: String,
  hpCost: String,
  spCost: String,
  offsetX: Number,
  offsetY: Number,
  titleFontSize: Number,
  titlePositionY: Number,
  cardType: String,
  imageScale: Number,

  // Artwork (raw image)
  artUrl: String,
  artFileName: String,

  // Rendered card (final image)
  cardUrl: String,      // Primary field for full card image
  cardFileName: String,

  // System-generated
  thumbnailUrl: String, // Auto-generated thumbnail
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Card', cardSchema);
