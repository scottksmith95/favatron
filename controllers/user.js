var _ = require('underscore');
var async = require('async');
var crypto = require('crypto');
var passport = require('passport');
var request = require('request');
var User = require('../models/User');
var Work = require('../models/Work');
var Favorite = require('../models/Favorite');
var Api = require('../models/Api');
var secrets = require('../config/secrets');
var returnError = require('./utils').returnError;
var stripe = require("stripe")(secrets.stripe.private_key);

exports.getUser = function(req, res) { 
  User.findOne({ username: req.params.username }, function (err, user) {
    if (err) return returnError('500', err, res);
    if (!user) return returnError('404', 'Invalid username: ' + req.params.username, res);
    if (!user.enable_api) return returnError('404', 'Public API access denied.', res);
    if (!user.hasApi()) return returnError('401', 'Please sign up for the Eternal plan for API access.', res);

    var response = new Api.Response(user.distillIt(user));

    res.json(response);
  });
};

exports.logout = function(req, res) {
  req.logout();
  req.session.destroy();
  res.redirect('/');
};

exports.getUnsubscribe = function(req, res, next) {
  User.findOne({ _id: req.params.id }, function (err, user) {
    if (err) return next(err);

    if (req.params.code && user && req.params.code === user.unsubscribeCode()) {
      user.send_email = 0;

      user.save(function(err) {
        if (err) return next(err);
        req.flash('success', { msg: 'You have been unsubscribed.' });
        res.redirect('/');
      });
    } else {
      res.redirect('/');
    }
  });
};

exports.getUnsubscribeSignup = function(req, res, next) {
  User.findOne({ _id: req.params.id }, function (err, user) {
    if (err) return next(err);

    if (req.params.code && user && req.params.code === user.unsubscribeCode()) {
      user.send_email_signup = false;

      user.save(function(err) {
        if (err) return next(err);
        req.flash('success', { msg: 'You have been unsubscribed.' });
        res.redirect('/');
      });
    } else {
      res.redirect('/');
    }
  });
};

exports.getAccount = function(req, res) {
  var encodeRFC5987ValueChars = function(str) {
    return encodeURIComponent(str)
      .replace(/['()]/g, escape)
      .replace(/\*/g, '%2A');
  };

  res.locals.twitterReferralLink = encodeRFC5987ValueChars('https://twitter.com/intent/tweet?text=Get your personal Twitter favorite automaton&url=https://favatron.com/?ref=' + req.user.twitter);
  res.locals.facebookReferralLink = encodeRFC5987ValueChars('https://www.facebook.com/share.php?u=https://favatron.com/?ref=' + req.user.twitter);
  
  res.render('account/profile', {
    title: 'Account Management'
  });
};

exports.getTour = function(req, res) {
  User.findById(req.user.id, function(err, user) {
    if (err) return next(err);

    user.tour = false;

    user.save(function(err) {
      if (err) return next(err);
      res.status(200).end();
    });
  });
};

exports.postUpdateOptions = function(req, res, next) {
  User.findById(req.user.id, function(err, user) {
    if (err) return next(err);

    user.include_no_links = req.body.include_no_links || 0;
    user.enable_feed = req.body.enable_feed || 0;
    user.enable_api = req.body.enable_api || 0;
    user.send_email = req.body.send_email;
    user.webhook = req.body.webhook;

    user.save(function(err) {
      if (err) {
        req.flash('errors', { msg: 'Failed to update options information.' });
        console.log(err);
      } else {
        req.flash('success', { msg: 'Options information updated.' });
      }
      res.redirect('/account');
    });
  });
};

exports.postUpdateProfile = function(req, res, next) {
  User.findById(req.user.id, function(err, user) {
    if (err) return next(err);
    user.username = req.body.username || req.user.id;
    user.email = req.body.email || '';
    user.name = req.body.name || '';

    user.save(function(err) {
      if (err) {
        req.flash('errors', { msg: 'That username is already taken.' });
        console.log(err);
      } else {
        req.flash('success', { msg: 'Profile information updated.' });
      }
      res.redirect('/account');
    });
  });
};

exports.postDowngrade = function(req, res, next) {
  User.findById(req.user.id, function(err, user) {
    if (err) return next(err);

    stripe.customers.cancelSubscription(
      user.plan.stripe_customer_id,
      user.plan.stripe_subscription_id,
      function(err, confirmation) {
        if (err) {
          req.flash('errors', { msg: 'Unable to update your profile. Please contact us at contact@favatron.com.' });
          console.log(err);
          res.redirect('/upgrade');
          return;
        }

        user.plan.stripe_subscription_id = '';
        user.plan.canceled = true;

        user.save(function(err) {
          if (err) {
            req.flash('errors', { msg: 'Unable to update your profile. Please contact us at contact@favatron.com.' });
            console.log(err);
          } else {
            req.flash('success', { msg: 'Your subscription has been canceled. You will still benefit from your paid features until your subscription ends.' });
          }
          res.redirect('/account');
        });
      }
    );
  });
};

var handleUpgrade = function (err, customer, req, res, user) {
  if (err) {
    req.flash('errors', { msg: 'Unable to update your profile. Please contact us at contact@favatron.com.' });
    console.log(err);
    res.redirect('/upgrade');
    return;
  }

  var today = new Date();

  user.plan.paid = true;
  user.plan.started = new Date();
  user.plan.expires = new Date(today.setFullYear(today.getFullYear() + 1)).setDate(today.getDate() + 31);
  user.plan.canceled = false;
  user.plan.stripe_customer_id = customer.id;
  user.plan.stripe_subscription_id = customer.subscriptions.data[0].id;

  user.save(function(err) {
    if (err) {
      req.flash('errors', { msg: 'Unable to update your profile. Please contact us at contact@favatron.com.' });
      console.log(err);
    } else {
      req.flash('success', { msg: 'You are now on the Eternal plan. Thank you for your support!' });
    }
    res.redirect('/upgrade');
  });
};

exports.postUpgrade = function(req, res, next) {
  User.findById(req.user.id, function(err, user) {
    if (err) return next(err);

    var options = {
      card: req.body.token_id,
      plan: "Eternal",
      email: req.body.token_email
    };

    if (user.plan.stripe_customer_id) {
      stripe.customers.update(
        user.plan.stripe_customer_id,
        options, 
        function(err, customer) {
          handleUpgrade(err, customer, req, res, user);
        });
    } else {
      stripe.customers.create(
        options, 
        function(err, customer) {
          handleUpgrade(err, customer, req, res, user);
        });
    }
  });
};

exports.getDeleteAccount = function(req, res, next) {
  res.render('account/delete');
};

exports.postDeleteAccount = function(req, res, next) {
  var user_id = req.user.id;

  User.remove({ _id: user_id }, function(err) {
    if (err) {
      console.log(err);
      return next(err);
    }

    Work.remove({ user_id: user_id}, function(err) {
      if (err) console.log(err);
    });

    Favorite.remove({ user_id: user_id}, function(err) {
      if (err) console.log(err);
    });

    req.logout();
    res.redirect('/');
  });
};

exports.getOauthUnlink = function(req, res, next) {
  var provider = req.params.provider;
  User.findById(req.user.id, function(err, user) {
    if (err) return next(err);

    user[provider] = undefined;
    user.tokens = _.reject(user.tokens, function(token) { return token.kind === provider; });

    user.save(function(err) {
      if (err) return next(err);
      res.redirect('/account');
    });
  });
};