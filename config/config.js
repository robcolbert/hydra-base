// config.js
// Copyright (C) 2019 Gab AI, Inc.
// All Rights Reserved

const path = require('path');
const rootPath = path.normalize(__dirname + '/..');
const env = process.env.NODE_ENV || 'local';

const IMAGE_MAX_AGE = 1000 * 60 * 60 * 24;
const IMAGE_CLEAN_INTERVAL = 1000 * 60 * 60;
const HYDRA_SESSION_DURATION = 1000 * 60 * 60 * 24 * 365;

const HYDRA_APP_NAME = 'Dissenter';
const HYDRA_APP_SLUG = 'dissenter';
const HYDRA_APP_SLOGAN = 'Comment on any URL online';
const HYDRA_APP_DOMAIN = `${HYDRA_APP_SLUG}.openplatform.us`;
const HYDRA_DEV_DOMAIN = `${HYDRA_APP_SLUG}.openplatform.us`;

const HYDRA_HTTP_BIND_IP = process.env.HYDRA_HTTP_BIND_IP || '0.0.0.0';
const HYDRA_HTTP_PORT = process.env.HYDRA_HTTP_PORT ? parseInt(process.env.HYDRA_HTTP_PORT, 10) : 3000;

const HYDRA_HTTPS_BIND_IP = process.env.HYDRA_HTTPS_BIND_IP || '0.0.0.0';
const HYDRA_HTTPS_PORT = process.env.HYDRA_HTTPS_PORT ? parseInt(process.env.HYDRA_HTTPS_PORT, 10) : 3443;

const HYDRA_MONITOR_BIND_IP = process.env.HYDRA_MONITOR_BIND_IP || '0.0.0.0';
const HYDRA_MONITOR_PORT = process.env.HYDRA_MONITOR_PORT ? parseInt(process.env.HYDRA_MONITOR_PORT, 10) : 3002;

