const mongoose = require('mongoose');

const cardSchema = new mongoose.Schema({
  // Content batch / Cloudinary folder selector (used to separate test vs production sets)
  // For older cards created before this field existed, the app treats missing values as "cards".
  folder: { type: String, default: 'cards', index: true },

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
