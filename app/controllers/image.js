// image.js
// Copyright (C) 2019 Gab AI, Inc.
// License: MIT

'use strict';

const path = require('path');
const fs = require('fs');

const express = require('express');
const router = express.Router();
const multer = require('multer');

const mongoose = require('mongoose');

const HydraImage = mongoose.model('HydraImage');
const HydraError = require('../hydra-error');
const HydraService = require('../hydra-service');

/*
 * HYDRA Service Initialization
 * Service: Image
 */

module.exports = (app, config) => {
  var jobs = [ ];

  module.app = app;
  module.config = config;
  module.service = new HydraService(app, config);
  module.log = app.locals.log;

  module.redis = app.locals.redis;
  jobs.push(module.app.locals.server.createRedisSubscriber('hydra-image', module.onRedisMessage));

  module.log.info('initializing the cache/image directory');
  module.initImageCache();

  module.log.info('starting cache/image file cleaner', {
    imageCleanInterval: module.config.app.cache.imageCleanInterval
  });
  setInterval(
    module.runExpireCacheFiles,
    module.config.app.cache.imageCleanInterval
  );

  module.upload = multer({
    dest: path.join(config.root, 'assets', 'img', 'user')
  });
  module.imageHandler = module.upload.single('image');

  module.log.info('mounting /image endpoint');
  router.post('/:imageId', module.imageHandler, module.updateImage);
  router.post('/', module.imageHandler, module.createImage);
  app.use('/image', router);

  return Promise.all(jobs);
};

/*
 * Service Module Methods
 */

module.updateImage = (req, res, next) => {
  var viewModel = { };
  if (!req.file) {
    return next(new HydraError(406, 'Must upload an image file element.'));
  }
  var file = req.file;
  HydraImage
  .findById(req.params.imageId)
  .then((image) => {
    if (!image) {
      return Promise.reject(new HydraError(404, 'The requested image does not exist.'));
    }
    viewModel.image = image;
    return module.service.readFile(file.path);
  })
  .then((imageData) => {
    viewModel.image.data = imageData;
    viewModel.image.size = imageData.length;
    return viewModel.save();
  })
  .then((image) => {
    viewModel.image = image;
    return module.service.unlinkFile(file.path);
  })
  .then(( ) => {
    module.redis.publish('hydra-image', JSON.stringify({
      event: 'image-update',
      imageId: viewModel.image._id.toString()
    }));
    res.status(200).json(viewModel);
  })
  .catch(next);
};

module.createImage = (req, res, next) => {
  var viewModel = { };
  if (!req.file) {
    return next(new HydraError(406, 'Must upload an image file element.'));
  }
  var file = req.file;
  module.service
  .readFile(file.path)
  .then((imageData) => {
    file.data = imageData;
    return HydraImage.create(file);
  })
  .then((image) => {
    viewModel.image = image;
    return module.service.unlinkFile(file.path);
  })
  .then(( ) => {
    module.redis.publish('hydra-image', JSON.stringify({
      event: 'image-create',
      imageId: viewModel.image._id.toString()
    }));
    res.status(200).json(viewModel);
  })
  .catch(next);
};

/*
 * Redis pub/sub is used across the front-end tier to manage the on-disk image
 * cache that exists per front-end server. Each front-end server keeps a cache
 * of images retrieved from the database to lessen the bandwidth load on the
 * database. As images are updated and deleted during normal system processing,
 * messages are sent to all front-end servers to help them keep their cache
 * contents from becoming stale.
 */
module.onRedisMessage = (channel, message) => {
  message = JSON.parse(message);
  switch (message.event) {
    case 'image-create':
      module.onRedisImageCreate(message);
      break;
    case 'image-update':
      module.onRedisImageUpdate(message);
      break;
    case 'image-delete':
      module.onRedisImageDelete(message);
      break;
    default:
      module.log.error('invalid Redis message', {
        channel: channel,
        message: message
      });
      return;
  }
};

module.onRedisImageCreate = (message) => {
  module.log.debug('onRedisImageCreate', { imageId: message.imageId });
};

module.onRedisImageUpdate = (message) => {
  var filename = module.buildImageCacheFilename(message.imageId);
  module.log.debug('onRedisImageUpdate', { imageId: message.imageId });
  module.service
  .unlinkFile(filename)
  .then(( ) => {
    module.log.debug('image data removed from cache', { imageId: message.imageId });
    return module.service.unlinkFile(`${filename}.json`);
  })
  .then(( ) => {
    module.log.debug('image meta removed from cache', { imageId: message.imageId });
  })
  .catch((error) => {
    module.log.error('onRedisImageUpdate error', { error: error });
  });
};

module.onRedisImageDelete = (message) => {
  var filename = module.buildImageCacheFilename(message.imageId);
  module.log.debug('onRedisImageDelete', { imageId: message.imageId });
  module.service
  .unlinkFile(filename)
  .then(( ) => {
    module.log.debug('image data removed from cache', { imageId: message.imageId });
    return module.service.unlinkFile(`${filename}.json`);
  })
  .then(( ) => {
    module.log.debug('image meta removed from cache', { imageId: message.imageId });
  })
  .catch((error) => {
    if (error.code === 'ENOENT') {
      module.log.debug('image was not in local cache', { imageId: message.imageId });
      return;
    }
    module.log.error('onRedisImageDelete error', { error: error });
  });
};

