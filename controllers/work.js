var User = require('../models/User');
var Work = require('../models/Work');
var Api = require('../models/Api');
var distill = require('distill');
var returnError = require('./utils').returnError;

exports.getWorks = function(req, res) { 
  User.findOne({ username: req.params.username }, function (err, user) {
    if (err) return returnError('500', err, res);
    if (!user) return returnError('404', 'Invalid username: ' + req.params.username, res);
    if (!user.enable_api) return returnError('404', 'Public API access denied.', res);
    if (!user.hasApi()) return returnError('401', 'Please sign up for the Eternal plan for API access.', res);

    var page = req.query.page || 1;
    var page_size = req.query.page_size || 20;
    var sort = req.query.sort || 'created';
    var sort_order = req.query.sort_order || 'descending';

    if (page <= 0) page = 1;
    if (page_size > 200) page_size = 200;
    if (sort_order !== 'descending' || sort_order != 'ascending') sort_order = 'descending';

    Work
      .find({ user_id: user._id })
      .sort([[ sort, sort_order ]])
      .skip((page - 1) * page_size)
      .limit(page_size)
      .exec(function (err, works) {
        if (err) return returnError('500', err, res);
        
        var work = new Work();
        var items = work.distillIt(works);

        Work.count({ user_id: user._id }, function (err, count) {
          if (err) return returnError('500', err, res);

          var response = new Api.Response(items, page, page_size, count);

          res.json(response);
        });
      });
  }); 
};

exports.getWork = function(req, res) { 
  User.findOne({ username: req.params.username }, function (err, user) {
    if (err) return returnError('500', err, res);
    if (!user) return returnError('404', 'Invalid username: ' + req.params.username, res);
    if (!user.enable_api) return returnError('404', 'Public API access denied.', res);

    Work
      .findOne({ user_id: user._id, _id: req.params.id })
      .exec(function (err, work) {
        if (err) return returnError('500', err, res);
        if (!work) return returnError('404', 'Invalid queue id: ' + req.params.id, res);
        
        var response = new Api.Response(work.distillIt(work));

        res.json(response);
      });
  }); 
};