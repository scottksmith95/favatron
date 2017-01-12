var mongoose = require('mongoose');
var secrets = require('./config/secrets');
var User = require('./models/User');
var Favorite = require('./models/Favorite');
var async = require('async');
var sendgrid = require('sendgrid')(secrets.sendgrid.user, secrets.sendgrid.password);

var messageTemplate = '<html><body style="background-color: #f9f9f9; color: #333; font-family: Helvetica Neue, Arial, sans-serif; font-size: 120%; line-height: 1.6em; padding: 1em;"><a href="https://favatron.com" style="text-decoration: none; color: #333;"><img src="https://favatron.com/img/logo-trans-128.png" width="48" height="48" style="float: left;margin-right: 7px; border-radius: 24px;"><span style="font-weight: bold; display: block; border-radius: 4px;">Favatron</span><span style="display: block; margin-top: -8px; border-radius: 4px; font-size: .9em; color: #aaa;">Twitter favorite automaton</span></a><h4>Greetings, %NAME%</h4><p>Your Favatron automaton assembled more favorites since %TIMEFRAME%:</p>%FAVORITES%<div><p style="text-align: center;"><a href="https://favatron.com" style="text-decoration: none; margin-right: 20px; color: #333;">&copy; Favatron 2014</a><a href="%UNSUBSCRIBE_LINK%" style="text-decoration: none; color: #333;">Unsubscribe</a></p></div></body></html>';
var favoritesTemplate = '<div style="background-color: white; display: block; padding: 1em 1em 0 1em; margin: 1em 0; border: 1px solid #eee; border-radius: 5px;"><a href="https://twitter.com/%SOURCE_USERNAME%" style="text-decoration: none; color: #333;"><img src="%SOURCE_IMAGE%" style="float: left;margin-right: 7px; border-radius: 24px;" /><span style="font-weight: bold; display: block; border-radius: 4px;">%SOURCE_NAME%</span><span style="display: block; margin-top: -8px; border-radius: 4px; font-size: .9em; color: #aaa;">@%SOURCE_USERNAME%</span></a><p style="font-size: 1.2em; margin-bottom: .5em;"><a href="%URL%" style="text-decoration: none;"">%TITLE%</a></p><p style="font-size: 1.2em; margin-top: 0; margin-top: 0; margin-bottom: .5em; color: #aaa;">%DESCRIPTION%</p><a href="%TWEET_LINK%" style="font-size: 1em; text-decoration: none; color: #aaa;"><p style="font-size: 1em; margin-top: 0;">"%SOURCE_TEXT%" - %SOURCE_USERNAME% on Twitter</p></a></div>';

var logit = function(msg) {
  console.log('Email   web job:\t' + msg);
};

var clearSendFlags = function(favorites) {
  var errHandler = function (err) {
    if (err) logit(err);
  };

  for (var i = 0; i < favorites.length; i++) {
    favorites[i].send_email = false;
    favorites[i].save(errHandler);
  }
};

var updateUser = function(user, callback) {
  user.sent_email = new Date();
  user.save(function (err) {
    if (err) logit(err);
    callback(null);
  });
};

var sendEmail = function(user, subject, message, callback) {
  logit('Sending email to ' + user.username);

  sendgrid.send({
    to:       user.email,
    from:     'contact@favatron.com',
    fromname: 'Favatron',
    subject:  subject,
    html:     message
  }, function(err, json) {
    if (err) logit(err);

    updateUser(user, callback);
  });
};

var createPromoFavorite = function(user) {
  var favorite = new Favorite({
    user_id: '1234567890',
    title: 'Get Favatron free for 1 year',
    description: 'Want to get Favatron free for 1 year? Simply sign up 5 friends with your referral link. https://favatron.com/?ref=' + user.twitter,
    url: 'https://favatron.com/?ref=' + user.twitter,
    date: new Date(),
    source: {
      id: '502925966747127809',
      site: 'Twitter',
      name: 'Favatron Promos',
      username: 'favatron',
      text: 'Get Favatron free for 1 year',
      image: 'https://pbs.twimg.com/profile_images/499220994020491264/gx5bQa6m_normal.png'
    }
  });
  favorite.promotion = true;
  return favorite;
};

