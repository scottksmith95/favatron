var express = require('express');
var cookieParser = require('cookie-parser');
var compress = require('compression');
var session = require('express-session');
var bodyParser = require('body-parser');
var logger = require('morgan');
var errorHandler = require('errorhandler');
var csrf = require('csurf');
var helmet = require('helmet');
var methodOverride = require('method-override');
var expressValidator = require('express-validator');
var connectAssets = require('connect-assets');
var flash = require('express-flash');

var MongoStore = require('connect-mongo')({ session: session });
var path = require('path');
var mongoose = require('mongoose');
var passport = require('passport');
var crypto = require('crypto');

var homeController = require('./controllers/home');
var userController = require('./controllers/user');
var favoriteController = require('./controllers/favorite');
var workController = require('./controllers/work');

var secrets = require('./config/secrets');
var passportConf = require('./config/passport');

var app = express();

var production = process.env.NODE_ENV === 'production';

app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.use(connectAssets({
  paths: ['public/css', 'public/js'],
  helperContext: app.locals
}));
app.use(compress());
if (!production) {
  app.use(logger('dev'));
}

app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(expressValidator());
app.use(function(req, res, next) {
  for (var item in req.body) {
    if (item !== '_csrf') {
      req.sanitize(item).escape();
    }
  }
  next();
});
app.use(methodOverride());
app.use(cookieParser());
if (production) {
  app.set('trust proxy', 1);

  // HACK: Azure doesn't support X-Forwarded-Proto so we add it manually
  app.use(function(req, res, next) {
    if(req.headers['x-arr-ssl'] && !req.headers['x-forwarded-proto']) {
      req.headers['x-forwarded-proto'] = 'https';
    }
    return next();
  });
}

app.use(helmet.xssFilter());
app.use(helmet.xframe('deny'));
app.use(helmet.hsts({
  maxAge: 3600000,
  includeSubdomains: true
}));
app.use(helmet.hidePoweredBy());
app.use(helmet.ienoopen());
app.use(helmet.nosniff());
app.use(helmet.crossdomain());
app.use(express.static(path.join(__dirname, 'public'), { maxAge: 604800000 }));

mongoose.connect(secrets.db, function(err) {
  if (err) {
    console.error('✗ MongoDB connection error');
    console.error(err);

    app.use(function(req, res) {
      var title = '500 Internal Server Error';
      var error= 'We encountered an issue on our end.';

      res.status('500');
      res.render('error', { title: title, error: error });
    });
  } else {
    console.log("✔ MongoDB connected successfully");
  }

  app.use(session({
    secret: secrets.sessionSecret,
    cookie: {
      maxAge: 1209600000,
      httpOnly: true,
      secure: production ? true : false,
      domain: production ? 'favatron.com' : ''
    },
    proxy: production ? true : false,
    resave: true,
    rolling: true,
    saveUninitialized: true,
    store: new MongoStore({
      mongooseConnection: mongoose.connection,
      autoReconnect: true
    })
  }));
  app.use(csrf());
  app.use(passport.initialize());
  app.use(passport.session());
  app.use(function(req, res, next) {
    res.locals.user = req.user;
    res.locals.production = production;
    res.locals.stripe_public_key = secrets.stripe.public_key;

    if (req.user) res.locals._csrf = req.csrfToken();

    if (production && req.user) {
      var intercom_api_secret = 'Sb9fhL9DrLmFI4l0EW8bXr7mx2CZwpSPY8RASf3C';
      res.locals.user_hash = crypto.createHmac('sha256', intercom_api_secret).update(req.user.twitter).digest('hex');
    }

    next();
  });
  app.use(flash());
  app.use(function(req, res, next) {
    // Keep track of previous URL
    if (req.method !== 'GET') return next();
    var path = req.path.split('/')[1];
    if (/(auth|logout)$/i.test(path)) return next();
    req.session.returnTo = req.path;
    next();
  });
  app.use(function(req, res, next) {
    if (req.query.ref) {
      res.cookie('ref', req.query.ref, { maxAge: 86400000, httpOnly: true });
    }
    next();
  });

  app.get('/', homeController.index);
  app.get('/upgrade', passportConf.isAuthenticated, homeController.getUpgrade);
  app.post('/upgrade', passportConf.isAuthenticated, userController.postUpgrade);
  app.post('/downgrade', passportConf.isAuthenticated, userController.postDowngrade);
  app.get('/logout', userController.logout);
  app.get('/account', passportConf.isAuthenticated, userController.getAccount);
  app.get('/account/delete', passportConf.isAuthenticated, userController.getDeleteAccount);
  app.get('/account/tour', passportConf.isAuthenticated, userController.getTour);
  app.get('/account/unlink/:provider', passportConf.isAuthenticated, userController.getOauthUnlink);
  app.post('/account/options', passportConf.isAuthenticated, userController.postUpdateOptions);
  app.post('/account/profile', passportConf.isAuthenticated, userController.postUpdateProfile);
  app.post('/account/delete', passportConf.isAuthenticated, userController.postDeleteAccount);
  app.get('/unsubscribe/:code/:id', userController.getUnsubscribe);
  app.get('/unsubscribesignup/:code/:id', userController.getUnsubscribeSignup);

  app.get('/api/users/:username', userController.getUser);
  app.get('/api/users/:username/favorites', favoriteController.getFavorites);
  app.get('/api/users/:username/favorites/:id', favoriteController.getFavorite);
  app.get('/api/users/:username/feed', favoriteController.getFavoritesFeed);
  app.get('/api/users/:username/queue', workController.getWorks);
  app.get('/api/users/:username/queue/:id', workController.getWork);

  app.get('/auth/twitter', passport.authenticate('twitter'));
  app.get('/auth/twitter/callback', passport.authenticate('twitter', { failureRedirect: '/' }), function(req, res) {
    res.redirect(req.session.returnTo || '/');
  });

  app.get('/auth/pocket', passport.authenticate('pocket'));
  app.get('/auth/pocket/callback', passport.authenticate('pocket', { failureRedirect: '/account' }), function(req, res) {
    res.redirect('/account');
  });
  app.get('/auth/readability', passport.authenticate('readability'));
  app.get('/auth/readability/callback', passport.authenticate('readability', { failureRedirect: '/account' }), function(req, res) {
    res.redirect('/account');
  });

  // 404 error handler
  app.use(function(req, res) {
    res.status(404);
    res.render('error', { title: '404 Not Found', error: 'The page you were looking for doesn\'t exist.' });
  });

  // 500 error handler
  if (!production) {
    app.use(errorHandler());
  } else {
    app.use( function(err, req, res, next) {
      console.log(err);

      var statusCode = err.status || 500;
      var title = '';
      var error = '';

      switch (statusCode) {
        case 400:
          title = '400 Bad Request';
          error= 'The request cannot be fulfilled due to bad syntax.';
          break;
        case 401:
          title = '401 Unauthorized';
          error= 'The request must include authentication.';
          break;
        case 403:
          title = '403 Forbidden';
          error= 'The request is not allowed to be made.';
          break;
        case 500:
          title = '500 Internal Server Error';
          error= 'We encountered an issue on our end.';
          break;
      }

      res.status(statusCode);
      res.render('error', { title: title, error: error });
    });
  }

  app.listen(app.get('port'), function() {
    console.log("✔ Express server listening on port %d in %s mode", app.get('port'), app.get('env'));
  });
});