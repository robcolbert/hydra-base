// comment.js
// Copyright (C) 2019 Gab AI, Inc.
// All Rights Reserved

'use strict';

const express = require('express');
const expresslimit = require('express-limit').limit;

const mongoose = require('mongoose');

const CommentDomain = mongoose.model('CommentDomain');
const CommentUrl = mongoose.model('CommentUrl');
const Comment = mongoose.model('Comment'); // jshint ignore:line
const CommentVote = mongoose.model('CommentVote');

const router = express.Router();
router.use((req, res, next) => {
  res.locals.currentView = 'comment';
  return next();
});

const HydraError = require('../hydra-error');
const HydraService = require('../hydra-service');

/*
 * HYDRA Service Module Initialization
 * Service: Home
 */

module.exports = (app) => {
  module.app = app;
  module.config = app.locals.config;
  module.log = app.locals.log;
  module.redis = app.locals.redis;
  module.service = new HydraService(module.app, module.config);

  const RedisStore = require('express-limit').RedisStore;
  module.expressLimitStore = new RedisStore(module.redis);

  var commentLimitConfig = {
    max: module.config.app.limits.comment.rateMaxCount,
    period: module.config.app.limits.comment.rateMaxPeriod,
    prefix: module.config.app.limits.comment.rateLimitPrefix,
    status: module.config.app.limits.comment.rateLimitStatus,
    message: module.config.app.limits.comment.rateLimitMessage,
    identifier: (req) => {
      return req.user ? req.user.id : req.ip;
    },
    store: module.expressLimitStore
  };
  router.post('/', expresslimit(commentLimitConfig), module.createComment);

  var voteLimitConfig = {
    max: module.config.app.limits.vote.rateMaxCount,
    period: module.config.app.limits.vote.rateMaxPeriod,
    prefix: module.config.app.limits.vote.rateLimitPrefix,
    status: module.config.app.limits.vote.rateLimitStatus,
    message: module.config.app.limits.vote.rateLimitMessage,
    identifier: (req) => {
      return req.user ? req.user.id : req.ip;
    },
    store: module.expressLimitStore
  };
  router.post('/:commentId/vote', expresslimit(voteLimitConfig), module.createCommentVote);

  app.use('/comment', router);
};

/*
 * Module Methods
 */

module.createComment = (req, res, next) => {
  var viewModel = { };
  if (!req.user) {
    return next(new Error('Must be connected to Gab to post comments.'));
  }
  try {
    viewModel.originalUrl = req.body.url;
    viewModel.analyzedUrl = module.service.parseUrl(viewModel.originalUrl);
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      error: error.message
    });
  }

  module.log.info('comment', {
    user: req.user.id,
    domain: viewModel.analyzedUrl.domainName
  });

  CommentDomain
  .updateOne(
    { domain: viewModel.analyzedUrl.domainName },
    {
      $set: {
        domain: viewModel.analyzedUrl.domainName
      }
    },
    { upsert: true }
  )
  .then((result) => {
    module.log.debug('CommentDomain update', result);
    return CommentDomain.findOne({ domain: viewModel.analyzedUrl.domainName });
  })
  .then((domain) => {
    if (!domain) {
      return Promise.reject(new Error('failed to process domain name of comment'));
    }
    viewModel.domain = domain;
    module.log.debug('CommentDomain', { domain: viewModel.domain });
    return module.service.getUrlTitle(viewModel.originalUrl);
  })
  .then((title) => {
    return CommentUrl
    .updateOne(
      {
        domain: viewModel.domain._id,
        pathname: viewModel.analyzedUrl.url.pathname
      },
      {
        $set: {
          domain: viewModel.domain._id,
          pathname: viewModel.analyzedUrl.url.pathname,
          url: viewModel.originalUrl,
          title: title
        }
      },
      { upsert: true, new: true }
    );
  })
  .then((result) => {
    module.log.debug('CommentUrl', result);
    return CommentUrl
    .findOne({
      domain: viewModel.domain._id,
      pathname: viewModel.analyzedUrl.url.pathname,
      url: viewModel.originalUrl
    })
    .select('-content')
    .populate('domain');
  })
  .then((url) => {
    viewModel.url = url;
    return Comment
    .create({
      userId: req.user.id,
      domain: viewModel.domain._id,
      url: viewModel.url._id,
      parent: req.body.parent,
      body: req.body.body,
      nsfw: module.service.isCheckboxChecked(req.body.nsfw)
    });
  })
  .then((comment) => {
    viewModel.comment = comment;
    if (!module.service.isCheckboxChecked(req.body.shareToGab)) {
      return Promise.resolve(viewModel.comment);
    }
    if (!req.body.parent) {
      return Promise.resolve();
    }
    module.log.debug('inc parent reply count', { parent: req.body.parent });
    var jobs = [ ];
    jobs.push(
      Comment
      .updateOne(
        { _id: req.body.parent },
        {
          $inc: {
            'stats.score': 1,
            'stats.replyCount': 1
          }
        }
      )
    );
    jobs.push(viewModel.url.update({
      $inc: {
        'stats.score': 1,
        'stats.commentCount': 1,
      }
    }));
    jobs.push(viewModel.domain.update({
      $inc: {
        'stats.score': 1,
        'stats.commentCount': 1
      }
    }));
    return Promise.all(jobs);
  })
  .then(( ) => {
    var message = {
      command: 'dissent-share-comment',
      user: req.user.id,
      comment: viewModel.comment._id
    };
    return module.service.publishWorkerJob(message);
  })
  .then(( ) => {
    res.status(200).json(viewModel);
  })
  .catch(next);
};