var createPlanFavorite = function(user) {
  var favorite = new Favorite({
    user_id: '1234567890',
    title: 'Upgrade to the Eternal plan',
    description: 'Upgrade for greater storage, features, and to help support Favatron!',
    url: 'https://favatron.com/upgrade',
    date: new Date(),
    source: {
      id: '502925966747127809',
      site: 'Twitter',
      name: 'Favatron Promos',
      username: 'favatron',
      text: 'Upgrade to the Eternal plan',
      image: 'https://pbs.twimg.com/profile_images/499220994020491264/gx5bQa6m_normal.png'
    }
  });
  favorite.promotion = true;
  return favorite;
};

var getRandomInt = function(min, max) {
  return Math.floor(Math.random() * (max - min)) + min;
};

var buildMessage = function(user, favorites, timeframe) {
  var message = messageTemplate
    .replace('%NAME%', user.name)
    .replace('%TIMEFRAME%', timeframe)
    .replace('%UNSUBSCRIBE_LINK%', user.unsubscribeLink(user.unsubscribeCode()));

  var favoritesList = '';

  //Add promo favorite for referrals
  if (!user.isPlanPaid()) {
    if (getRandomInt(1, 3) === 1) {
      if (!user.referrals || user.referrals.length < 5) {
        favorites.push(createPromoFavorite(user));
      } else {
        favorites.push(createPlanFavorite(user));  
      }
    } else {
      favorites.push(createPlanFavorite(user));
    }
  }

  for (var i = 0; i < favorites.length; i++) {
    var twitter_link = 'https://twitter.com/' + favorites[i].source.username;
    var tweet_link = twitter_link + '/status/' + favorites[i].source.id;
    var sharedBy = 'Shared by ' + favorites[i].source.name + ' (' + favorites[i].source.username + ') on ' + favorites[i].source.site;
    var title = favorites[i].title || sharedBy;

    favoritesList += favoritesTemplate
      .replace('%SOURCE_IMAGE%', favorites[i].source.image)
      .replace('%SOURCE_NAME%', favorites[i].source.name)
      .replace('%SOURCE_USERNAME%', favorites[i].source.username)
      .replace('%SOURCE_USERNAME%', favorites[i].source.username)
      .replace('%URL%', favorites[i].url)
      .replace('%TITLE%', title)
      .replace('%DESCRIPTION%', favorites[i].description)
      .replace('%SOURCE_TEXT%', favorites[i].source.text)
      .replace('%SOURCE_USERNAME%', favorites[i].source.username)
      .replace('%TWEET_LINK%', tweet_link);
  }

  message = message.replace('%FAVORITES%', favoritesList);

  return message;
};

var processFavorites = function(user, favorites, callback) {
  var lastSentTimestamp = user.sent_email.getTime();
  var currentTimestamp = new Date().getTime();

  if (user.send_email === 1) {
    if (currentTimestamp - lastSentTimestamp < (24 * 60 * 60 * 1000)) {
      callback(null);
      return;
    }

    sendEmail(user, 'Daily Favatron Digest', buildMessage(user, favorites, 'yesterday'), callback);
  } 
  else if (user.send_email === 2) {
    if (currentTimestamp - lastSentTimestamp < (7 * 24 * 60 * 60 * 1000)) {
      callback(null);
      return;
    }

    sendEmail(user, 'Weekly Favatron Digest', buildMessage(user, favorites, 'last week'), callback);
  }

  clearSendFlags(favorites);
};

var processUser = function(user) {
  return function(callback) {
    Favorite
      .find({ user_id: user._id, send_email: true })
      .sort([[ 'tweet.id', 'ascending' ]])
      .exec(function(err, favorites) {
        if (err) logit(err);

        if (favorites && favorites.length > 0) {
          processFavorites(user, favorites, callback);
        } else {
          callback(null);
        }
    });
  };
};

var processUsers =  function() {
  logit('Running');

  mongoose.disconnect();
  mongoose.connect(secrets.db);
  mongoose.connection.on('error', function() {
    console.error('✗ MongoDB Connection Error. Please make sure MongoDB is running.');
  });

  User.find({ send_email: { $gt: 0 }}, function(err, users) {
    if (err) logit(err);

    var processUserFuncs = [];

    if (users && users.length > 0) {
      for (var i = 0; i < users.length; i++) {
        processUserFuncs.push(processUser(users[i]));
      }
    }

    async.parallelLimit(processUserFuncs, 5, function(err, results) {
      setTimeout(processUsers, secrets.webjobs.emailFrequency);
    });
  });
};

processUsers();