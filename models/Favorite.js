var mongoose = require('mongoose');
var distill = require('distill');

var favoriteSchema = new mongoose.Schema({
  user_id: { type: String, required: true },
  title: { type: String },
  description: { type: String },
  url: { type: String, required: true },
  date: { type: Date, required: true },
  send_email: { type: Boolean, default: false },
  source: {
    id: { type: String, required: true },
    site: { type: String, required: true },
    name: { type: String, required: true },
    username: { type: String, required: true },
    text: { type: String },
    image: { type: String }
  }
});

favoriteSchema.methods.distillIt = function(favorite) {
  return distill(favorite)
    .field('id', '_id')
    .field('title')
    .field('description')
    .field('url')
    .field('date')
    .field('send_email')
    .field('source')
    .bottle();
};

module.exports = mongoose.model('Favorite', favoriteSchema);