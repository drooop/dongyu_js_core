'use strict';

const { ModelTableRuntime } = require('./runtime');
const { initDataModel, DATA_TYPE_REGISTRY } = require('./data_models');

module.exports = {
  ModelTableRuntime,
  initDataModel,
  DATA_TYPE_REGISTRY,
};
