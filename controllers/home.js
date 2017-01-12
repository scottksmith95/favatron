var Favorite = require('../models/Favorite');
var Work = require('../models/Work');

exports.index = function(req, res) {
  if (!req.user) {
    res.render('landing');
    return;
  }

  var page = req.query.page || 1;
  var page_size = req.query.page_size || 20;
  var sort = req.query.sort || 'source.id';
  var sort_order = req.query.sort_order || 'descending';

  if (page <= 0) page = 1;
  if (page_size > 200) page_size = 200;
  if (sort_order !== 'descending' || sort_order != 'ascending') sort_order = 'descending';

  var encodeRFC5987ValueChars = function(str) {
    return encodeURIComponent(str)
      .replace(/['()]/g, escape)
      .replace(/\*/g, '%2A');
  };

  var createPromoFavorite = function(user) {
    var favorite = new Favorite({
      user_id: '1234567890',
      title: 'Get Favatron free for 1 year',
      description: 'Want to get Favatron free for 1 year? Simply sign up 5 friends with your referral link. https://favatron.com/?ref=' + user.twitter,
      url: 'https://favatron.com/?ref=' + user.twitter,
      date: new Date(),
      source: {
        id: '123456789',
        site: 'Twitter',
        name: 'Favatron Promos',
        username: 'favatron',
        text: '',
        image: 'https://pbs.twimg.com/profile_images/499220994020491264/gx5bQa6m_normal.png'
      }
    });
    favorite.promotion = true;
    return favorite;
  };

  var getRandomInt = function(min, max) {
    return Math.floor(Math.random() * (max - min)) + min;
  };

  res.locals.twitterReferralLink = encodeRFC5987ValueChars('https://twitter.com/intent/tweet?text=Get your personal Twitter favorite automaton&url=https://favatron.com/?ref=' + req.user.twitter);
  res.locals.facebookReferralLink = encodeRFC5987ValueChars('https://www.facebook.com/share.php?u=https://favatron.com/?ref=' + req.user.twitter);

  Favorite
    .find({ user_id: req.user._id })
    .sort([[ sort, sort_order ]])
    .skip((page - 1) * page_size)
    .limit(page_size)
    .exec(function (err, favorites) {
      if (err) console.log(err);

      res.locals.favorites = [];

      //Add promo favorite for referrals
      if (favorites.length > 0 && page === 1 && getRandomInt(1, 6) === 1 && 
        (!req.user.referrals || req.user.referrals.length < 5) &&
        (!req.user.plan || !req.user.plan.paid))
        favorites.unshift(createPromoFavorite(req.user));

      for (var i = 0; i < favorites.length; i++) {
        var favorite = favorites[i];

        var twitter_link = 'https://twitter.com/' + favorite.source.username;
        var tweet_link = twitter_link + '/status/' + favorite.source.id;
        var sharedBy = 'Shared by ' + favorite.source.name + ' (' + favorite.source.username + ') on ' + favorite.source.site;
        var title = favorite.title || sharedBy;

        var twitterShareLink = encodeRFC5987ValueChars('https://twitter.com/intent/tweet?text=' + encodeRFC5987ValueChars(favorite.title) + '&url=' + encodeRFC5987ValueChars(favorite.url) + '&via=favatron');
        var facebookShareLink = encodeRFC5987ValueChars('https://www.facebook.com/share.php?u=' + encodeRFC5987ValueChars(favorite.url));
        var googleplusShareLink = encodeRFC5987ValueChars('https://plus.google.com/share?url=' + encodeRFC5987ValueChars(favorite.url));
        var linkedinShareLink = encodeRFC5987ValueChars('https://www.linkedin.com/shareArticle?mini=true&title=' + encodeRFC5987ValueChars(favorite.title + ' via Favatron') + '&url=' + encodeRFC5987ValueChars(favorite.url));
        var emailShareLink = 'mailto:?body=' + encodeRFC5987ValueChars(favorite.title + '\n\n' + favorite.description + '\n\n' + favorite.url + '\n\n\n\nGet your own Favatron automaton at https://favatron.com') + '&subject=' + encodeRFC5987ValueChars(req.user.name + ' shared a link with you via Favatron');

        res.locals.favorites.push({
          name: req.user.name,
          title: title,
          description: favorite.description,
          url: favorite.url,
          twitter_url: twitter_link,
          date: favorite.date,
          tweet_link: tweet_link,
          source_text: favorite.source.text,
          source_image: favorite.source.image,
          source_username: favorite.source.username,
          source_name: favorite.source.name,
          twitterShareLink: twitterShareLink,
          facebookShareLink: facebookShareLink,
          googleplusShareLink: googleplusShareLink,
          linkedinShareLink: linkedinShareLink,
          emailShareLink: emailShareLink,
          promotion: favorite.promotion || false
        });
      }

      res.locals.prev_page = parseInt(page) - 1;
      res.locals.next_page = parseInt(page) + 1;

      res.locals.show_prev = res.locals.prev_page > 0;
      res.locals.show_next = favorites.length >= 20;

      res.render('home', {
        title: 'Home'
      });
    });
};

exports.getUpgrade = function(req, res) {
  res.render('upgrade', {
    title: 'Upgrade'
  });
};