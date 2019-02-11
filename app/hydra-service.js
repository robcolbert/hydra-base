// hydra-service.js
// Copyright (C) 2019 Gab AI, Inc.
// All Rights Reserved

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const csv = require('csv');

const url = require('url');
const querystring = require('querystring');
const request = require('request-promise-native');

const jsdom = require('jsdom');
const { JSDOM } = jsdom;

const Jimp = require('jimp');

const mongoose = require('mongoose');

const HydraError = require('./hydra-error');

class HydraService {

  constructor (app, config) {
    var self = this;
    self.config = config;
    self.app = app;
    if (self.app) {
      self.log = app.locals.log;
      self.redis = app.locals.redis;
    }
  }

  checkMaintenanceMode (req) {
    if (req.session && (req.session.sessionType !== 'json')) {
      return false;
    }
    if (req.hydra && req.hydra.settings) {
      return req.hydra.settings.maintenanceMode === 'enabled';
    }
    return false;
  }

  isSessionJSON (req) {
    if (req.query.fmt === 'json' || req.get('X-GabNews-AccessToken')) {
      return true;
    }
    return req.session && (req.session.sessionType === 'json');
  }

  isSessionHTML (req) {
    if (req.query.fmt === 'html') {
      return true;
    }
    return req.session && (req.session.sessionType === 'html');
  }

  setSystemSetting (name, value) {
    var service = this;
    var key = 'hydra:settings';
    return new Promise((resolve, reject) => {
      service.app.locals.redis.hset(key, name, value, (err, reply) => {
        if (err) {
          return reject(err);
        }
        return resolve(reply);
      });
    });
  }

  getSystemSetting (name) {
    var service = this;
    var key = 'hydra:settings';
    return new Promise((resolve, reject) => {
      service.app.locals.redis.hget(key, name, (err, reply) => {
        if (err) {
          return reject(err);
        }
        return resolve(reply);
      });
    });
  }

  getSystemSettings ( ) {
    var service = this;
    var key = 'hydra:settings';
    return new Promise((resolve, reject) => {
      service.app.locals.redis.hgetall(key, (err, reply) => {
        if (err) {
          return reject(err);
        }
        return resolve(Object.assign(
          {
            maintenanceMode: 'disabled',
            maintenanceMessage: 'HYDRA is down for maintenance. The system will be back online shortly.',
            clientVersion: '1.0.0',
            upgradeMessage: 'Update required. Please close and reopen the app to upgrade and continue.',
            rssUpdateInterval: 10
          },
          reply || { }
        ));
      });
    });
  }

  maskPassword (salt, password) {
    var self = this;
    const hash = crypto.createHash('sha256');
    hash.update(self.config.passwordSalt);
    hash.update(salt);
    hash.update(password);
    return hash.digest('hex');
  }

  createHash (content, algorithm = 'sha256') {
    const hash = crypto.createHash(algorithm);
    hash.update(content);
    return hash.digest('hex');
  }

