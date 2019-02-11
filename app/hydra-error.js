// hydra-error.js
// Copyright (C) 2019 Gab AI, Inc.
// All Rights Reserved

'use strict';

(( ) => {

class HydraError extends Error {

  constructor (code, message) {
    super(message);
    this.code = code;
    this.status = code;
  }

}

module.exports = HydraError;

})();