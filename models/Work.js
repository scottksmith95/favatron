var mongoose = require('mongoose');
var distill = require('distill');

var workSchema = new mongoose.Schema({
  user_id: { type: String, required: true },
  created: { type: Date, required: true },
  readabilityDone: { type: Boolean, required: true },
  pocketDone: { type: Boolean, required: true },
  cardiDone: { type: Boolean, required: true },
  tweet: {
    id: { type: String, required: true },
    site: { type: String, required: true },
    name: { type: String, required: true },
    screen_name: { type: String, required: true },
    text: { type: String, required: true },
    urls: { type: Array, required: true },
    profile_image_url: { type: String }
  },
  failures: { type: Array, required: false },
  attempts: { type: Number, default: 0 }
});

workSchema.methods.distillIt = function(work) {
  return distill(work)
    .field('id', '_id')
    .field('created')
    .field('readabilityDone')
    .field('pocketDone')
    .field('cardiDone')
    .field('tweet')
    .field('failures')
    .field('attempts')
    .bottle();
};

module.exports = mongoose.model('Work', workSchema);
