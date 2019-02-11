// comment.js
// Copyright (C) 2018 Rob Colbert <rob.colbert@openplatform.us>
// All Rights Reserved

'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

var CommentSchema = new Schema({
  created: { type: Date, default: Date.now, required: true, index: true },
  userId: { type: Number, required: true, index: true },
  domain: { type: Schema.ObjectId, required: true, index: true, ref: 'CommentDomain' },
  url: { type: Schema.ObjectId, required: true, index: true, ref: 'CommentUrl' },
  parent: { type: Schema.ObjectId, index: true, ref: 'Comment' },
  body: { type: String, required: true },
  nsfw: { type: Boolean, default: false, required: true, index: true },
  status: {
    type: String,
    enum: ['pending', 'error', 'complete', 'deleted'],
    default: 'pending',
    required: true,
    index: true
  },
  postId: { type: String },
  stats: {
    score: { type: Number, default: 0, required: true, index: true },
    upvoteCount: { type: Number, default: 0, required: true },
    downvoteCount: { type: Number, default: 0, required: true },
    replyCount: { type: Number, default: 0, required: true }
  }
});

CommentSchema.virtual('user', {
  ref: 'User',
  localField: 'userId',
  foreignField: 'id',
  justOne: true
});

CommentSchema.index({
  domain: 1,
  url: 1
}, {
  name: 'comment_domain_url_idx'
});

module.exports.model = mongoose.model('Comment', CommentSchema);
module.exports.resetIndexes = (log) => {
  const HydraDbUtils = require('../hydra-db-utils');
  return HydraDbUtils.resetIndexes(module.exports.model, log);
};