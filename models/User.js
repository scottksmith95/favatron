var mongoose = require('mongoose');
var crypto = require('crypto');
var distill = require('distill');
var secrets = require('../config/secrets');

var userSchema = new mongoose.Schema({
  username: { type: String, unique: true, lowercase: true, required: true },
  email: { type: String, lowercase: true },
  name: { type: String, default: '' },
  created: { type: Date, default: new Date() },

  referring_user: { type: String, default: '' },
  referrals: Array,
  send_email_signup: { type: Boolean, default: true },

  tour: { type: Boolean, default: true },

  include_no_links: { type: Boolean, default: false },
  enable_feed: { type: Boolean, default: true },
  enable_api: { type: Boolean, default: true },

  send_email: { type: Number, default: 0 },
  sent_email: { type: Date, default: new Date() },

  webhook: { type: String, default: '' },

  checked_twitter: { type: Date, default: new Date().setHours(-1) },

  twitter: { type: String },
  readability: { type: Boolean, default: false },
  pocket: { type: Boolean, default: false },
  tokens: Array,

  since_id: { type: String, default: '1' },

  plan: {
    paid: { type: Boolean, default: false },

    started: { type: Date, default: null },
    expires: { type: Date, default: null },

    canceled: { type: Boolean, default: false },

    stripe_customer_id: { type: String, default: '' },
    stripe_subscription_id:  { type: String, default: '' }
  }
});

userSchema.methods.isPlanPaid = function() {
  //return this.plan.paid && (!this.plan.expires || this.plan.expires.getTime() >= new Date().getTime());
  return this.plan.paid;
};

userSchema.methods.getExpiration = function() {
  if (this.plan.expires) return new Date(this.plan.expires.setDate(this.plan.expires.getDate() - 31)).toDateString();
  return '\'never\'';
};

userSchema.methods.getInterval = function() {
  if (this.isPlanPaid())
    return 15;
  else 
    return 240;
};

userSchema.methods.hasApi = function() {
  return this.isPlanPaid();
};

userSchema.methods.hasWebhooks = function() {
  return this.isPlanPaid();
};

userSchema.methods.distillIt = function(user) {
  var response = distill(user)
    .field('created')
    .field('username')
    .field('name')
    .field('last_tweet_id', 'since_id')
    .field('include_favorites_without_links', 'include_no_links')
    .field('enable_feed')
    .field('enable_api')
    .field('send_email')
    .field('send_email_signup')
    .field('sent_email')
    .field('checked_twitter')
    .bottle();

  if (!response.send_email || response.send_email === 0) {
    response.send_email = 'No';
  } else if (response.send_email === 1) {
    response.send_email = 'Daily';
  } else {
    response.send_email = 'Weekly';
  }

  return response;
};

userSchema.methods.gravatar = function(size, defaults) {
  if (!size) size = 200;
  if (!defaults) defaults = 'mm';

  if (!this.email) {
    return 'https://gravatar.com/avatar/?s=' + size + '&d=' + defaults;
  }

  var md5 = crypto.createHash('md5').update(this.email);
  return 'https://gravatar.com/avatar/' + md5.digest('hex').toString() + '?s=' + size + '&d=' + defaults;
};

userSchema.methods.encrypt = function(text) {
  var algorithm = secrets.cryptos.algorithm;
  var key = secrets.cryptos.key;

  var cipher = crypto.createCipher(algorithm, key);  
  return cipher.update(text, 'utf8', 'hex') + cipher.final('hex');
};

userSchema.methods.decrypt = function(text) {
  var algorithm = secrets.cryptos.algorithm;
  var key = secrets.cryptos.key;

  var decipher = crypto.createDecipher(algorithm, key);
  return decipher.update(text, 'hex', 'utf8') + decipher.final('utf8');
};

userSchema.methods.unsubscribeCode = function() {
  var md5 = crypto.createHash('md5').update(this._id + this.created.toString());
  return md5.digest('hex').toString();
};

userSchema.methods.unsubscribeLink = function(code) {
  return 'https://favatron.com/unsubscribe/' + code + '/' + this._id;
};

userSchema.methods.unsubscribeSignupLink = function(code) {
  return 'https://favatron.com/unsubscribesignup/' + code + '/' + this._id;
};

module.exports = mongoose.model('User', userSchema);
