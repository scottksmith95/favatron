var _ = require('underscore');
var passport = require('passport');
var TwitterStrategy = require('passport-twitter').Strategy;
var PocketStrategy = require('../temp/passport-pocket');
var ReadabilityStrategy = require('passport-readability').Strategy;
var User = require('../models/User');
var secrets = require('./secrets');
var sendgrid = require('sendgrid')(secrets.sendgrid.user, secrets.sendgrid.password);

var signupTemplate = 'Hi %NAME%,<br><br>Great news! <br><br>You have successfully signed up a new account on <a href="https://favatron.com">Favatron</a>. This means you are one signup closer to getting <a href="https://favatron.com">Favatron</a> free for 1 year.<h3>%COUNT% out of 5 signups so far</h3>If you would like to invite more people to join <a href="https://favatron.com">Favatron</a>, here is your referral link for reference:<br><br><a href="%LINK%">%LINK%</a><br><br>Thanks again for your awesome support,<br><br>The Favatron Team<br><br>"Your personal Twitter favorite automaton. Automated tools for people that use favorites to bookmark and read later."<br><br><br><br><div style="text-align: center;"><a href="https://favatron.com">&copy; Favatron 2014</a><br><a href="%UNSUBSCRIBE_LINK%">Stop receiving emails about signups</a></div>';
var bonusTemplate = 'Hi %NAME%,<br><br>Fantastic news! <br><br>You successfully signed up 5 accounts on <a href="https://favatron.com">Favatron</a>. This means you earned <a href="https://favatron.com">Favatron</a> free for 1 year!<br><br><a href="https://favatron.com/auth/twitter">Sign in here with Twitter</a><br><br>Don\'t stop now. Our top referrers will get even more. Keep on sharing the link below:<br><br><a href="%LINK%">%LINK%</a><br><br>We appreciate you taking the time to try out <a href="https://favatron.com">Favatron</a>. If you come across any issues or have suggestions, feel free to contact us anytime. You can reply to this email or contact us via <a href="https://twitter.com/favatron">Twitter</a>.<br><br>Thanks again for your awesome support,<br><br>The Favatron Team<br><br>"Your personal Twitter favorite automaton. Automated tools for people that use favorites to bookmark and read later."<br><br><br><br><div style="text-align: center;"><a href="https://favatron.com">&copy; Favatron 2014</a><br><a href="%UNSUBSCRIBE_LINK%">Stop receiving emails about signups</a></div>';

var sendEmail = function(user, subject, message) {
  sendgrid.send({
    to:       user.email,
    from:     'contact@favatron.com',
    fromname: 'Favatron',
    subject:  subject,
    html:     message
  }, function(err, json) {
    if (err) console.log(err);
  });
};

var sendSignupEmail = function(user, referringUser) {
  var message = signupTemplate
    .replace('%NAME%', referringUser.name)
    .replace('%COUNT%', referringUser.referrals.length)
    .replace('%REFERRED_NAME%', user.name)
    .replace('%LINK%', 'https://favatron.com/?ref=' + referringUser.twitter)
    .replace('%LINK%', 'https://favatron.com/?ref=' + referringUser.twitter)
    .replace('%UNSUBSCRIBE_LINK%', referringUser.unsubscribeSignupLink(referringUser.unsubscribeCode()));

  sendEmail(referringUser, 'Almost there... Favatron free for 1 year', message);
};

var sendBonusEmail = function(referringUser) {
  var message = bonusTemplate
    .replace('%NAME%', referringUser.name)
    .replace('%LINK%', 'https://favatron.com/?ref=' + referringUser.twitter)
    .replace('%LINK%', 'https://favatron.com/?ref=' + referringUser.twitter)
    .replace('%UNSUBSCRIBE_LINK%', referringUser.unsubscribeSignupLink(referringUser.unsubscribeCode()));

  sendEmail(referringUser, 'You\'ve earned Favatron free for 1 year', message);
};

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

