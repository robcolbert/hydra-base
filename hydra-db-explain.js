// hydra-db-explain.js
// Copyright (C) 2019 Gab AI, Inc.
// All Rights Reserved

'use strict';

const path = require('path');
const fs = require('fs');
const config = require(path.join(__dirname, 'config', 'config'));

const HydraServer = require(path.join(config.root, 'hydra-server'));

module.log = require(path.join(config.root, 'hydra-winston'))(config);
module.server = new HydraServer(config, module.log);
module.hydra = { };

module.server
.connectDatabase()
.then(( ) => {
  return module.server.loadDataModels();
})
.then(( ) => {
  module.log.info('creating HydraService instance');

  module.mongoose = require('mongoose');
  module.User = module.mongoose.model('User');

  const HydraService = require(path.join(config.root, 'app', 'hydra-service'));
  module.hydra.service = new HydraService(null, config);
})
.then(( ) => {
  var query = module.User.find({ });
  return module.explainQuery(query, 'user-find.json');
})
.then(( ) => {
  module.log.info('HYDRA process done.');
  process.exit(0);
})
.catch((error) => {
  console.log('processing error', error);
});

module.explainQuery = (query, filename) => {
  return query
  .explain('allPlansExecution')
  .then((explanation) => {
    module.log.info(`generating: ${filename}`);
    fs.writeFileSync(filename, JSON.stringify(explanation, null, 2));
  });
};