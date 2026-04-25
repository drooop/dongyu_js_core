#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');

function read(rel) {
  return fs.readFileSync(path.join(repoRoot, rel), 'utf8');
}

const localWorkers = read('k8s/local/workers.yaml');
const cloudWorkers = read('k8s/cloud/workers.yaml');
const opsReadme = read('scripts/ops/README.md');
const matrixMqttGuide = read('docs/user-guide/ui_event_matrix_mqtt_configuration.md');

assert.match(
  localWorkers,
  /MQTT_HOST:\s+"mosquitto\.dongyu\.svc\.cluster\.local"/,
  'local OrbStack worker baseline must continue using in-namespace mosquitto',
);

assert.match(
  cloudWorkers,
  /MQTT_HOST:\s+"emqx-emqx-enterprise\.emqx\.svc\.cluster\.local"/,
  'cloud rke2 worker baseline must point to the remote EMQX service',
);

assert.match(
  opsReadme,
  /OrbStack.*mosquitto|local.*mosquitto/i,
  'ops README must disclose that local baseline uses mosquitto',
);

assert.match(
  opsReadme,
  /remote.*EMQX|EMQX.*rke2|cloud.*EMQX/i,
  'ops README must disclose that remote rke2 uses EMQX instead of the local mosquitto baseline',
);

assert.match(
  matrixMqttGuide,
  /本地.*mosquitto|OrbStack.*mosquitto/i,
  'user guide must document the local MQTT baseline explicitly',
);

assert.match(
  matrixMqttGuide,
  /远端.*EMQX|rke2.*EMQX|emqx-emqx-enterprise\.emqx\.svc\.cluster\.local/i,
  'user guide must document the remote MQTT baseline explicitly',
);

console.log('PASS test_0184_cloud_mqtt_topology_contract');
