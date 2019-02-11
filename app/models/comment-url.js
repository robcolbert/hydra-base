// comment-url.js
// Copyright (C) 2018 Rob Colbert <rob.colbert@openplatform.us>
// All Rights Reserved

'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

var CommentUrlSchema = new Schema({
  created: { type: Date, default: Date.now, required: true, index: true },
  domain: { type: Schema.ObjectId, required: true, index: true, ref: 'CommentDomain' },
  pathname: { type: String, required: true, index: true },
  parameters: [{
    name: { type: String },
    value: { type: String }
  }],
  url: { type: String, required: true, index: true },
  title: { type: String },
  stats: {
    score: { type: Number, default: 0, required: true, index: true },
    commentCount: { type: Number, default: 0, required: true, index: true },
    upvoteCount: { type: Number, default: 0, required: true, index: true },
    downvoteCount: { type: Number, default: 0, required: true, index: true }
  }
});

module.exports.model = mongoose.model('CommentUrl', CommentUrlSchema);
module.exports.resetIndexes = (log) => {
  const HydraDbUtils = require('../hydra-db-utils');
  return HydraDbUtils.resetIndexes(module.exports.model, log);
};
