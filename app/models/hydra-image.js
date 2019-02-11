// hydra-image.js
// Copyright (C) 2019 Gab AI, Inc.
// All Rights Reserved

'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const HydraImageSchema = new Schema({
  created: { type: Date, default: Date.now, required: true, index: -1 },
  filename: { type: String },
  mimetype: { type: String },
  size: { type: Number },
  data: { type: Buffer, select: false }
});

module.exports.model = mongoose.model('HydraImage', HydraImageSchema);
module.exports.resetIndexes = (log) => {
  const HydraDbUtils = require('../hydra-db-utils');
  return HydraDbUtils.resetIndexes(module.exports.model, log);
};