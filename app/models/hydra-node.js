// hydra-node.js
// Copyright (C) 2019 Gab AI, Inc.
// All Rights Reserved

'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const HydraNodeSchema = new Schema({
  created: { type: Date, default: Date.now, required: true, index: -1 },
  operator: { type: Schema.ObjectId, required: true, index: true, ref: 'User' },
  name: { type: String, required: true },
  description: { type: String },
  tags: [{ type: String, index: true }],
  address: { type: String, required: true, unique: true },
  port: { type: Number, required: true, default: 3000 },
  accessKey: { type: String, required: true },
  accessSecret: { type: String, required: true }
});

HydraNodeSchema.index({
  tags: 'text',
  name: 'text',
  description: 'text'
}, {
  weights: {
    tags: 10,
    name: 5,
    description: 1
  },
  name: 'idx_hydranode_text_search'
});

module.exports.model = mongoose.model('HydraNode', HydraNodeSchema);
module.exports.resetIndexes = (log) => {
  const HydraDbUtils = require('../hydra-db-utils');
  return HydraDbUtils.resetIndexes(module.exports.model, log);
};