module.buildImageCacheFilename = (imageId) => {
  return path.join(module.config.root, 'cache', 'image', imageId);
};

module.saveImageToCache = (image) => {
  if (!image) {
    return Promise.resolve(image);
  }
  var filename = module.buildImageCacheFilename(image._id.toString());
  module.log.debug('saveImageToCache', {
    imageId: image._id,
    filename: filename
  });
  return module.service
  .writeFile(filename, image.data)
  .then(( ) => {
    return module.service
    .writeFile(`${filename}.json`, JSON.stringify({
      _id: image._id.toString(),
      created: image.created,
      filename: image.filename,
      mimetype: image.mimetype,
      size: image.size
    }));
  })
  .then(( ) => {
    return Promise.resolve(image);
  });
};

module.loadImage = (imageId) => {
  var filename = module.buildImageCacheFilename(imageId);
  var workingSet = { };
  return module.service
  .readFile(`${filename}.json`)
  .then((fileData) => {
    workingSet.image = JSON.parse(fileData);
    module.log.debug('image cache hit', { imageId: workingSet.image._id });
    return module.service.readFile(filename);
  })
  .then((fileData) => {
    workingSet.image.data = fileData;
    return Promise.resolve(workingSet.image);
  })
  .catch((error) => {
    if (error.code === 'ENOENT') {
      module.log.debug('image cache miss', { imageId: imageId });
    } else {
      module.log.error('loadImage error', { error: error });
    }
    return Promise.resolve(null);
  });
};

module.initImageCache = ( ) => {
  var cacheDir = path.join(module.config.root, 'cache');
  var imageCacheDir = path.join(module.config.root, 'cache', 'image');

  /*
   * Create the cache directory if it does not exist.
   */
  try {
    if (!fs.existsSync(cacheDir)) {
      module.log.debug('creating cache directory');
      fs.mkdirSync(cacheDir);
    } else {
      module.log.debug('cache directory exists');
    }
  } catch (error) {
    module.log.error('initImageCache error', { error: error });
  }

  /*
   * Create the cache/image directory if it does not exist. If the directory
   * does exist, empty it.
   */
  try {
    if (!fs.existsSync(imageCacheDir)) {
      module.log.debug('creating cache/image directory');
      fs.mkdirSync(imageCacheDir);
    } else {
      module.log.debug('cache/image directory exists.');
      var files = fs.readdirSync(imageCacheDir);
      files.forEach((file) => {
        module.log.debug('removing image cache file', { file: file });
        fs.unlinkSync(path.join(imageCacheDir, file));
      });
    }
  } catch (error) {
    module.log.error('initImageCache error', { error: error });
  }
};

module.expireFiles = (files) => {
  var file = files.shift();
  if (!file) {
    return Promise.resolve();
  }

  var filename = path.join(module.config.root, 'cache', 'image', file);
  return module.service
  .statFile(filename)
  .then((stats) => {
    var fileAge = Math.floor(Date.now() - stats.atimeMs);
    if (fileAge < module.config.app.cache.imageMaxAge) {
      return Promise.resolve();
    }
    module.log.debug('expiring cache/image file', { file: file });
    return module.service.unlinkFile(filename);
  })
  .then(( ) => {
    return module.expireFiles(files);
  });
};

module.runExpireCacheFiles = ( ) => {
  var imageCacheDir = path.join(module.config.root, 'cache', 'image');
  return module.service
  .readdir(imageCacheDir)
  .then((files) => {
    return module.expireFiles(files.slice(0));
  })
  .catch((error) => {
    module.log.error('expireImageFiles error', { error: error });
  });
};

/*
 * Service Route Handlers
 */

router.get('/cache-empty', (req, res, next) => {
  module
  .runExpireCacheFiles()
  .then(( ) => {
    res.status(200).json({
      code: 200,
      message: 'Image cache entries expired successfully.'
    });
  })
  .catch(next);
});

router.get('/:imageId', (req, res, next) => {
  if (req.params.imageId === 'undefined') {
    return next(new HydraError(500, 'invalid imageId'));
  }
  module
  .loadImage(req.params.imageId)
  .then((image) => {
    if (image) {
      return Promise.resolve(image);
    }
    return HydraImage
    .findById(req.params.imageId)
    .select('+data')
    .then((image) => {
      if (!image) {
        return Promise.reject(new HydraError(404, 'The requested image does not exist.'));
      }
      return module.saveImageToCache(image);
    });
  })
  .then((image) => {
    if (!image) {
      return Promise.reject(new HydraError(404, 'The requested image does not exist.'));
    }
    res.set('Content-Type', image.mimetype);
    res.set('Content-Length', image.size);
    res.status(200).send(image.data);
  })
  .catch(next);
});