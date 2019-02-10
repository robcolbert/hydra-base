// hydra-worker-top-news.js
// Copyright (C) 2019 Gab AI, Inc.
// License: MIT

'use strict';

const path = require('path');
const config = require(path.join(__dirname, '..', 'config', 'config'));

const request = require('request-promise-native');

const HydraServer = require(path.join(config.root, 'hydra-server'));

module.log = require(path.join(config.root, 'hydra-winston'))(config);
module.server = new HydraServer(config, module.log);

module.server
.connectDatabase()
.then(( ) => {
  return module.server.loadDataModels();
})
.then(( ) => {
  return module.server.createRedisClient();
})
.then(( ) => {
  module.mongoose = require('mongoose');
  return module.server
  .createRedisSubscriber('hydra-worker', module.onMessage);
})
.then(( ) => {
  module.log.info('Hydra worker online and ready');
  module.updateInterval = setInterval(module.runNewsUpdate, 1000 * 60);
  module.runNewsUpdate();
});

module.onMessage = (channel, message) => {
  message = JSON.parse(message);
  module.log.info('onMessage', {
    channel: channel,
    command: message.command
  });
  switch (message.command) {
  case 'update-news':

    module.onAddFeed(message);
    break;
  }
};

module.runNewsUpdate = ( ) => {
  if (module.isRunningUpdate) {
    module.log.info('news update already in progress');
    return;
  }

  module.isRunningUpdate = true;
  module.log.info('fetching latest Top News from Gab News');

  return request('https://gabnews.com/top-news/?fmt=json')
  .then((content) => {
    return module.setTopNewsCache(content);
  })
  .then(( ) => {
    module.isRunningUpdate = false;
    module.log.info('latest Top News content updated');
  })
  .catch((error) => {
    module.isRunningUpdate = false;
    module.log.error('news update error', { error: error });
  });
};

module.setTopNewsCache = (content) => {
  var cacheKey = 'hydra:top-news';
  return new Promise((resolve, reject) => {
    module.server.redis.set(cacheKey, content, (err) => {
      if (err) {
        return reject(err);
      }
      return resolve(content);
    });
  });
};