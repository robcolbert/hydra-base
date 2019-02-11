// hydra-grant-admin.js
// Copyright (C) 2019 Gab AI, Inc.
// All Rights Reserved

'use strict';

const path = require('path');
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
  const mongoose = require('mongoose');
  module.User = mongoose.model('User');

  if (!process.argv[2] || (typeof process.argv[2] !== 'string')) {
    return Promise.reject(new Error('must specify username'));
  }
  module.hydra.username = process.argv[2].toLowerCase();
  module.log.info('granting admin permissions', {
    username: module.hydra.username
  });

  return module.User
  .findOne({ username_lc: module.hydra.username });
})
.then((user) => {
  if (!user) {
    return Promise.reject(new Error('The specified user was not found.'));
  }
  user.flags.canLogin = true;
  user.flags.canPost = true;
  user.flags.isBanned = false;
  user.flags.isAdmin = true;
  return user.save();
})
.then(( ) => {
  module.log.info(`Administrative rights granted to ${module.hydra.username}.`);
  process.exit(0);
})
.catch((error) => {
  module.log.error('hydra-grant-admin error', { error: error });
  process.exit(-1);
});