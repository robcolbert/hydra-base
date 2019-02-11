// connect-token.js
// Copyright (C) 2019 Gab AI, Inc.
// All Rights Reserved

'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ConnectTokenSchema = new Schema({
  created: { type: Date, default: Date.now, required: true, index: -1, expires: '1m' },
  user: { type: Schema.ObjectId, required: true, index: true, ref: 'User' },
  token: { type: String, required: true },
  claimed: { type: Boolean, default: false }
});

module.exports.model = mongoose.model('ConnectToken', ConnectTokenSchema);
module.exports.resetIndexes = (log) => {
  const HydraDbUtils = require('../hydra-db-utils');
  return HydraDbUtils.resetIndexes(module.exports.model, log);
};