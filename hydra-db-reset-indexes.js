// hydra-db-reset-indexes.js
// Copyright (C) 2019 Gab AI, Inc.
// All Rights Reserved

'use strict';

const path = require('path');
const config = require(path.join(__dirname, 'config', 'config'));
const HydraServer = require(path.join(config.root, 'hydra-server'));

module.log = require(path.join(config.root, 'hydra-winston'))(config);
module.server = new HydraServer(config, module.log);

module.server
.connectDatabase()
.then(( ) => {
  return module.server.loadDataModels();
})
.then((models) => {
  module.log.info('resetting all Hydra database indexes...');
  var jobs = [ ];
  models.forEach((model) => {
    jobs.push(model.resetIndexes(module.log));
  });
  return Promise.all(jobs);
})
.then(( ) => {
  module.log.info('Hydra database indexes reset successfully');
  process.exit(0);
})
.catch((error) => {
  console.log('Hydra database processing error', error);
});