module.createCommentVote = (req, res) => {
  var viewModel = { };
  if (!req.user) {
    return res.status(403).json({
      success: false,
      message: 'You must Connect With Gab before you can vote on comments.'
    });
  }
  module.log.info('comment vote', {
    comment: req.params.commentId,
    vote: req.body.vote
  });
  Comment.findById(req.params.commentId)
  .then((comment) => {
    viewModel.comment = comment;
    if (!viewModel.comment) {
      return Promise.reject(new HydraError(404, 'The specified comment does not exist.'));
    }
    return CommentVote
    .findOne({
      comment: req.params.commentId,
      userId: req.user.id
    });
  })
  .then((vote) => {
    viewModel.vote = vote;
    if (viewModel.vote && (viewModel.vote.vote === req.body.vote)) {
      module.log.debug('vote is unchanged');
      return Promise.resolve(); // vote is unchanged
    }

    var jobs = [ ];
    var inc = { };

    if (viewModel.vote) {
      viewModel.vote.vote = req.body.vote; // record new vote
      viewModel.vote.updated = new Date();
      jobs.push(viewModel.vote.save());
      if (req.body.vote === 'up') {
        module.log.debug('changing vote to upvote');
        inc['stats.score'] = 2;
        viewModel.comment.stats.score += 2;
        inc['stats.upvoteCount'] = 1;
        viewModel.comment.stats.upvoteCount += 1;
        inc['stats.downvoteCount'] = -1;
        viewModel.comment.stats.downvoteCount -= 1;
      } else {
        module.log.debug('changing vote to downvote');
        inc['stats.score'] = -2;
        viewModel.comment.stats.score -= 2;
        inc['stats.upvoteCount'] = -1;
        viewModel.comment.stats.upvoteCount -= 1;
        inc['stats.downvoteCount'] = 1;
        viewModel.comment.stats.downvoteCount += 1;
      }
    } else {
      jobs.push(
        CommentVote.create({
          comment: viewModel.comment._id,
          userId: req.user.id,
          vote: req.body.vote
        })
      );
      if (req.body.vote === 'up') {
        module.log.debug('recording new upvote');
        inc['stats.score'] = 1;
        viewModel.comment.stats.score += 1;
        inc['stats.upvoteCount'] = 1;
        viewModel.comment.stats.upvoteCount += 1;
      } else {
        module.log.debug('recording new downvote');
        inc['stats.score'] = -1;
        viewModel.comment.stats.score -= 1;
        inc['stats.downvoteCount'] = 1;
        viewModel.comment.stats.downvoteCount += 1;
      }
    }
    jobs.push(
      Comment
      .updateOne(
        { _id: req.params.commentId },
        { $inc: inc }
      )
    );
    return Promise.all(jobs);
  })
  .then(( ) => {
    res.status(200).json({
      success: true,
      stats: viewModel.comment.stats
    });
  })
  .catch((error) => {
    module.log.error('comment vote error', { error: error });
    res.status(error.status || 500).json({
      success: false,
      error: error
    });
  });
};

/*
 * Service Route Endpoints
 */

router.get('/:commentId/replies', (req, res, next) => {
  var viewModel = {
    pagination: module.service.getPaginationParameters(req)
  };
  var search = {
    parent: mongoose.Types.ObjectId(req.params.commentId)
  };
  module.log.debug('replies', { search: search });
  Comment
  .find(search)
  .sort({ created: 1 })
  .skip(viewModel.pagination.skip)
  .limit(viewModel.pagination.cpp)
  .populate([
    {
      path: 'domain'
    },
    {
      path: 'url',
      select: '-content'
    },
    {
      path: 'user'
    }
  ])
  .lean()
  .then((replies) => {
    viewModel.replies = replies;
    res.render('comment/replies', viewModel);
  })
  .catch(next);
});

router.get('/:commentId', (req, res, next) => {
  var viewModel = { };
  Comment
  .findById(req.params.commentId)
  .populate([
    {
      path: 'domain'
    },
    {
      path: 'url',
      select: '-content'
    },
    {
      path: 'user'
    }
  ])
  .lean()
  .then((comment) => {
    viewModel.comment = comment;
    res.render('comment/view', viewModel);
  })
  .catch(next);
});

router.get('/', (req, res, next) => {
  var viewModel = {
    pagination: module.service.getPaginationParameters(req)
  };
  var search = {
    parent: { $exists: false }
  };
  Comment
  .find(search)
  .sort({ created: -1 })
  .skip(viewModel.pagination.skip)
  .limit(viewModel.pagination.cpp)
  .populate([
    {
      path: 'domain'
    },
    {
      path: 'url',
      select: '-content'
    },
    {
      path: 'user'
    }
  ])
  .lean()
  .then((comments) => {
    viewModel.comments = comments;
    res.render('comment/index', viewModel);
  })
  .catch(next);
});