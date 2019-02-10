// hydra.js
// Copyright (C) 2019 Gab AI, Inc.
// All Rights Reserved

'use strict';

process.on('unhandledRejection', (error, p) => {
  console.log('Unhandled rejection', {
    error: error,
    promise: p,
    stack: error.stack
  });
});

const config = require('./config/config');
const path = require('path');

const log = require(path.join(config.root, 'hydra-winston'))(config);

/*
 * Always print legal notice to the console and all log files.
 */
log.info('HYDRA Copyright (C) 2019 Gab AI, Inc.');
log.info('License: MIT');

/*
 * Start your engines!
 */
const HydraServer = require(path.join(config.root, 'hydra-server'));
var server = new HydraServer(config, log);
server
.connectDatabase()
.then(( ) => {
  return server.loadDataModels();
})
.then(( ) => {
  return server.createExpressServer();
})
.then(( ) => {
  return server.createRedisClient();
})
.then(( ) => {
  return server.loadControllers();
})
.then(( ) => {
  return server.bindServers();
})
.then(( ) => {
  log.info('HYDRA application node online');
})
.catch((error) => {
  console.log('HYDRA application node start error', error);
});