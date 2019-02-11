// home.js
// Copyright (C) 2019 Gab AI, Inc.
// All Rights Reserved

'use strict';

const express = require('express');

const mongoose = require('mongoose');
const CommentDomain = mongoose.model('CommentDomain');
const CommentUrl = mongoose.model('CommentUrl');
const Comment = mongoose.model('Comment');

const router = express.Router();
router.use((req, res, next) => {
  res.locals.currentView = 'home';
  return next();
});

const HydraService = require('../hydra-service');

/*
 * HYDRA Service Module Initialization
 * Service: Home
 */

module.exports = (app) => {
  module.app = app;
  module.config = app.locals.config;
  module.log = app.locals.log;
  module.redis = app.locals.redis;
  module.service = new HydraService(module.app, module.config);

  app.use('/', router);
};

 /*
 * Service Route Handlers
 */

router.get('/about', (req, res) => {
  res.header('Cache-Control', 'no-cache');
  res.render('about', { currentView: 'about' });
});

router.get('/extension-view', (req, res, next) => {
  var viewModel = {
    pagination: module.service.getPaginationParameters(req),
    query: req.query
  };
  try {
    viewModel.analyzedUrl = module.service.parseUrl(req.query.url);
  } catch (error) {
    return next(error);
  }

  module.log.debug('extension-view', {
    domain: viewModel.analyzedUrl.url.hostname,
    pathname: viewModel.analyzedUrl.url.pathname
  });

  module.service
  .getUrlTitle(req.query.url)
  .then((title) => {
    viewModel.title = title;
    return CommentDomain
    .findOne({ domain: viewModel.analyzedUrl.url.host })
    .lean();
  })
  .then((commentDomain) => {
    viewModel.commentDomain = commentDomain;
    if (!commentDomain) {
      return Promise.resolve(null);
    }
    return CommentUrl
    .findOne({
      domain: viewModel.commentDomain._id,
      pathname: viewModel.analyzedUrl.url.pathname
    })
    .select('-content')
    .lean();
  })
  .then((commentUrl) => {
    viewModel.commentUrl = commentUrl;
    if (viewModel.commentUrl) {
      viewModel.commentUrl.domain = viewModel.commentDomain;
    } else {
      return Promise.resolve([ ]);
    }
    return Comment
    .find({
      domain: viewModel.commentDomain._id,
      url: viewModel.commentUrl._id,
      parent: { $exists: false }
    })
    .sort({ created: 1 })
    .skip(viewModel.pagination.skip)
    .populate([
      {
        path: 'domain'
      },
      {
        path: 'url',
        select: '-content'
      },
      {
        path: 'user'
      }
    ])
    .limit(viewModel.pagination.cpp);
  })
  .then((comments) => {
    viewModel.comments = comments;
    if (module.service.isSessionJSON(req)) {
      return res.status(200).json(viewModel);
    }
    res.render('extension/index', viewModel);
  })
  .catch(next);
});

router.get('/', (req, res, next) => {
  var viewModel = {
    query: req.query
  };
  Comment
  .find()
  .sort({ created: -1 })
  .limit(5)
  .populate([
    {
      path: 'domain'
    },
    {
      path: 'url',
      select: '-content'
    },
    {
      path: 'user'
    }
  ])
  .lean()
  .then((comments) => {
    viewModel.comments = comments;
    res.render('index', viewModel);
  })
  .catch(next);
});
