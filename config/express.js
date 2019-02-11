// express.js
// Copyright (C) 2019 Gab AI, Inc.
// All Rights Reserved

'use strict';

const path = require('path');
const express = require('express');
const glob = require('glob');
const fs = require('fs');
const rfs = require('rotating-file-stream');

const favicon = require('serve-favicon');
const logger = require('morgan');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const compress = require('compression');
const methodOverride = require('method-override');

const session = require('express-session');
const RedisSessionStore = require('connect-redis')(session);
const passport = require('passport');

const marked = require('marked');
const moment = require('moment');
const numeral = require('numeral');
const anchorme = require('anchorme').default;
const gabparse = require('gab-parse')( );

const HydraError = require('../app/hydra-error');

module.exports = (app, config) => {
  const env = process.env.NODE_ENV || 'development';
  const log = app.locals.log;
  app.locals.ENV = env;
  app.locals.ENV_DEVELOPMENT = (env === 'development') || (env === 'local');

  app.set('views', config.root + '/app/views');
  app.set('view engine', 'pug');

  app.use(function(req, res, next) {
    res.header('Access-Control-Allow-Credentials', true);
    res.header('Access-Control-Allow-Origin', req.headers.origin);
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.header('Access-Control-Allow-Headers', 'X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept');
    next();
  });

  app.use(favicon(config.root + '/public/img/favicon.ico'));

  var logDirectory = path.join(config.root, 'logs');
  if (!fs.existsSync(logDirectory)) {
    fs.mkdirSync(logDirectory);
  }
  var accessLogStream = rfs('hydra-access.log', {
    size: '25M',
    interval: '1d',
    path: logDirectory,
    compress: 'gzip'
  });
  app.use(logger(app.locals.ENV_DEVELOPMENT ? 'dev' : 'combined', {
    stream: accessLogStream,
    skip: (req, res) => {
      return (req.url === '/') && (res.statusCode < 400);
    }
  }));
  if (app.locals.ENV_DEVELOPMENT) {
    app.use(logger('dev', {
      skip: (req, res) => {
        return (req.url === '/') && (res.statusCode < 400);
      }
    }));
  }

  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(compress());
  app.use(express.static(path.join(config.root, 'public')));
  app.use('/bootstrap', express.static(path.join(config.root, 'node_modules', 'bootstrap', 'dist')));
  app.use('/chart.js', express.static(path.join(config.root, 'node_modules', 'chart.js', 'dist')));
  app.use('/moment', express.static(path.join(config.root, 'node_modules', 'moment', 'min')));
  app.use('/numeral', express.static(path.join(config.root, 'node_modules', 'numeral', 'min')));
  app.use('/jquery', express.static(path.join(config.root, 'node_modules', 'jquery', 'dist')));
  app.use('/popper.js', express.static(path.join(config.root, 'node_modules', 'popper.js', 'dist')));
  app.use('/fontawesome', express.static(path.join(config.root, 'node_modules', '@fortawesome', 'fontawesome-free')));
  app.use(methodOverride());

  app.set('trust proxy', 1);
  log.info('initializing redis session store');
  var sessionStore = new RedisSessionStore(config.redis);
  config.http.session.store = sessionStore;
  config.https.session.store = sessionStore;
  app.use(session(config.http.session));

  log.info('initializting PassportJS');
  app.use(passport.initialize());
  app.use(passport.session());

  app.use((req, res, next) => {
    res.locals.site = config.app;
    res.locals.user = req.user;
    res.locals.numeral = numeral;
    res.locals.moment = moment;
    res.locals.marked = marked;
    res.locals.anchorme = anchorme;
    res.locals.gabparse = gabparse;
    next();
  });

  var controllers = glob.sync(config.root + '/app/controllers/*.js');
  controllers.forEach((controller) => {
    require (controller)(app, config);
  });

  app.use((req, res, next) => {
    var err = new HydraError(404, 'Not Found');
    next(err);
  });

  if (app.locals.ENV_DEVELOPMENT) {
    app.use((err, req, res, next) => { // jshint ignore:line
      var errorCode = err.status || err.statusCode || err.code || 500;
      log.error('hydra error', { error: err });
      res.status(errorCode);
      if (req.session && (req.session.sessionType === 'json')) {
        return res.json({
          code: errorCode,
          message: err.message || 'Internal server error',
          error: err
        });
      }
      res.render('error', {
        message: err.message,
        error: err,
        title: 'error'
      });
    });
  }

  app.use((err, req, res, next) => { // jshint ignore:line
    var errorCode = err.status || err.statusCode || err.code || 500;
    res.status(errorCode);
    if (req.session && (req.session.sessionType === 'json')) {
      return res.json({
        code: errorCode,
        message: err.message || 'Internal server error',
        error: err
      });
    }
    res.render('error', {
      message: err.message,
      error: {},
      title: 'error'
    });
  });

  return app;
};
