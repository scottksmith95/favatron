var mongoose = require('mongoose');
var secrets = require('./config/secrets');
var pocket = require('./temp/pocket-api');
var User = require('./models/User');
var Work = require('./models/Work');
var Favorite = require('./models/Favorite');
var async = require('async');
var _ = require('underscore');
var urlExpand = require('url-expand');
var cardi = require('cardi');
var readability = require('readability-api');
var request = require('request');

var logit = function(msg) {
  console.log('Process web job:\t' + msg);
};

var readabilityWorker = function(user, url, callback) {
  var tokens = _.findWhere(user.tokens, { kind: 'readability' });

  if (tokens) {
    var reader = new readability.reader({
      access_token: user.decrypt(tokens.accessToken),
      access_token_secret: user.decrypt(tokens.tokenSecret)
    });

    // Add a bookmark - returns the created bookmark
    reader.addBookmark(url, callback);
  } else {
    callback('No tokens supplied', null);
  }
};

var pocketWorker = function(user, url, callback) {
  tokens = _.findWhere(user.tokens, { kind: 'pocket' });

  if (tokens) {
    pocket.addArticles(url, secrets.pocket.consumerKey , user.decrypt(tokens.accessToken), callback);
  } else {
    callback('No tokens supplied', null);
  }
};

var createFavorite = function(url, user, card, work) {
  if (card.title) card.title = card.title.trim();
  if (card.openGraphDescription) card.openGraphDescription = card.openGraphDescription.trim();
  if (card.description) card.description = card.description.trim();
  if (card.twitterDescription) card.twitterDescription = card.twitterDescription.trim();

  var favorite = new Favorite({
    user_id: user._id,
    title: card.title || '',
    description: card.openGraphDescription || card.description || card.twitterDescription || '',
    url: url,
    date: new Date(),
    send_email: user.send_email > 0,
    source: {
      id: work.tweet.id,
      site: work.tweet.site,
      name: work.tweet.name,
      username: work.tweet.screen_name,
      text: work.tweet.text,
      image: work.tweet.profile_image_url
    }
  });

  Favorite.find({ 'user_id': user._id, 'source.id': work.tweet.id }, function (err, favorites) {
    if (err) return err;

    if (favorites.length === 0) {
      favorite.save(function(err) {
        if (err) return err;

        //Webhooks
        if (user.webhook && user.hasWebhooks()) {
          var options = {
            method: 'POST',
            uri: user.webhook,
            json: favorite.distillIt(favorite)
          };

          request(options, function (err, response, body) {
            if (err) logit(err);
          });
        }
      });
    } else {
      logit('Duplicate id: ' + work.tweet.id + ' url: ' + url);
    }
  });
};

var handleError = function(method, description, work, err) {
    logit(method + ': ' + err);

    work.failures.push({
      created: new Date(),
      description: description,
      error: err
    });
    work.save(function(err) {
      if (err) logit(err);
    });
};

var parseTweet = function(url, user, work) {
  return function(callback) {
    //Check to see if we don't have a url
    if (url.length === 0) {
      work.remove(function(err) {
        if (err) logit(err);
      });
      if (user.include_no_links) {
        createFavorite('https://twitter.com/' + work.tweet.screen_name + '/status/' + work.tweet.id, user, {}, work);
      }
      callback(null);
      return;
    }

    //Check to see if we are done with all work
    if (work.readabilityDone && work.pocketDone && work.cardiDone) {
      work.remove(function(err) {
        if (err) logit(err);
      });
      callback(null);
      return;
    }
    
    //Track how many times we try
    work.attempts += 1;
    work.save(function(err) {
      if (err) logit(err);
    });

    //Process URL for work
    urlExpand(url, function (err, fullUrl) {
      if (err) {
        handleError('urlExpand', 'Unable to expand shortened URL.', work, err);

        callback(null);
      } else {
        if (!work.readabilityDone) {
          readabilityWorker(user, fullUrl, function (err, bookmark) {
            if (err) {
              handleError('readabilityWorker', 'Unable to add URL to Readability.', work, err);
            } else {
              work.readabilityDone = true;
              work.save(function(err) {
                if (err) logit(err);
              });
            }
          });
        }

        if (!work.pocketDone) {
          pocketWorker(user, fullUrl, function (err, article) {
            if (err) {
              handleError('pocketWorker', 'Unable to add URL to Pocket.', work, err);
            } else {
              work.pocketDone = true;
              work.save(function(err) {
                if (err) logit(err);
              });
            }
          }); 
        }

        if (!work.cardiDone) {
          cardi.fromUrl(fullUrl, function (err, card) {
            if (err) {
              handleError('cardi.fromUrl', 'Unable to extract URL title, description, and other details.', work, err);

              callback(null);
            } else {
              work.cardiDone = true;
              work.save(function(err) {
                if (err) logit(err);
              });

              var error = createFavorite(fullUrl, user, card, work);
              if (error) {
                handleError('createFavorite', 'Unable to create Favorite.', work, error);
              }

              callback(null);
            }
          });
        } else {
          callback(null);
        }
      }
    });
  };
};

var processFavorites = function(user) {
  return function(callback) {
    Work
      .find({ user_id: user._id })
      .sort([[ 'tweet.id', 'ascending' ]])
      .exec(function(err, works) {
        if (err) {
          logit(err);
          callback(null);
          return;
        }

        var parseTweetFuncs = [];

        for (var i = 0; i < works.length; i++) {
          var urls = works[i].tweet.urls;
          for (var j = 0; j < urls.length; j++) {
            if (works[i].failures.length < 3 && works[i].attempts < 3) {
              parseTweetFuncs.push(parseTweet(urls[j].expanded_url, user, works[i]));
            }
          }
        }

        if (parseTweetFuncs.length > 0) {
          logit('Processing ' + parseTweetFuncs.length + ' favorite urls for ' + user.username);
        }

        async.parallelLimit(parseTweetFuncs, 5, function(err, results) {
          callback(null);
        });
    });
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

    User.find(function(err, users) {
      if (err) logit(err);

      var processFavoritesFuncs = [];

      if (users && users.length > 0) {
        for (var i = 0; i < users.length; i++) {
          processFavoritesFuncs.push(processFavorites(users[i]));
        }
      }

      async.parallelLimit(processFavoritesFuncs, 5, function(err, results) {
        logit('Done');
      });
    });
  } catch (e) {
    logit(e);
  }
};

readability.configure({
  consumer_key: secrets.readability.consumerKey,
  consumer_secret: secrets.readability.consumerSecret
});

processUsers();