// hydra-db-utils.js
// Copyright (C) 2019 Gab AI, Inc.
// All Rights Reserved

'use strict';

module.exports.resetIndexes = (model, log) => {
  return new Promise((resolve, reject) => {
    log.info('dropping indexes', { model: model.modelName });
    model.collection.dropIndexes((err) => {
      if (err) {
        log.error('dropIndexes error', { model: model.modelName, err: err });
        // return reject(err);
      }
      log.info('building indexes', { model: model.modelName });
      model.ensureIndexes((err) => {
        if (err) {
          log.error('ensureIndexes error', { model: model.modelName, err: err });
          return reject(err);
        }
        resolve(model);
      });
    });
  });
};