  stripPhoneNumber (phoneNumber) {
    const phoneStripRegEx = /[.,\/#!$%\^&\*;:{}=\-_`~()]/g;
    const spaceStripRegEx = / /g;
    return phoneNumber
    .replace(phoneStripRegEx, '')
    .replace(spaceStripRegEx, '');
  }

  getPaginationParameters (req, defaultCpp = 20) {
    var p = req.query.p !== undefined ? parseInt(req.query.p, 10) : 1;
    if (p < 1) {
      p = 1;
    }
    var cpp = req.query.cpp !== undefined ? parseInt(req.query.cpp, 10) : defaultCpp;
    var skip = (p - 1) * cpp;
    return {
      p: p,
      cpp: cpp,
      skip: skip
    };
  }

  isCheckboxChecked (value) {
    return value === true || value === 1 || value === 'on';
  }

  parseUrl (sourceUrl) {
    var response = { sourceUrl: sourceUrl };
    response.url = url.parse(sourceUrl.toLowerCase());
    response.url.query = querystring.parse(response.url.query);
    response.domainName = response.url.hostname.toLowerCase();

    var keys = Object.keys(response.url.query);
    keys.forEach((key) => {
      if (response.url.query[key].startsWith('utm_')) {
        delete response.url.query[key];
      }
    });

    return response;
  }

  getUrlTitle (url) {
    var self = this;
    return self
    .getUrlTitleCache(url)
    .then((title) => {
      if (title) {
        return Promise.resolve(title);
      }
      return request(url)
      .then((response) => {
        var dom = new JSDOM(response);
        var title = dom.window.document.title;
        if (!title || !title.length) {
          title = url;
        }
        return self.setUrlTitleCache(url, title);
      });
    });
  }

  setUrlTitleCache (url, title) {
    var self = this;
    var urlHash = self.createHash(url, 'sha256');
    var cacheKey = `dissent:url:${urlHash}:title`;
    return new Promise((resolve, reject) => {
      self.redis.setex(cacheKey, 60 * 15, title, (err) => {
        if (err) {
          return reject(err);
        }
        return resolve(title);
      });
    });
  }

  getUrlTitleCache (url) {
    var self = this;
    var urlHash = self.createHash(url, 'sha256');
    var cacheKey = `dissent:url:${urlHash}:title`;
    return new Promise((resolve, reject) => {
      self.redis.get(cacheKey, (err, title) => {
        if (err) {
          return reject(err);
        }
        return resolve(title);
      });
    });
  }

  publishWorkerJob (jobDescription) {
    var self = this;
    return new Promise((resolve, reject) => {
      self.redis.publish('hydra-worker', JSON.stringify(jobDescription), (err) => {
        if (err) {
          return reject(err);
        }
        return resolve(jobDescription);
      });
    });
  }

  writeFile (filename, fileData) {
    return new Promise((resolve, reject) => {
      fs.writeFile(filename, fileData, (err) => {
        if (err) {
          return reject(err);
        }
        return resolve(filename);
      });
    });
  }

  statFile (filename) {
    return new Promise((resolve, reject) => {
      fs.stat(filename, (err, stats) => {
        if (err) {
          return reject(err);
        }
        return resolve(stats);
      });
    });
  }

  readFile (filename) {
    return new Promise((resolve, reject) => {
      fs.readFile(filename, (err, fileData) => {
        if (err) {
          return reject(err);
        }
        resolve(fileData);
      });
    });
  }

  unlinkFile (filename) {
    return new Promise((resolve, reject) => {
      fs.unlink(filename, (err) => {
        if (err) {
          return reject(err);
        }
        resolve();
      });
    });
  }

  readdir (pathname) {
    return new Promise((resolve, reject) => {
      fs.readdir(pathname, (err, files) => {
        if (err) {
          return reject(err);
        }
        return resolve(files);
      });
    });
  }

  loadJimpImage (filename) {
    return new Promise((resolve, reject) => {
      Jimp.read(filename, (err, image) => {
        if (err) {
          return reject(err);
        }
        resolve(image);
      });
    });
  }

  processImage (file, options) {
    const HydraImage = mongoose.model('HydraImage');
    var self = this;
    var workingSet = { };
    options = Object.assign({
      width: 144,
      height: 144,
      format: 'png',
      quality: 90
    }, options);
    return self
    .loadJimpImage(file.path)
    .then((jimpImage) => {
      if (options.width !== 0 && options.height !== 0) {
        jimpImage.cover(options.width, options.height);
      }
      jimpImage.quality(options.quality);
      if (options.format === 'png') {
        return self.imageToPNG(jimpImage);
      }
      return self.imageToJPEG(jimpImage);
    })
    .then((imageData) => {
      switch (options.format) {
        case 'png':
          file.mimetype = Jimp.MIME_PNG;
          break;
        case 'jpeg':
          file.mimetype = Jimp.MIME_JPEG;
          break;
        default:
          return Promise.reject(new HydraError(500, 'Invalid image format requested'));
      }
      file.data = imageData;
      file.size = imageData.length;
      return HydraImage.create(file);
    })
    .then((image) => {
      workingSet.image = image;
      return self.unlinkFile(file.path);
    })
    .then(( ) => {
      return Promise.resolve(workingSet.image);
    });
  }

  imageToJPEG (image) {
    return new Promise((resolve, reject) => {
      image
      .getBuffer(Jimp.MIME_JPEG, (err, imageData) => {
        if (err) {
          return reject(err);
        }
        resolve(imageData);
      });
    });
  }

  imageToPNG (image) {
    return new Promise((resolve, reject) => {
      image
      .rgba(false)
      .getBuffer(Jimp.MIME_PNG, (err, imageData) => {
        if (err) {
          return reject(err);
        }
        resolve(imageData);
      });
    });
  }

  readCsvFile (filename) {
    var self = this;
    return self
    .readFile(filename)
    .then((fileData) => {
      return new Promise((resolve, reject) => {
        csv.parse(fileData, { columns: true }, (err, records) => {
          if (err) {
            return reject(err);
          }
          resolve(records);
        });
      });
    });
  }
}

module.exports = HydraService;