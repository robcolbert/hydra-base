// comment-domain.js
// Copyright (C) 2019 Gab AI, Inc.
// All Rights Reserved

'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

var CommentDomainSchema = new Schema({
  created: { type: Date, default: Date.now, required: true, index: true },
  domain: { type: String, required: true, index: true },
  stats: {
    urlCount: { type: Number, default: 0, required: true, index: true },
    score: { type: Number, default: 0, required: true, index: true },
    commentCount: { type: Number, default: 0, required: true, index: true },
    upvoteCount: { type: Number, default: 0, required: true, index: true },
    downvoteCount: { type: Number, default: 0, required: true, index: true }
  }
});

module.exports.model = mongoose.model('CommentDomain', CommentDomainSchema);
module.exports.resetIndexes = (log) => {
  const HydraDbUtils = require('../hydra-db-utils');
  return HydraDbUtils.resetIndexes(module.exports.model, log);
};