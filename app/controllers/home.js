// home.js
// Copyright (C) 2019 Gab AI, Inc.
// License: MIT

'use strict';

const path = require('path');
const express = require('express');

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

router.get('/', (req, res, next) => {
  var viewModel = {
    query: req.query
  };
  module.service
  .readFile(path.join(module.config.root, 'README.md'))
  .then((content) => {
    viewModel.content = content.toString('utf-8');
    res.render('index', viewModel);
  })
  .catch(next);
});
