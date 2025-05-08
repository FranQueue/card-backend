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
  imageUrl: String,
  fileName: String,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Card', cardSchema);