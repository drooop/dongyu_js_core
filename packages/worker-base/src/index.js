'use strict';

const { ModelTableRuntime } = require('./runtime');
const { initDataModel, DATA_TYPE_REGISTRY } = require('./data_models');
const { createMatrixLiveAdapter } = require('./matrix_live.js');
const { createLoopbackAdapter } = require('./loopback.js');

module.exports = {
  ModelTableRuntime,
  initDataModel,
  DATA_TYPE_REGISTRY,
  createMatrixLiveAdapter,
  createLoopbackAdapter,
};
