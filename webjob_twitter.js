var mongoose = require('mongoose');
var escape = require('escape-html');
var secrets = require('./config/secrets');
var User = require('./models/User');
var Work = require('./models/Work');
var Favorite = require('./models/Favorite');
var async = require('async');
var _ = require('underscore');
var Twit = require('twit');

var logit = function(msg) {
  console.log('Twitter web job:\t' + msg);
};

var processFavorite = function(user, tweet) {
  if (!user.include_no_links && (!tweet.entities || !tweet.entities.urls || tweet.entities.urls.length === 0)) {
    return;
  }

  Favorite.findOne({ 'user_id': user._id, 'source.id': tweet.id_str }, function (err, favorite) {
    if (err) logit(err);

    if (!err && !favorite) {
      Work.findOne({ 'user_id': user._id, 'tweet.id': tweet.id_str }, function (err, currentWork) {
        try {
          if (err) logit(err);

          if (!err && !currentWork) {
            var work = new Work({
              user_id: user._id,
              created: new Date(),
              readabilityDone: user.readability ? false : true,
              pocketDone: user.pocket ? false : true,
              cardiDone: false,
              tweet: {
                id: tweet.id_str,
                site: 'Twitter',
                name: tweet.user.name,
                screen_name: tweet.user.screen_name,
                text: tweet.text,
                urls: (tweet.entities && tweet.entities.urls && tweet.entities.urls.length > 0) ? tweet.entities.urls : [{expanded_url: ''}],
                profile_image_url: tweet.user.profile_image_url_https
              },
              failures: [],
              attempts: 0
            });

            work.save(function(err) {
              if (err) logit(err);
            });
          }
        } catch (e) {
          logit(e);
          return;
        }
      });
    }
  });
};

var processFavorites = function(user, favorites) {
  if (favorites && favorites.length > 0) {
    since_id = favorites[0].id_str;

    for (var i = favorites.length - 1; i >= 0; i--) {
      processFavorite(user, favorites[i]);
    }

    return since_id;
  } else {
    return user.since_id;
  }
};

// Look into streams!
// https://dev.twitter.com/docs/streaming-apis/streams/site
var getFavorites = function(user) {
  return function(callback) {
    try {
      var lastCheckedTimestamp = user.checked_twitter.getTime();
      var currentTimestamp = new Date().getTime();

      if (currentTimestamp - lastCheckedTimestamp < (user.getInterval() * 60 * 1000)) {
        callback(null);
        return;
      }

      logit('Getting favorites for ' + user.username);

      var twitterTokens = _.findWhere(user.tokens, { kind: 'twitter' });

      var twit = new Twit({
        consumer_key: secrets.twitter.consumerKey,
        consumer_secret: secrets.twitter.consumerSecret,
        access_token: user.decrypt(twitterTokens.accessToken),
        access_token_secret: user.decrypt(twitterTokens.tokenSecret)
      });

      twit.get('favorites/list', { include_entities: true, count: 200 }, function(err, favorites) {
        if (err) logit(err);

        var since_id = processFavorites(user, favorites);

        user.since_id = since_id;
        user.checked_twitter = new Date();
        user.save(function(err) {
          if (err) logit(err);

          callback(null);
        });
      });
    } catch (e) {
      logit(e);
      callback(null);
    }
  };
};

var processUsers = function() {
  logit('Running');

  try {
    mongoose.disconnect();
    mongoose.connect(secrets.db);
    mongoose.connection.on('error', function(e) {
      logit(e);
      logit('✗ MongoDB Connection Error. Please make sure MongoDB is running.');
    });

    User.find({}, function(err, users) {
      if (err) logit(err);

      var getFavoritesFuncs = [];

      if (users && users.length > 0) {
        for (var i = 0; i < users.length; i++) {
          getFavoritesFuncs.push(getFavorites(users[i]));
        }
      }

      async.parallelLimit(getFavoritesFuncs, 5, function(err, results) {
        logit('Done');
      });
    });
  } catch (e) {
    logit(e);
  }
};

processUsers();