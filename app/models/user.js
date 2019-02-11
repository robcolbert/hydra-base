// user.js
// Copyright (C) 2019 Gab AI, Inc.
// All Rights Reserved

'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

var UserSchema = new Schema({
  created: { type: Date, default: Date.now, required: true, index: true },
  id: { type: Number, required: true, index: true, unique: true },
  name: { type: String },
  bio: { type: String },
  username: { type: String, required: true },
  username_lc: { type: String, lowercase: true, required: true, index: true },
  cover_url: { type: String },
  picture_url: { type: String },
  picture_url_full: { type: String },
  flags: {
    canLogin: { type: Boolean, default: true, required: true },
    canPost: { type: Boolean, default: true, required: true },
    isBanned: { type: Boolean, default: false, required: true },
    isAdmin: { type: Boolean, default: false, required: true },
    verified: { type: Boolean, default: false, required: true },
    is_pro: { type: Boolean, default: false, required: true },
    is_donor: { type: Boolean, default: false, required: true },
    is_investor: { type: Boolean, default: false, required: true },
    is_premium: { type: Boolean, default: false, required: true },
    is_tippable: { type: Boolean, default: false, required: true },
    is_private: { type: Boolean, default: false, required: true },
    is_accessible: { type: Boolean, default: false, required: true }
  }
});

module.exports.model = mongoose.model('User', UserSchema);
module.exports.resetIndexes = (log) => {
  const HydraDbUtils = require('../hydra-db-utils');
  return HydraDbUtils.resetIndexes(module.exports.model, log);
};