const config = {
  local: {
    root: rootPath,
    app: {
      name: HYDRA_APP_NAME,
      slogan: HYDRA_APP_SLOGAN,
      prohibitedNames: ['admin','hydra'],
      logLevel: 'debug',
      cache: {
        imageMaxAge: IMAGE_MAX_AGE,
        imageCleanInterval: IMAGE_CLEAN_INTERVAL
      },
      log: {
        file: `${HYDRA_APP_SLUG}-app`,
        level: 'debug'
      },
      limits: {
        comment: {
          rateMaxCount: 4,
          rateMaxPeriod: 60,
          rateLimitPrefix: 'gab:comment:create:',
          rateLimitStatus: 429,
          rateLimitMessage: 'You are commenting too quickly. Slow down.'
        },
        vote: {
          rateMaxCount: 10,
          rateMaxPeriod: 60,
          rateLimitPrefix: 'gab:comment:vote:',
          rateLimitStatus: 429,
          rateLimitMessage: 'You are voting too quickly. Slow down.'
        }
      }
    },
    worker: {
      postGabs: false,
      maxThreads: 4,
      log: {
        file: `${HYDRA_APP_SLUG}-worker`,
        level: 'debug'
      },
    },
    monitor: {
      bind: HYDRA_MONITOR_BIND_IP,
      port: HYDRA_MONITOR_PORT,
      disks: ['/']
    },
    gab: {
      clientId: process.env.HYDRA_DISSENTER_CLIENT_ID,
      clientSecret: process.env.HYDRA_DISSENTER_CLIENT_SECRET,
      authorizeUri: `http://local.${HYDRA_DEV_DOMAIN}:3000/user/connect/gab`,
      redirectUri: `http://local.${HYDRA_DEV_DOMAIN}:3000/user`
    },
    redis: {
      host: process.env.HYDRA_REDIS_HOST,
      port: process.env.HYDRA_REDIS_PORT,
      password: process.env.HYDRA_REDIS_PASSWORD,
      socket_keepalive: true
    },
    mongodb: {
      host: process.env.HYDRA_MONGODB_HOST || 'localhost',
      port: process.env.HYDRA_MONGODB_PORT || 27017,
      db: `${HYDRA_APP_SLUG}-local`
    },
    http: {
      enabled: true,
      redirectToHttps: false,
      healthMonitor: false,
      listen: {
        host: HYDRA_HTTP_BIND_IP,
        port: HYDRA_HTTP_PORT
      },
      session: {
        name: `session.${HYDRA_APP_SLUG}.local`,
        secret: process.env.HYDRA_HTTP_SESSION_SECRET,
        resave: true,
        saveUninitialized: true,
        cookie: {
          path: '/',
          httpOnly: true,
          secure: false,
          maxAge: HYDRA_SESSION_DURATION
        },
        store: null
      }
    },
    https: {
      enabled: true,
      cert: path.join(rootPath, 'ssl', 'certificate.pem'),
      key: path.join(rootPath, 'ssl', 'key.pem'),
      listen: {
        host: HYDRA_HTTPS_BIND_IP,
        port: HYDRA_HTTPS_PORT
      },
      session: {
        name: `session.${HYDRA_APP_SLUG}.local`,
        secret: process.env.HYDRA_HTTPS_SESSION_SECRET,
        resave: true,
        saveUninitialized: true,
        cookie: {
          domain: `local.${HYDRA_DEV_DOMAIN}`,
          path: '/',
          httpOnly: true,
          secure: true,
          maxAge: HYDRA_SESSION_DURATION
        },
        store: null
      }
    }
  },

  production: {
    root: rootPath,
    app: {
      name: HYDRA_APP_NAME,
      slogan: HYDRA_APP_SLOGAN,
      prohibitedNames: ['admin','hydra'],
      cache: {
        imageMaxAge: IMAGE_MAX_AGE,
        imageCleanInterval: IMAGE_CLEAN_INTERVAL
      },
      log: {
        file: `${HYDRA_APP_SLUG}-app`,
        level: 'info'
      },
      limits: {
        comment: {
          rateMaxCount: 4,
          rateMaxPeriod: 60,
          rateLimitPrefix: 'gab:comment:',
          rateLimitStatus: 429,
          rateLimitMessage: 'You are commenting too quickly. Slow down.'
        },
        vote: {
          rateMaxCount: 10,
          rateMaxPeriod: 60,
          rateLimitPrefix: 'gab:comment:vote:',
          rateLimitStatus: 429,
          rateLimitMessage: 'You are voting too quickly. Slow down.'
        }
      }
    },
    worker: {
      postGabs: true,
      maxThreads: 4,
      log: {
        file: `${HYDRA_APP_SLUG}-worker`,
        level: 'info'
      },
    },
    monitor: {
      bind: HYDRA_MONITOR_BIND_IP,
      port: HYDRA_MONITOR_PORT,
      disks: ['/']
    },
    gab: {
      clientId: process.env.HYDRA_GABCOMMENTS_CLIENT_ID,
      clientSecret: process.env.HYDRA_GABCOMMENTS_CLIENT_SECRET,
      authorizeUri: `http://local.${HYDRA_APP_DOMAIN}:3000/user/connect/gab`,
      redirectUri: `http://local.${HYDRA_APP_DOMAIN}:3000/user`
    },
    redis: {
      host: process.env.HYDRA_REDIS_HOST,
      port: process.env.HYDRA_REDIS_PORT,
      password: process.env.HYDRA_REDIS_PASSWORD,
      socket_keepalive: true
    },
    mongodb: {
      host: process.env.HYDRA_MONGODB_HOST || 'localhost',
      port: process.env.HYDRA_MONGODB_PORT || 27017,
      db: `${HYDRA_APP_SLUG}-production`
    },
    http: {
      enabled: true,
      redirectToHttps: false,
      healthMonitor: false,
      listen: {
        host: HYDRA_HTTP_BIND_IP,
        port: HYDRA_HTTP_PORT
      },
      session: {
        name: `session.${HYDRA_APP_SLUG}`,
        secret: process.env.HYDRA_HTTP_SESSION_SECRET,
        resave: true,
        saveUninitialized: true,
        cookie: {
          domain: `${HYDRA_APP_DOMAIN}`,
          path: '/',
          httpOnly: true,
          secure: false,
          maxAge: HYDRA_SESSION_DURATION
        },
        store: null
      }
    },
    https: {
      enabled: false,
      cert: null,
      key: null,
      listen: {
        host: HYDRA_HTTPS_BIND_IP,
        port: HYDRA_HTTPS_PORT
      },
      session: {
        name: `session.${HYDRA_APP_SLUG}`,
        secret: process.env.HYDRA_HTTPS_SESSION_SECRET,
        resave: true,
        saveUninitialized: true,
        cookie: {
          domain: `${HYDRA_APP_DOMAIN}`,
          path: '/',
          httpOnly: true,
          secure: true,
          maxAge: HYDRA_SESSION_DURATION
        },
        store: null
      }
    }
  }
};

module.exports = config[env];