passport.use(new TwitterStrategy(secrets.twitter, function(req, accessToken, tokenSecret, profile, done) {
  User.findOne({ twitter: profile.id }, function(err, existingUser) {
    if (existingUser) return done(null, existingUser);

    var user = new User();
    user.created = new Date();
    user.username = profile.id;    
    user.twitter = profile.id;
    user.email = '';
    user.tokens.push({ kind: 'twitter', accessToken: user.encrypt(accessToken), tokenSecret: user.encrypt(tokenSecret) });
    user.name = profile.displayName;
    user.webhook = '';
    user.tour = true;
    user.referring_user = req.cookies.ref || '';

    user.plan.paid = false;
    user.plan.started = new Date();
    user.plan.expires = new Date();
    user.plan.canceled = false;
    user.plan.stripe_customer_id = '';
    user.plan.stripe_subscription_id = '';

    user.save(function(err) {
      if (req.cookies.ref) {
        User.findOne({ twitter: req.cookies.ref}, function(err, referringUser) {
          if (err) {
            console.log(err);
            done(err, user);
          } else if (!referringUser) {
            console.log('Invalid referral code: ' + req.cookies.ref);
            done(err, user);
          } else {
            if (!_.findWhere(referringUser.referrals, user.twitter) && user.twitter !== referringUser.twitter) {
              referringUser.referrals.push(user.twitter);

              if (referringUser.referrals.length < 5) {
                if (referringUser.send_email_signup) {
                  sendSignupEmail(user, referringUser);
                }
              } else if (referringUser.referrals.length === 5) {
                if (!referringUser.plan.paid || !referringUser.isPlanPaid()) {
                  var today = new Date();

                  referringUser.plan.paid = true;
                  referringUser.plan.started = new Date();
                  referringUser.plan.expires = new Date(today.setFullYear(today.getFullYear() + 1)).setDate(today.getDate() + 31);
                  referringUser.plan.canceled = true;
                } else {
                  if (!referringUser.plan.canceled) {
                    //Email me so I can refund on Stripe
                    sendgrid.send({
                      to:       'contact@favatron.com',
                      from:     'contact@favatron.com',
                      fromname: 'Favatron',
                      subject:  'Refund user on Stripe for referrals',
                      text:     'Twitter Id: ' + referringUser.twitter + ', Customer Id: ' + referringUser.plan.stripe_customer_id + ', Subscription Id: ' + referringUser.plan.stripe_subscription_id
                    }, function(err, json) {
                      if (err) console.log(err);
                    });
                  } else {
                    var planDate = referringUser.plan.expires;

                    referringUser.plan.paid = true;
                    referringUser.plan.started = new Date();
                    referringUser.plan.expires = new Date(planDate.setFullYear(planDate.getFullYear() + 1)).setDate(planDate.getDate() + 31);
                    referringUser.plan.canceled = true;
                  }
                }

                sendBonusEmail(referringUser);
              }

              referringUser.save(function(err) {
                if (err) console.log(err);
                done(err, user);
              });
            } else {
              done(err, user);
            }
          }
        });
      } else {
        done(err, user);
      }
    });
  });
}));

function storeToken(user, kind, tokenObject, service, done) {
  if (!_.findWhere(user.tokens, { kind: kind })) {
    user.tokens.push(tokenObject);
  }

  user[service] = true;

  user.save(function(err) {
    done(err, user);
  });
}

//TODO
//Session flow sucks on this package
passport.use(new PocketStrategy(secrets.pocket, function(req, username, accessToken, done) {
  User.findById(req.user._id, function(err, user) {
    storeToken(user, 'pocket', { kind: 'pocket', username: username, accessToken: user.encrypt(accessToken) }, 'pocket', done);
  });
}));

passport.use(new ReadabilityStrategy(secrets.readability, function(req, token, tokenSecret, profile, done) {
  User.findById(req.user._id, function(err, user) {
    storeToken(user, 'readability', { kind: 'readability', accessToken: user.encrypt(token), tokenSecret: user.encrypt(tokenSecret) }, 'readability', done);
  });
}));

exports.isAuthenticated = function(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect('/auth/twitter');
};

exports.isAuthorized = function(req, res, next) {
  var provider = req.path.split('/').slice(-1)[0];

  if (_.findWhere(req.user.tokens, { kind: provider })) {
    next();
  } else {
    res.redirect('/auth/' + provider);
  }
};