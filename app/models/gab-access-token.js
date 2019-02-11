// gab-access-token.js
// Copyright (C) 2019 Gab AI, Inc.
// All Rights Reserved

'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

var GabAccessTokenSchema = new Schema({
  updated: { type: Date, default: Date.now, required: true, index: true },
  gabUserId: { type: Number, required: true, index: true, unique: true },
  accessToken: {
    token_type: { type: String },
    expires_in: { type: Number },
    expires_at: { type: Date },
    access_token: { type: String },
    refresh_token: { type: String }
  }
});

module.exports.model = mongoose.model(
  'GabAccessToken',
  GabAccessTokenSchema
);
module.exports.resetIndexes = (log) => {
  const HydraDbUtils = require('../hydra-db-utils');
  return HydraDbUtils.resetIndexes(module.exports.model, log);
};