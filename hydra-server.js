// hydra-server.js
// Copyright (C) 2019 Gab AI, Inc.
// All Rights Reserved

(( ) => {
'use strict';

const util = require('util');
const path = require('path');
const fs = require('fs');
const glob = require('glob');

const mongoose = require('mongoose');
mongoose.Promise = global.Promise;

const http = require('http');
const https = require('https');

const express = require('express');
const redis = require('redis');

const HydraIoServer = require('./hydra-io-server');

class HydraServer {

  constructor (config, log) {
    var server = this;
    server.config = config;
    server.log = log;
  }

  connectDatabase ( ) {
    var server = this;
    var config = server.config;
    return new Promise(function (resolve, reject) {
      var connectUri = 'mongodb://';
      if (config.mongodb.user && config.mongodb.password) {
        connectUri += `${config.mongodb.user}:${config.mongodb.password}@`;
      }
      connectUri += `${config.mongodb.host}:${config.mongodb.port}/${config.mongodb.db}`;
      server.log.info('connecting to MongoDB', connectUri);
      mongoose.connect(connectUri, {
        useNewUrlParser: true,
        socketTimeoutMS: 0,
        keepAlive: true,
        reconnectTries: 30,
        poolSize: 10,
        dbName: config.mongodb.db
      });
      server.db = mongoose.connection;
      server.db.on('error', reject);
      server.db.on('open', resolve);
    });
  }

  loadDataModels ( ) {
    var server = this;
    var modelScripts = glob.sync(path.join(server.config.root, 'app', 'models', '*.js'));
    server.models = [ ];
    modelScripts.forEach(function (modelScript) {
      var pathObj = path.parse(modelScript);
      server.log.info('loading data model', { name: pathObj.name });
      server.models.push(require(modelScript));
    });
    return Promise.resolve(server.models);
  }

  createExpressServer ( ) {
    var server = this;
    server.app = express();
    server.app.locals.server = server;
    server.app.locals.config = server.config;
    server.app.locals.log = server.log;
    server.app.locals.crypto = server.crypto;
    server.app.locals.workers = server.workers;
    server.app.locals.ENV_DEVELOPMENT = (process.env.NODE_ENV === 'development') || (process.env.NODE_ENV === 'local');

    /*
     * HYDRA health monitor middleware
     */
    server.app.get('/healthmon', (req, res) => {
      res.status(200).send('OK');
    });

    /*
     * HYDRA system settings middleware
     */
    server.app.use(server.getSettings.bind(server));
    return Promise.resolve(server.app);
  }

  getSettings (req, res, next) {
    var server = this;
    req.hydra = req.hydra || { };

    const HydraService = require(path.join(server.config.root, 'app', 'hydra-service'));
    var service = new HydraService(server.app, server.config);
    service
    .getSystemSettings()
    .then((settings) => {
      // server.log.debug('system settings', settings);
      req.hydra.settings = settings;
      res.locals.settings = settings;
      next();
    })
    .catch(next);
  }

  createRedisClient ( ) {
    var server = this;
    server.log.info('connecting to Redis', {
      host: server.config.redis.host,
      port: server.config.redis.port,
      password: server.config.redis.password ? true : false
    });
    return new Promise((resolve, reject) => {
      server.redis = redis.createClient(server.config.redis);
      if (server.app) {
        server.app.locals.redis = server.redis;
      }
      server.redis.on('ready', ( ) => {
        server.log.info('Redis client ready');
        resolve(server.redis);
      });
      server.redis.on('warning', (err) => {
        server.log.warn('Redis warning', { warning: err });
      });
      server.redis.on('error', (err) => {
        server.log.error('Redis error', { error: err });
        reject(err);
      });
    });
  }

  createRedisSubscriber (channelName, onMessage) {
    var server = this;
    return new Promise((resolve, reject) => {
      var sub = redis.createClient(server.config.redis);
      sub.on('ready', ( ) => {
        server.log.info('subscribing to Redis channel', {
          channel: channelName
        });
        sub.subscribe(channelName);
      });
      sub.on('subscribe', (channel, count) => {
        server.log.info('Redis channel subscribed', {
          channel: channel,
          count: count
        });
        resolve(sub);
      });
      sub.on('warning', (error) => {
        server.log.error('Redis warning', { error: error });
      });
      sub.on('error', (error) => {
        server.log.error('Redis error', { error: error });
        reject(error);
      });
      sub.on('message', onMessage);
    });
  }

  loadControllers ( ) {
    var server = this;
    server.log.info('loading ExpressJS controllers and routes');
    require(path.join(server.config.root, 'config', 'express'))(server.app, server.config);
    return Promise.resolve(server.app);
  }

  bindServers ( ) {
    var server = this;
    var config = server.config;
    var host, error;
    var jobs = [ ];

    if (config.http.enabled) {
      if (config.http.healthMonitor) {
        server.log.info('starting HTTP server for health monitoring service');
        host = express();
        host.get('*', function respondToMonitor (req, res) {
          server.log.debug('health probe', { result: 'OK' });
          res.status(200).end('OK');
        });
        jobs.push(new Promise(function (resolve, reject) {
          host.listen(
            config.http.listen.port,
            config.http.listen.host,
            function onHttpHealthMonitorServiceStarted (err) {
              if (err) {
                return reject(err);
              }
              server.log.info('http health monitor service listening', {
                host: config.http.listen.host,
                port: config.http.listen.port
              });
              resolve();
            }
          );
        }));
      } else if (config.http.redirectToHttps) {
        server.log.info('starting HTTP server for HTTPS redirect service');
        host = express();
        host.get('*', function redirectToHttps (req, res) {
          var newUrl = 'https://' + req.hostname;
          if (config.https.listen.port !== 443) {
            newUrl += ':' + config.https.listen.port.toString();
          }
          newUrl += req.url;
          server.log.info('redirecting to https:', newUrl);
          res.redirect(newUrl);
        });
        jobs.push(new Promise(function (resolve, reject) {
          host.listen(
            config.http.listen.port,
            config.http.listen.host,
            function onHttpRedirectServerStarted (err) {
              if (err) {
                return reject(err);
              }
              server.log.info('http-to-https redirect server listening', {
                host: config.http.listen.host,
                port: config.http.listen.port
              });
              resolve();
            }
          );
        }));
      } else {
        server.log.info('starting HTTP server for insecure application service');
        server.httpServer = http.Server(server.app);

        server.log.info('starting ioserver');
        server.app.locals.io = require('socket.io')(server.httpServer, {
          transports: ['websocket']
        });
        server.app.locals.ioredis = require('socket.io-redis');
        server.app.locals.io.adapter(server.app.locals.ioredis(config.redis));
        server.app.locals.ioserver = new HydraIoServer(server);

        jobs.push(new Promise(function (resolve, reject) {
          server.httpServer.listen(
            server.config.http.listen.port,
            server.config.http.listen.host,
            function (err) {
              if (err) {
                return reject(err);
              }
              server.log.info('http: application server listening', {
                host: config.http.listen.host.toString(),
                port: config.http.listen.port.toString()
              });
              resolve();
            }
          );
        }));

      }
    }

    if (config.https.enabled) {
      server.log.info('https: enabling server');
      if (util.isNullOrUndefined(config.https.key)) {
        error = new Error('config.https.key is undefined with https.enabled');
        server.log.error('SSL error', { error: error });
        throw error;
      }
      if (util.isNullOrUndefined(config.https.cert)) {
        error = new Error('config.https.cert is undefined with https.enabled');
        server.log.error('SSL error', { error: error });
        throw error;
      }

      var httpsOptions = {
        key: fs.readFileSync(config.https.key),
        cert: fs.readFileSync(config.https.cert)
      };

      server.log.info('https: creating server');
      server.httpsServer = https.createServer(httpsOptions, server.app);

      server.log.info('https: starting ioserver');
      server.app.locals.io = require('socket.io')(server.httpsServer, {
        transports: ['websocket']
      });
      server.app.locals.ioredis = require('socket.io-redis');
      server.app.locals.io.adapter(server.app.locals.ioredis(config.redis));
      server.app.locals.ioserver = new HydraIoServer(server);
      server.app.locals.log = server.log;

      jobs.push(new Promise(function (resolve, reject) {
        server.log.info('starting HTTPS server for secure application service');
        server.httpsServer.listen(
          config.https.listen.port,
          config.https.listen.host,
          function onHttpsServerStarted (err) {
            if (err) {
              return reject(err);
            }
            server.log.info('https: application server listening', {
              host: config.https.listen.host.toString(),
              port: config.https.listen.port.toString()
            });
            resolve();
          }
        );
      }));
    }

    return Promise.all(jobs);
  }
}

module.exports = HydraServer;

})();