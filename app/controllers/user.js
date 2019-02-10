// user.js
// Copyright (C) 2019 Gab AI, Inc.
// License: MIT

'use strict';

const uuidv4 = require('uuid/v4');
const express = require('express');

const router = express.Router();
router.use((req, res, next) => {
  res.locals.currentView = 'user';
  return next();
});

const passport = require('passport');
const gabapi = require('gab-api');

const mongoose = require('mongoose');
const User = mongoose.model('User');
const GabAccessToken = mongoose.model('GabAccessToken');
const ConnectToken = mongoose.model('ConnectToken');

const HydraService = require('../hydra-service');
const HydraError = require('../hydra-error');

/*
 * HYDRA Service Module Initialization
 * Service: User
 */

module.exports = (app) => {
  module.app = app;
  module.config = app.locals.config;
  module.log = app.locals.log;
  module.redis = app.locals.redis;
  module.service = new HydraService(module.app, module.config);

  passport.serializeUser(module.serializeUser);
  passport.deserializeUser(module.deserializeUser);

  module.gabapi = gabapi({
    clientId: module.config.gab.clientId,
    clientSecret: module.config.gab.clientSecret,
    authorizeUri: module.config.gab.authorizeUri,
    redirectUri: module.config.gab.redirectUri,
    saveUserAccessToken: module.saveUserAccessToken,
    scopes: 'read write-post'
  });  

  router.get('/connect/gab', (req, res, next) => {
    req.session.redirectUri = module.config.gab.redirectUri;
    res.header('Cache-Control', 'no-cache');
    return next();
  }, module.gabapi.authorize);  

  app.use('/user', router);
};  

/*
 * Module Methods
 */

module.saveUserAccessToken = (req, accessToken) => {
  module.log.debug('saveUserAccessToken', accessToken);
  return module.gabapi.client(accessToken.token)
  .getLoggedInUserDetails()
  .then((profile) => {
    return GabAccessToken
    .updateOne(
      { gabUserId: profile.id },
      {
        $set: {
          updated: new Date(Date.now()),
          accessToken: accessToken.token
        }
      },
      { upsert: true }
    )
    .then(( ) => {
      return new Promise((resolve, reject) => {
        profile.accessToken = accessToken;
        req.login(profile, (err) => {
          if (err) {
            return reject(err);
          }
          return resolve(profile);
        });
      });
    });
  });
};

module.serializeUser = (user, done) => {
  user.flags = user.flags || {
    canLogin: true,
    canPost: true,
    isBanned: false,
    isAdmin: false,
    verified: user.hasOwnProperty('verified') ? user.verified : false,
    is_pro: user.hasOwnProperty('is_pro') ? user.is_pro : false,
    is_donor: user.hasOwnProperty('is_donor') ? user.is_donor : false,
    is_investor: user.hasOwnProperty('is_investor') ? user.is_investor : false,
    is_premium: user.hasOwnProperty('is_premium') ? user.is_premium : false,
    is_tippable: user.hasOwnProperty('is_tippable') ? user.is_tippable : false,
    is_private: user.hasOwnProperty('is_private') ? user.is_private : false,
    is_accessible: user.hasOwnProperty('is_accessible') ? user.is_accessible : false,
  };
  module.log.debug('serialize user', { user: user });
  User
  .updateOne(
    { id: user.id },
    {
      $set: {
        name: user.name,
        bio: user.bio,
        username: user.username,
        username_lc: user.username.toLowerCase(),
        cover_url: user.cover_url,
        picture_url: user.picture_url,
        picture_url_full: user.picture_url_full,
        flags: user.flags
      }
    },
    { upsert: true }
  )
  .then(( ) => {
    done(null, user._id || user.id);
  })
  .catch((error) => {
    return done(error);
  });
};

module.deserializeUser = (id, done) => {
  var tls = { };
  User
  .findOne({ id: id })
  .lean()
  .then((user) => {
    if (!user) {
      return Promise.reject(null);
    }
    tls.user = user;
    return GabAccessToken
    .findOne({ gabUserId: id })
    .lean();
  })
  .then((token) => {
    tls.user.token = token;
    done(null, tls.user);
  })
  .catch((error) => {
    return done(error, null);
  });
};

/*
 * Service Route Handlers
 */

router.get('/connect-io', (req, res, next) => {
  if (!req.user) {
    return next(new HydraError(403, 'Must be logged in to join the IO server'));
  }
  ConnectToken
  .create({
    user: req.user._id,
    token: uuidv4()
  })
  .then((token) => {
    res.status(200).json({ token: token.token }); // an ode to South Park
  })
  .catch((error) => {
    res.status(500).json({
      code: error.code || 500,
      message: error.message || 'Internal server error'
    });
  });
});

router.get('/logout', (req, res) => {
  req.logout();
  res.redirect('/');
});

router.get('/auth-check', (req, res) =>{
  var viewModel = { };
  if (req.user) {
    viewModel.isAuthenticated = true;
    viewModel.user = { };
    Object.assign(viewModel.user, req.user);
    delete viewModel.user.token;
  } else {
    viewModel.isAuthenticated = false;
  }
  res.header('Cache-Control', 'no-cache');
  res.status(200).json(viewModel);
});

router.get('/:username', (req, res, next) => {
  var viewModel = { };

  User
  .findOne({ username_lc: req.params.username.toLowerCase() })
  .lean()
  .then((userProfile) => {
    if (!userProfile) {
      return Promise.reject(new HydraError(404, 'That user is not registered here.'));
    }
    viewModel.userProfile = userProfile;
    return module.getUserFeed(req, viewModel.userProfile.username_lc);
  })
  .then((userFeed) => {
    viewModel.userFeed = JSON.parse(userFeed);
    return module.getTopNews();
  })
  .then((topNews) => {
    viewModel.topNews = JSON.parse(topNews);
    res.render('user/profile', viewModel);
  })
  .catch(next);
});

module.getTopNews = ( ) => {
  var cacheKey = 'hydra:top-news';
  return new Promise((resolve, reject) => {
    module.redis.get(cacheKey, (err, content) => {
      if (err) {
        return reject(err);
      }
      return resolve(content);
    })
  });
};

module.getUserFeed = (req, username) => {
  return module
  .getUserFeedCache(username)
  .then((content) => {
    if (content) {
      return Promise.resolve(content);
    }
    var gabclient = module.gabapi.client(req.user.token.accessToken);
    return gabclient
    .getUserFeed(username)
    .then((content) => {
      return module.setUserFeedCache(username, JSON.stringify(content));
    });
  });
};

module.getUserFeedCache = (username) => {
  var cacheKey = `hydra:user:feed:${username}`;
  return new Promise((resolve, reject) => {
    module.redis.get(cacheKey, (err, content) => {
      if (err) {
        return reject(err);
      }
      return resolve(content);
    });
  });
};

module.setUserFeedCache = (username, content) => {
  var cacheKey = `hydra:user:feed:${username}`;
  return new Promise((resolve, reject) => {
    module.redis.setex(cacheKey, 60 * 5, content, (err) => {
      if (err) {
        return reject(err);
      }
      return resolve(content);
    });
  });
};

router.get('/', (req, res, next) => {
  var viewModel = { userProfile: { } };
  Object.assign(viewModel.userProfile, req.user);
  delete viewModel.userProfile.token;
  res.render('user/index', viewModel);
});

