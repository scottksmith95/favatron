var User = require('../models/User');
var Favorite = require('../models/Favorite');
var Api = require('../models/Api');
var Feed = require('feed');
var returnError = require('./utils').returnError;

exports.getFavorites = function(req, res) { 
  User.findOne({ username: req.params.username }, function (err, user) {
    if (err) return returnError('500', err, res);
    if (!user) return returnError('404', 'Invalid username: ' + req.params.username, res);
    if (!user.enable_api) return returnError('404', 'Public API access denied.', res);
    if (!user.hasApi()) return returnError('401', 'Please sign up for the Eternal plan for API access.', res);

    var page = req.query.page || 1;
    var page_size = req.query.page_size || 20;
    var sort = req.query.sort || 'source.id';
    var sort_order = req.query.sort_order || 'descending';

    if (page <= 0) page = 1;
    if (page_size > 200) page_size = 200;
    if (sort_order !== 'descending' || sort_order != 'ascending') sort_order = 'descending';

    Favorite
      .find({ user_id: user._id })
      .sort([[ sort, sort_order ]])
      .skip((page - 1) * page_size)
      .limit(page_size)
      .exec(function (err, favorites) {
        if (err) return returnError('500', err, res);
        
        var favorite = new Favorite();
        var items = favorite.distillIt(favorites);

        Favorite.count({ user_id: user._id }, function (err, count) {
          if (err) return returnError('500', err, res);

          var response = new Api.Response(items, page, page_size, count);

          res.json(response);
        });
      });
  }); 
};

exports.getFavorite = function(req, res) { 
  User.findOne({ username: req.params.username }, function (err, user) {
    if (err) return returnError('500', err, res);
    if (!user) return returnError('404', 'Invalid username: ' + req.params.username, res);
    if (!user.enable_api) return returnError('404', 'Public API access denied.', res);
    if (!user.hasApi()) return returnError('401', 'Please sign up for the Eternal plan for API access.', res);

    Favorite
      .findOne({ user_id: user._id, _id: req.params.id })
      .exec(function (err, favorite) {
        if (err) return returnError('500', err, res);
        if (!favorite) return returnError('404', 'Invalid favorite id: ' + req.params.id, res);
        
        var response = new Api.Response(favorite.distillIt(favorite));
        res.json(response);
      });
  }); 
};

exports.getFavoritesFeed = function(req, res) { 
  User.findOne({ username: req.params.username }, function (err, user) {
    if (err) console.log(err);
    if (!user || !user.enable_feed) {
      res.status('404').end();
      return;
    }

    Favorite
      .find({ user_id: user._id })
      .sort([[ 'source.id', 'descending' ]])
      .limit(20)
      .exec(function (err, favorites) {
        if (err) {
          console.log(err);
          res.status('500').end(err);
        }

        var feed = new Feed({
          title:       user.name + '\'s Favatron Feed',
          description: 'Feed for all the links I favorite on Twitter',
          link:        'http://favatron.com/',
          image:       'http://favatron.com/img/feed-logo.png'
        });

        favorites.forEach(function(favorite) {
          var link = '<a rel="nofollow" href="https://twitter.com/' + favorite.source.username + '/">' + favorite.source.name + ' (' + favorite.source.username + ')</a>';
          var sharedBy = 'Shared by ' + link + ' on ' + favorite.source.site;
          var title = favorite.title || sharedBy;

          var description = '<p>';

          if (favorite.description) 
            description += '<p>' + favorite.description + '</p>';
          
          description += 
            '<p>' + sharedBy + '</p>' + 
            '<p>"' + favorite.source.text + '"</p>' + 
            '</p>';

          feed.addItem({
            title:          title,
            link:           favorite.url,
            description:    description,
            date:           favorite.date
          });
        });

        res.header('Content-Type','text/xml').send(feed.render('atom-1.0'));
      });
  }); 
};