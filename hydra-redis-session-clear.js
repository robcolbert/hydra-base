// hydra-redis-session-clear.js
// Copyright (C) 2019 Gab AI, Inc.
// All Rights Reserved

'use strict';

const path = require('path');
const config = require(path.join(__dirname, 'config', 'config'));

const redis = require('redis');

module.deleteKey = (key) => {
  return new Promise((resolve, reject) => {
    module.redis.del(key, (err) => {
      if (err) {
        return reject(err);
      }
      resolve();
    });
  });
};

module.deleteKeys = (keys) => {
  var key = keys.shift();
  if (!key) {
    return Promise.resolve();
  }
  return module
  .deleteKey(key)
  .then(( ) => {
    return module.deleteKeys(keys);
  });
};

module.getRedisSessionKeys = ( ) => {
  return new Promise((resolve, reject) => {
    module.redis.keys('sess:*', (err, reply) => {
      if (err) {
        return reject(err);
      }
      return resolve(reply);
    });
  });
};

module.redis = redis.createClient(config.redis);

module
.getRedisSessionKeys()
.then((keys) => {
  console.log(`deleting ${keys.length} session keys`);
  return module.deleteKeys(keys);
})
.then(( ) => {
  console.log('Hydra Redis sessions cleared.');
  process.exit(0);
})
.catch((error) => {
  console.log('clearRedisSessions error', error);
  process.exit(-1);
});