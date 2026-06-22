#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..', '..');
const source = readFileSync(resolve(repoRoot, 'scripts/run_worker_v0.mjs'), 'utf8');
const uiServerSource = readFileSync(resolve(repoRoot, 'packages/ui-model-demo-server/server.mjs'), 'utf8');
const authSource = readFileSync(resolve(repoRoot, 'packages/ui-model-demo-server/auth.mjs'), 'utf8');
const remoteWorkerPatchPaths = [
  'deploy/sys-v1ns/remote-worker/patches/10_model100.json',
  'deploy/sys-v1ns/remote-worker/patches/11_model1010.json',
  'deploy/sys-v1ns/remote-worker/patches/12_model1019.json',
  'deploy/sys-v1ns/remote-worker/patches/13_model3000_minimal_submit.json',
  'deploy/sys-v1ns/remote-worker/patches/14_model3100_slide_app_bundle_provider.json',
];

const readinessMatch = source.match(/const maybeActivateRunning = \(\) => \{\n(?<body>[\s\S]*?)\n  \};/);
assert.ok(readinessMatch, 'MBR runner must keep an explicit runtime readiness function');

const readinessBody = readinessMatch.groups.body;
assert.match(
  readinessBody,
  /!mqttReady/,
  'MBR runtime activation must wait for MQTT control-bus readiness',
);
assert.doesNotMatch(
  readinessBody,
  /!matrixReady/,
  'MBR runtime activation must not wait for Matrix management-bus readiness',
);

assert.match(
  source,
  /adapter\.subscribe\(\(event\)\s*=>\s*\{[\s\S]*if\s*\(!rt\.isRuntimeRunning\(\)\)\s*\{[\s\S]*return;[\s\S]*\}[\s\S]*rt\.addLabel\(sys,\s*0,\s*0,\s*0,\s*\{\s*k:\s*matrixInboxLabel/s,
  'Matrix management-bus events must still be dropped before runtime enters running',
);

assert.match(
  source,
  /mqttClient\.on\('connect',\s*\(\)\s*=>\s*\{[\s\S]*mqttReady\s*=\s*true;[\s\S]*maybeActivateRunning\(\);/s,
  'MQTT connect must trigger runtime activation for control-bus routing',
);

assert.match(
  uiServerSource,
  /let sharedControlBusInboundReadyPromise\s*=\s*null;/,
  'UI Server must track shared control-bus inbound activation separately from per-principal runtimes',
);

const sharedInboundMatch = uiServerSource.match(/async function ensureSharedControlBusInboundReady\(\) \{\n(?<body>[\s\S]*?)\n  \}/);
assert.ok(sharedInboundMatch, 'UI Server must expose a shared control-bus inbound activation helper');
assert.match(
  sharedInboundMatch.groups.body,
  /state\.activateRuntimeMode\('running'\)/,
  'Shared UI Server runtime must enter running so the global MQTT inbound adapter subscribes to responses',
);

assert.match(
  uiServerSource,
  /if \(req\.method === 'POST' && url\.pathname === '\/api\/runtime\/mode'\)[\s\S]*await ensureSharedControlBusInboundReady\(\);[\s\S]*const result = await runtimeEntry\.state\.activateRuntimeMode\(nextMode\);/s,
  'Activating an authenticated principal runtime must also activate the shared control-bus inbound listener first',
);

assert.match(
  authSource,
  /dy_session=\$\{token\}; HttpOnly; SameSite=Lax;/,
  'OIDC session cookie must use SameSite=Lax so the callback top-level redirect can immediately load the authenticated app',
);

assert.match(
  uiServerSource,
  /function readRuntimePrincipalKey\(runtime\)[\s\S]*runtime\.principalRuntimeKey/s,
  'UI Server must read principal runtime identity from runtime metadata when the Model 0 label is absent',
);

assert.match(
  uiServerSource,
  /userState\.runtime\.principalRuntimeKey\s*=\s*normalizedPrincipalKey;/,
  'Authenticated principal runtimes must store their principal key outside ModelTable labels',
);

assert.match(
  uiServerSource,
  /async function handleControlBusPacketResult\(topic, payload\)/,
  'Principal runtime registry must expose a matched/handled response result, not only a boolean',
);

assert.match(
  uiServerSource,
  /const principalResult = await principalRuntimeRegistry\.handleControlBusPacketResult\(topic, payload\);[\s\S]*if \(principalResult\.matched\) \{[\s\S]*return false;/,
  'Shared control-bus listener must not fallback to shared runtime after a rejected principal-targeted response',
);

for (const relativePath of remoteWorkerPatchPaths) {
  const patch = JSON.parse(readFileSync(resolve(repoRoot, relativePath), 'utf8'));
  const funcCodes = (patch.records || [])
    .filter((record) => record && record.t === 'func.js' && record.v && typeof record.v.code === 'string')
    .map((record) => record.v.code);
  assert.ok(funcCodes.length > 0, `${relativePath} must contain tier2 program functions`);
  assert.ok(
    funcCodes.every((code) => code.includes("readString(inputRecords, 'reply_target_principal_key')")),
    `${relativePath} must read reply_target_principal_key from inbound pin payload`,
  );
  assert.ok(
    funcCodes.every((code) => code.includes("mt('reply_target_principal_key', 'str', replyTargetPrincipalKey)")),
    `${relativePath} must echo reply_target_principal_key in response pin payload`,
  );
}

console.log('PASS test_0419_mbr_control_bus_ready_contract');
