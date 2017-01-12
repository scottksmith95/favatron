var mongoose = require('mongoose');
var secrets = require('./config/secrets');
var async = require('async');
var User = require('./models/User');
var Favorite = require('./models/Favorite');

var logit = function(msg) {
  console.log('Cleanup web job:\t' + msg);
};

var removeFavorite = function(favorite) {
  favorite.remove(function(err) {
    if (err) logit(err);
  });
};

var processFavorites = function(user) {
  return function(callback) {
    if (user.isPlanPaid()) {
      callback(null);
    } else {
      var expiredTimestamp = new Date(new Date().getTime() - (1 * 7 * 24 * 60 * 60 * 1000));

      Favorite
        .find({ user_id: user._id, date: { "$lt": expiredTimestamp }})
        .exec(function(err, favorites) {
          if (err) logit(err);

          if (favorites && favorites.length > 0) {
            logit('Deleting ' + favorites.length + ' favorites for ' + user.username);

            for (var i = 0; i < favorites.length; i++) {
              removeFavorite(favorites[i]);
            }
          }

          callback(null);
      });
    }
  };
};

var processUsers = function() {
  User.find(function(err, users) {
    if (err) logit(err);

    var processFavoritesFuncs = [];

    if (users && users.length > 0) {
      for (var i = 0; i < users.length; i++) {
        processFavoritesFuncs.push(processFavorites(users[i]));
      }
    }
  });
};

var doCleanUp = function() {
  logit('Running');

  mongoose.disconnect();
  mongoose.connect(secrets.db);
  mongoose.connection.on('error', function() {
    console.error('✗ MongoDB Connection Error. Please make sure MongoDB is running.');
  });

  processUsers();
};

doCleanUp();