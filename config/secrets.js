module.exports = {
  db: process.env.MONGODB || 'mongodb://localhost:27017/favatron',

  stripe: {
    public_key: process.env.STRIPE_PUBLIC_KEY || 'YOUR VALUE HERE FOR LOCAL TESTING',
    private_key: process.env.STRIPE_PRIVATE_KEY || 'YOUR VALUE HERE FOR LOCAL TESTING'
  },

  cryptos: {
    algorithm: 'aes256',
    key: process.env.CRYPTO_KEY || 'YOUR VALUE HERE FOR LOCAL TESTING' 
  },

  webjobs: {
    emailFrequency: process.env.WEBJOBS_EMAIL_FREQ || 5000,
    twitterFrequency: process.env.WEBJOBS_TWITTER_FREQ || 90000,
    processFrequency: process.env.WEBJOBS_PROCESS_FREQ || 10000,
    cleanupFrequency: process.env.WEBJOBS_CLEANUP_FREQ || 5000
  },

  sessionSecret: process.env.SESSION_SECRET || 'YOUR VALUE HERE FOR LOCAL TESTING',

  mongolabKey: process.env.MONGOLAB_KEY || 'YOUR VALUE HERE FOR LOCAL TESTING',

  sendgrid: {
    user: process.env.SENDGRID_USER || 'YOUR VALUE HERE FOR LOCAL TESTING',
    password: process.env.SENDGRID_PASSWORD || 'YOUR VALUE HERE FOR LOCAL TESTING'
  },

  twitter: {
    consumerKey: process.env.TWITTER_KEY || 'YOUR VALUE HERE FOR LOCAL TESTING',
    consumerSecret: process.env.TWITTER_SECRET  || 'YOUR VALUE HERE FOR LOCAL TESTING',
    callbackURL: process.env.TWITTER_CALLBACK || 'http://localhost:3000/auth/twitter/callback',
    passReqToCallback: true
  },

  pocket: {
    consumerKey: process.env.POCKET_KEY || 'YOUR VALUE HERE FOR LOCAL TESTING',
    callbackURL: process.env.POCKET_CALLBACK || 'http://localhost:3000/auth/pocket/callback'
  },

  //This API is now gone. All code, views, etc should be removed for Readability
  readability: {
    consumerKey: process.env.READABILITY_KEY || 'YOUR VALUE HERE FOR LOCAL TESTING',
    consumerSecret: process.env.READABILITY_SECRET || 'YOUR VALUE HERE FOR LOCAL TESTING',
    callbackURL: process.env.READABILITY_CALLBACK || 'http://localhost:3000/auth/readability/callback',
    passReqToCallback: true
  }
};