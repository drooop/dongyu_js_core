#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { shouldBridgeMbrMqttPacket } from '../run_worker_v0.mjs';

const repoRoot = resolve(import.meta.dirname, '..', '..');
const source = readFileSync(resolve(repoRoot, 'scripts/run_worker_v0.mjs'), 'utf8');

assert.match(
  source,
  /adapter\.subscribe\(\(event\)\s*=>\s*\{[\s\S]*?validateUnifiedMatrixEventPacket\(event\)[\s\S]*?if\s*\(!rt\.isRuntimeRunning\(\)\)\s*\{[\s\S]*?writeMbrIngressError\(rt,\s*model0,\s*'matrix',\s*'runtime_not_running'\)[\s\S]*?return;[\s\S]*?\}[\s\S]*?recordManagementIngress\([\s\S]*?rt\.addLabel\(model0,\s*0,\s*0,\s*0,\s*\{\s*k:\s*'mbr_mb_in',\s*t:\s*'pin\.bus\.mb\.in'/s,
  'Matrix bridge callback must reject pre-running ingress and route accepted v2 records through Model 0 management bus input',
);

assert.equal(
  shouldBridgeMbrMqttPacket({ ok: true, message_role: 'response', bus: 'control', route_kind: 'control' }),
  false,
  'MBR MQTT adapter must not feed direct control responses into its bridge role',
);
assert.equal(
  shouldBridgeMbrMqttPacket({ ok: true, message_role: 'response', bus: 'management', route_kind: 'management' }),
  true,
  'MBR MQTT adapter must feed management responses into the Matrix bridge role',
);
assert.equal(
  shouldBridgeMbrMqttPacket({ ok: true, message_role: 'request', bus: 'management', route_kind: 'management' }),
  false,
  'MBR MQTT adapter must ignore its own forwarded management request',
);
assert.ok(
  source.indexOf('if (!shouldBridgeMbrMqttPacket(validation))') < source.indexOf('recordControlResponseIngress('),
  'MBR MQTT bridge filter must run before evidence emission and Model 0 ingress',
);

assert.match(
  source,
  /mqttClient\.on\('message',\s*\(topic,\s*buf\)\s*=>\s*\{[\s\S]*?validateUnifiedEndpointTopicPacket\(topic,\s*packet,\s*base\)[\s\S]*?if\s*\(!rt\.isRuntimeRunning\(\)\)\s*\{[\s\S]*?writeMbrIngressError\(rt,\s*model0,\s*'mqtt',\s*'runtime_not_running'\)[\s\S]*?return;[\s\S]*?\}[\s\S]*?recordControlResponseIngress\([\s\S]*?rt\.addLabel\(model0,\s*0,\s*0,\s*0,\s*\{\s*k:\s*'mbr_cb_in',\s*t:\s*'pin\.bus\.cb\.in'/s,
  'MQTT bridge callback must reject pre-running ingress and route accepted v2 records through Model 0 control bus input',
);

console.log('PASS test_0179_mbr_runtime_mode_gate');
