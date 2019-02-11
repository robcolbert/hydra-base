// comment.js
// Copyright (C) 2018 Rob Colbert <rob.colbert@openplatform.us>
// All Rights Reserved

'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

var CommentVoteSchema = new Schema({
  created: { type: Date, default: Date.now, required: true, index: true },
  updated: { type: Date },
  comment: { type: Schema.ObjectId, required: true, index: true, ref: 'Comment' },
  userId: { type: Number, required: true, index: true },
  vote: { type: String, enum: ['up', 'down'], required: true }
});

CommentVoteSchema.virtual('user', {
  ref: 'User',
  localField: 'userId',
  foreignField: 'id',
  justOne: true
});

CommentVoteSchema.index({
  comment: 1,
  userId: 1
}, {
  name: 'commentvote_comment_user_idx'
});

module.exports.model = mongoose.model('CommentVote', CommentVoteSchema);
module.exports.resetIndexes = (log) => {
  const HydraDbUtils = require('../hydra-db-utils');
  return HydraDbUtils.resetIndexes(module.exports.model, log);
};