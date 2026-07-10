#!/usr/bin/env node

import assert from 'node:assert';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..', '..');

function read(relPath) {
  return readFileSync(resolve(repoRoot, relPath), 'utf8');
}

const checkBaseline = read('scripts/ops/check_runtime_baseline.sh');
const ensureBaseline = read('scripts/ops/ensure_runtime_baseline.sh');
const runRoundtrip = read('scripts/ops/run_model100_submit_roundtrip_local.sh');
const deployCommon = read('scripts/ops/_deploy_common.sh');
const deployLocal = read('scripts/ops/deploy_local.sh');
const localEnvExample = read('deploy/env/local.env.example');
const localWorkers = read('k8s/local/workers.yaml');

function envValue(source, key) {
  const prefix = `${key}=`;
  const line = source
    .split(/\r?\n/u)
    .find((candidate) => candidate.startsWith(prefix));
  return line ? line.slice(prefix.length) : undefined;
}

const harnessRoot = mkdtempSync(join(tmpdir(), 'dy-0175-baseline-'));
const fakeBin = join(harnessRoot, 'bin');
mkdirSync(fakeBin, { recursive: true });
process.on('exit', () => rmSync(harnessRoot, { recursive: true, force: true }));

function writeExecutable(path, source) {
  writeFileSync(path, source, 'utf8');
  chmodSync(path, 0o755);
}

writeExecutable(join(fakeBin, 'kubectl'), String.raw`#!/usr/bin/env node
const crypto = require('node:crypto');

const args = process.argv.slice(2);
const scenario = process.env.DY_TEST_BASELINE_SCENARIO || 'local';
const context = scenario === 'wrong_k8s_context' ? 'docker-desktop' : 'orbstack';
const matrixUrl = scenario === 'remote_matrix'
  ? 'https://matrix.dongyudigital.com'
  : 'http://synapse.dongyu.svc.cluster.local:8008';
const mqttHost = scenario === 'remote_mqtt'
  ? 'mqtt.dongyudigital.com'
  : 'mosquitto.dongyu.svc.cluster.local';
const oidcIssuer = scenario === 'remote_oidc' ? 'https://sso.dongyudigital.com' : '';
const oidcRedirectUri = scenario === 'remote_oidc_redirect'
  ? 'https://app.dongyudigital.com/auth/sso/callback'
  : '';
const oidcScope = scenario === 'stale_oidc_scope' ? 'openid profile email' : '';
const oidcStateSecret = scenario === 'stale_oidc_state' ? 'stale-local-state-secret' : '';
const encode = (value) => Buffer.from(String(value), 'utf8').toString('base64');
const record = (k, t, v) => ({ op: 'add_label', model_id: 0, p: 0, r: 0, c: 0, k, t, v });

function bootstrapPatch(kind) {
  const isUi = kind === 'ui';
  return {
    version: 'mt.v0',
    op_id: isUi ? 'ui_server_matrix_bootstrap_v0' : 'mbr_worker_bootstrap_v0',
    records: [
      record('matrix_room_id', 'str', '!dy-0175:localhost'),
      record('matrix_server', 'matrix.server', matrixUrl),
      record('matrix_user', 'matrix.user', isUi ? '@drop:localhost' : '@mbr:localhost'),
      ...(isUi ? [record('matrix_passwd', 'matrix.passwd', 'local-test-password')] : []),
      record('matrix_token', 'matrix.token', isUi ? 'local-ui-token' : 'local-mbr-token'),
      record('matrix_contuser', 'matrix.contuser', [isUi ? '@mbr:localhost' : '@drop:localhost']),
      record('local_ip', 'mqtt.local.ip', [mqttHost]),
      record('local_port', 'mqtt.local.port', ['1883']),
    ],
  };
}

function secretData(name) {
  const patch = bootstrapPatch(name === 'ui-server-secret' ? 'ui' : 'mbr');
  const data = { MODELTABLE_PATCH_JSON: encode(JSON.stringify(patch)) };
  if (name === 'ui-server-secret') {
    Object.assign(data, {
      DY_AUTH: encode('0'),
      DY_DEV_FAKE_LOGIN: encode('0'),
      DY_OIDC_ISSUER: encode(oidcIssuer),
      DY_OIDC_CLIENT_ID: encode(''),
      DY_OIDC_CLIENT_SECRET: encode(''),
      DY_OIDC_REDIRECT_URI: encode(oidcRedirectUri),
      DY_OIDC_SCOPE: encode(oidcScope),
      DY_OIDC_PROXY_URL: encode(''),
      DY_OIDC_STATE_SECRET: encode(oidcStateSecret),
      MATRIX_HOMESERVER_URL: encode(matrixUrl),
      SYNAPSE_SERVER_NAME: encode('localhost'),
    });
    if (scenario === 'feishu_https') {
      data.FEISHU_API_BASE = encode('https://open.feishu.cn');
      data.FEISHU_ACCESS_MODE = encode('read-only');
    }
  }
  return data;
}

function actorPatch(kind) {
  const facts = {
    mbr: { id: '5/10/28/35/14', role: 'DEM', alias: null, pins: ['pin.bus.cb.in', 'pin.bus.cb.out', 'pin.bus.mb.in', 'pin.bus.mb.out'] },
    r1: { id: '5/10/28/35/15', role: 'V1N', alias: 'R1', pins: ['pin.bus.cb.in', 'pin.bus.cb.out'] },
    wm1: { id: '5/10/28/36/16', role: 'DEM', alias: 'WM1', pins: ['pin.bus.cb.in', 'pin.bus.cb.out', 'pin.bus.mb.in', 'pin.bus.mb.out'] },
  }[kind];
  const records = [
    record('model_type', 'model.v1n', kind === 'r1' ? 'V1N' : 'DEM'),
    record('sys_worker_id', 'worker.id', facts.id),
    record('sys_worker_role', 'worker.role', facts.role),
  ];
  if (facts.alias) records.push(record('mqtt_worker_id', 'str', facts.alias));
  facts.pins.forEach((type, index) => records.push(record(kind + '_bus_' + index, type, null)));
  return { version: 'mt.v0', op_id: 'dy_0175_' + kind, records };
}

const actorAssets = {
  '/app/persisted-assets/manifest.v0.json': JSON.stringify({
    version: 'dy.asset_manifest.v0',
    entries: [
      { id: 'mbr-worker-mbr_role_v0', phase: '20-role-negative', path: 'roles/mbr/patches/mbr_role_v0.json', kind: 'patch', scope: ['mbr-worker'], authority: 'authoritative', required: true },
      { id: 'remote-worker-00_remote_worker_config', phase: '20-role-negative', path: 'roles/remote-worker/patches/00_remote_worker_config.json', kind: 'patch', scope: ['remote-worker'], authority: 'authoritative', required: true },
      { id: 'workspace-manager-00_workspace_manager_dem_config', phase: '20-role-negative', path: 'roles/workspace-manager/patches/00_workspace_manager_dem_config.json', kind: 'patch', scope: ['workspace-manager'], authority: 'authoritative', required: true },
    ],
  }),
  '/app/persisted-assets/roles/mbr/patches/mbr_role_v0.json': JSON.stringify(actorPatch('mbr')),
  '/app/persisted-assets/roles/remote-worker/patches/00_remote_worker_config.json': JSON.stringify(actorPatch('r1')),
  '/app/persisted-assets/roles/workspace-manager/patches/00_workspace_manager_dem_config.json': JSON.stringify(actorPatch('wm1')),
};

function outputValue(object, outputSpec) {
  if (!outputSpec || outputSpec === 'json') {
    process.stdout.write(JSON.stringify(object));
    return;
  }
  if (outputSpec.includes('homeserver') && object.data && object.data['homeserver.yaml'] !== undefined) {
    process.stdout.write(object.data['homeserver.yaml']);
    return;
  }
  const dataKey = outputSpec.match(/\.data\.([A-Za-z0-9_]+)/);
  if (dataKey) {
    process.stdout.write(String((object.data && object.data[dataKey[1]]) || ''));
    return;
  }
  if (outputSpec.includes('readyReplicas')) {
    process.stdout.write(String((object.status && object.status.readyReplicas) || ''));
    return;
  }
  if (outputSpec.includes('clusterIP')) {
    process.stdout.write(String((object.spec && object.spec.clusterIP) || ''));
    return;
  }
  process.stdout.write(JSON.stringify(object));
}

if (args[0] === 'config' && args[1] === 'current-context') {
  process.stdout.write(context + '\n');
  process.exit(0);
}
if (args[0] === 'config' && args[1] === 'get-contexts') {
  process.stdout.write('orbstack\n');
  process.exit(0);
}
if (args[0] === 'config' && args[1] === 'use-context') process.exit(args[2] === context ? 0 : 1);

const verbIndex = args.findIndex((arg) => ['get', 'exec', 'logs'].includes(arg));
const verb = verbIndex >= 0 ? args[verbIndex] : '';
if (verb === 'get') {
  const kind = args[verbIndex + 1];
  const name = args[verbIndex + 2] || '';
  const outputIndex = args.indexOf('-o');
  const outputSpec = outputIndex >= 0 ? args[outputIndex + 1] : '';
  if (kind === 'ns' || kind === 'namespace' || kind === 'namespaces') {
    process.stdout.write('dongyu\n');
    process.exit(0);
  }
  if (kind === 'deploy' || kind === 'deployment' || kind === 'deployments') {
    outputValue({ status: { readyReplicas: 1 } }, outputSpec);
    process.exit(0);
  }
  if (kind === 'pods' || kind === 'pod') {
    process.stdout.write(name ? JSON.stringify({ metadata: { name } }) : 'dy-0175-pod 1/1 Running 0 1m\n');
    process.exit(0);
  }
  if (kind === 'secret' || kind === 'secrets') {
    if (!name || name.startsWith('-')) {
      outputValue({
        items: ['ui-server-secret', 'mbr-worker-secret'].map((secretName) => ({
          apiVersion: 'v1',
          kind: 'Secret',
          metadata: { name: secretName },
          data: secretData(secretName),
        })),
      }, outputSpec);
      process.exit(0);
    }
    outputValue({ apiVersion: 'v1', kind: 'Secret', metadata: { name }, data: secretData(name) }, outputSpec);
    process.exit(0);
  }
  if (kind === 'configmap' || kind === 'configmaps' || kind === 'cm') {
    const data = name === 'synapse-config'
      ? { 'homeserver.yaml': scenario === 'prefixed_synapse_server_name'
        ? 'server_name: "localhost.evil"\n'
        : 'server_name: "localhost"\n' }
      : { MQTT_HOST: mqttHost, MQTT_PORT: '1883' };
    outputValue({ apiVersion: 'v1', kind: 'ConfigMap', metadata: { name }, data }, outputSpec);
    process.exit(0);
  }
  if (kind === 'svc' || kind === 'service' || kind === 'services') {
    outputValue({ spec: { clusterIP: '10.96.0.10' } }, outputSpec);
    process.exit(0);
  }
  if (kind === 'endpoints' || kind === 'endpoint') {
    outputValue({ subsets: [{ addresses: [{ ip: '10.244.0.10' }] }] }, outputSpec);
    process.exit(0);
  }
}

if (verb === 'exec') {
  const command = args.slice(args.indexOf('--') + 1).join(' ');
  const assetPath = Object.keys(actorAssets).find((candidate) => command.includes(candidate));
  if (assetPath) {
    const content = actorAssets[assetPath];
    if (command.includes('sha256sum')) {
      process.stdout.write(crypto.createHash('sha256').update(content).digest('hex') + '  ' + assetPath + '\n');
    } else {
      process.stdout.write(content);
    }
    process.exit(0);
  }
  if (command.includes('_matrix/client/versions')) {
    process.stdout.write('{"versions":["v1.11"]}\n');
    process.exit(0);
  }
}

if (verb === 'logs') {
  process.stdout.write('DE_ACTOR_ATTESTATION local fixture\n');
  process.exit(0);
}

process.stderr.write('unsupported fake kubectl args: ' + JSON.stringify(args) + '\n');
process.exit(2);
`);

writeExecutable(join(fakeBin, 'docker'), String.raw`#!/usr/bin/env bash
set -euo pipefail
if [ "$1" = "context" ] && [ "$2" = "show" ]; then
  if [ "$DY_TEST_BASELINE_SCENARIO" = "wrong_docker_context" ]; then echo docker-desktop; else echo orbstack; fi
  exit 0
fi
if [ "$1" = "info" ]; then exit 0; fi
echo "unsupported fake docker args: $*" >&2
exit 2
`);

writeExecutable(join(fakeBin, 'orb'), String.raw`#!/usr/bin/env bash
set -euo pipefail
if [ "$1" = "status" ]; then echo Running; exit 0; fi
echo "unsupported fake orb args: $*" >&2
exit 2
`);

function harnessEnv(scenario, extra = {}) {
  return {
    ...process.env,
    ...(scenario === 'feishu_https' ? {
      FEISHU_ACCESS_MODE: 'read-only',
      FEISHU_API_BASE: 'https://open.feishu.cn',
    } : {}),
    ...extra,
    DY_TEST_BASELINE_SCENARIO: scenario,
    PATH: `${fakeBin}${delimiter}${process.env.PATH || ''}`,
  };
}

function runBaselineChecker(scenario) {
  return spawnSync('bash', [resolve(repoRoot, 'scripts/ops/check_runtime_baseline.sh')], {
    cwd: repoRoot,
    env: harnessEnv(scenario),
    encoding: 'utf8',
  });
}

function runForceRebuildHarness() {
  const sandbox = join(harnessRoot, 'ensure-sandbox');
  const opsDir = join(sandbox, 'scripts', 'ops');
  const envDir = join(sandbox, 'deploy', 'env');
  const callLog = join(sandbox, 'calls.log');
  mkdirSync(opsDir, { recursive: true });
  mkdirSync(envDir, { recursive: true });
  writeFileSync(join(opsDir, 'ensure_runtime_baseline.sh'), ensureBaseline, 'utf8');
  writeFileSync(join(envDir, 'local.env'), 'K8S_CONTEXT=orbstack\n', 'utf8');
  writeFileSync(callLog, '', 'utf8');
  writeExecutable(join(opsDir, 'check_runtime_baseline.sh'), String.raw`#!/usr/bin/env bash
set -euo pipefail
echo check >> "$DY_TEST_CALL_LOG"
exit 0
`);
  writeExecutable(join(opsDir, 'deploy_local.sh'), String.raw`#!/usr/bin/env bash
set -euo pipefail
echo "deploy:$SKIP_IMAGE_BUILD" >> "$DY_TEST_CALL_LOG"
exit 0
`);
  const result = spawnSync('bash', [join(opsDir, 'ensure_runtime_baseline.sh'), '--force-rebuild'], {
    cwd: sandbox,
    env: harnessEnv('local', { DY_TEST_CALL_LOG: callLog }),
    encoding: 'utf8',
  });
  const calls = readFileSync(callLog, 'utf8').trim().split(/\r?\n/u).filter(Boolean);
  return { ...result, calls };
}

assert.match(
  runRoundtrip,
  /ensure_runtime_baseline\.sh/,
  'run_model100_submit_roundtrip_local.sh must use ensure_runtime_baseline.sh so one-click local verification can auto-heal stale baseline state',
);

assert.match(
  checkBaseline,
  /MODELTABLE_PATCH_JSON/,
  'check_runtime_baseline.sh must validate bootstrap patch readiness, not only deployment replicas',
);

assert.match(
  checkBaseline,
  /matrix_room_id/,
  'check_runtime_baseline.sh must inspect matrix_room_id inside the bootstrap patch',
);

assert.match(
  checkBaseline,
  /placeholder-will-update-after-synapse-setup/,
  'check_runtime_baseline.sh must reject placeholder token values inside the bootstrap patch as baseline-not-ready',
);

assert.match(
  ensureBaseline,
  /check_runtime_baseline\.sh/,
  'ensure_runtime_baseline.sh must delegate readiness judgment to check_runtime_baseline.sh so stale Matrix secrets trigger auto-repair',
);

assert.match(
  deployCommon,
  /mbr_worker_bootstrap_v0/,
  '_deploy_common.sh must generate the mbr bootstrap patch into MODELTABLE_PATCH_JSON',
);

assert.match(
  deployLocal,
  /update_k8s_secrets "\$SERVER_TOKEN" "\$MBR_TOKEN" "\$ROOM_ID"/,
  'deploy_local.sh must pass ROOM_ID into update_k8s_secrets so generated bootstrap patch includes the actual Matrix room id',
);

assert.match(
  deployCommon,
  /wait_for_no_terminating_pods\(\)[\s\S]*ERROR: terminating pods still present[\s\S]*return "\$failed"/,
  '_deploy_common.sh must fail when app pods remain Terminating after rollout wait',
);

assert.match(
  deployLocal,
  /wait_for_no_terminating_pods remote-worker workspace-manager mbr-worker ui-server/,
  'deploy_local.sh must wait for old app pods to terminate before reporting deploy complete',
);

assert.match(
  checkBaseline,
  /check_no_terminating_pods[\s\S]*has terminating pods/,
  'check_runtime_baseline.sh must reject baselines with old app pods still Terminating',
);

const plannedAllLocalCases = [
  [
    'local env pins OrbStack, Synapse, and Mosquitto',
    () => {
      assert.equal(envValue(localEnvExample, 'K8S_CONTEXT'), 'orbstack', 'local K8s context must be exactly orbstack');
      assert.equal(
        envValue(localEnvExample, 'MATRIX_HOMESERVER_URL'),
        'http://synapse.dongyu.svc.cluster.local:8008',
        'local Matrix transport must use the in-cluster Synapse service',
      );
      assert.equal(envValue(localEnvExample, 'SYNAPSE_SERVER_NAME'), 'localhost', 'local Synapse server_name must be localhost');
      assert.equal(
        envValue(localEnvExample, 'MQTT_HOST'),
        'mosquitto.dongyu.svc.cluster.local',
        'local MQTT transport must use the in-cluster Mosquitto service',
      );
      assert.equal(envValue(localEnvExample, 'MQTT_PORT'), '1883', 'local MQTT transport must use port 1883');
      assert.doesNotMatch(localEnvExample, /matrix\.dongyudigital\.com|REMOTE_MATRIX_/u, 'local defaults must not depend on remote Matrix');
    },
  ],
  [
    'local env disables auth and remote OIDC defaults',
    () => {
      assert.equal(envValue(localEnvExample, 'DY_AUTH'), '0', 'local acceptance must default DY_AUTH to 0');
      assert.equal(envValue(localEnvExample, 'DY_DEV_FAKE_LOGIN'), '0', 'local acceptance must not depend on fake login');
      assert.equal(envValue(localEnvExample, 'DY_OIDC_ISSUER'), '', 'local acceptance must not default a remote OIDC issuer');
      assert.equal(envValue(localEnvExample, 'DY_OIDC_CLIENT_ID'), '', 'local acceptance must not default a remote OIDC client');
      assert.equal(envValue(localEnvExample, 'DY_OIDC_CLIENT_SECRET'), '', 'local acceptance must not default a remote OIDC secret');
      assert.doesNotMatch(localEnvExample, /sso\.dongyudigital\.com/u, 'local defaults must not name the remote OIDC service');
    },
  ],
  [
    'local worker manifest has no insecure TLS override',
    () => {
      assert.doesNotMatch(
        localWorkers,
        /NODE_TLS_REJECT_UNAUTHORIZED\s*:\s*["']?0|name:\s*NODE_TLS_REJECT_UNAUTHORIZED[\s\S]{0,80}?value:\s*["']?0/u,
        'local UI/MBR manifests must not set NODE_TLS_REJECT_UNAUTHORIZED=0',
      );
    },
  ],
  [
    'checker rejects non-OrbStack Kubernetes context',
    () => {
      const result = runBaselineChecker('wrong_k8s_context');
      assert.notEqual(
        result.status,
        0,
        `checker must reject a non-OrbStack Kubernetes context instead of falling back; stdout=${result.stdout} stderr=${result.stderr}`,
      );
    },
  ],
  [
    'checker rejects non-OrbStack Docker context',
    () => {
      const result = runBaselineChecker('wrong_docker_context');
      assert.notEqual(
        result.status,
        0,
        `checker must reject a non-OrbStack Docker context; stdout=${result.stdout} stderr=${result.stderr}`,
      );
    },
  ],
  [
    'checker rejects remote Matrix bootstrap',
    () => {
      const result = runBaselineChecker('remote_matrix');
      assert.notEqual(
        result.status,
        0,
        `checker must reject a remote matrix_server/MATRIX_HOMESERVER_URL; stdout=${result.stdout} stderr=${result.stderr}`,
      );
    },
  ],
  [
    'checker rejects remote MQTT bootstrap',
    () => {
      const result = runBaselineChecker('remote_mqtt');
      assert.notEqual(
        result.status,
        0,
        `checker must reject remote mqtt.local.ip and worker ConfigMaps; stdout=${result.stdout} stderr=${result.stderr}`,
      );
    },
  ],
  [
    'checker rejects remote OIDC bootstrap',
    () => {
      const result = runBaselineChecker('remote_oidc');
      assert.notEqual(
        result.status,
        0,
        `checker must reject a remote DY_OIDC_ISSUER even when DY_AUTH=0; stdout=${result.stdout} stderr=${result.stderr}`,
      );
    },
  ],
  [
    'checker rejects remote OIDC redirect residue',
    () => {
      const result = runBaselineChecker('remote_oidc_redirect');
      assert.notEqual(
        result.status,
        0,
        `checker must reject a non-empty DY_OIDC_REDIRECT_URI when DY_AUTH=0; stdout=${result.stdout} stderr=${result.stderr}`,
      );
    },
  ],
  [
    'checker rejects stale OIDC scope residue',
    () => {
      const result = runBaselineChecker('stale_oidc_scope');
      assert.notEqual(
        result.status,
        0,
        `checker must reject a non-empty DY_OIDC_SCOPE when DY_AUTH=0; stdout=${result.stdout} stderr=${result.stderr}`,
      );
    },
  ],
  [
    'checker rejects stale OIDC state residue',
    () => {
      const result = runBaselineChecker('stale_oidc_state');
      assert.notEqual(
        result.status,
        0,
        `checker must reject a non-empty DY_OIDC_STATE_SECRET when DY_AUTH=0; stdout=${result.stdout} stderr=${result.stderr}`,
      );
    },
  ],
  [
    'checker requires exact localhost Synapse server_name',
    () => {
      const result = runBaselineChecker('prefixed_synapse_server_name');
      assert.notEqual(
        result.status,
        0,
        `checker must reject server_name values that merely start with localhost; stdout=${result.stdout} stderr=${result.stderr}`,
      );
    },
  ],
  [
    'checker accepts a complete local deployment fixture',
    () => {
      const result = runBaselineChecker('local');
      assert.equal(
        result.status,
        0,
        `checker must accept exact local Matrix/MQTT/auth/actor fixtures; stdout=${result.stdout} stderr=${result.stderr}`,
      );
    },
  ],
  [
    'checker permits explicit read-only Feishu HTTPS configuration',
    () => {
      const result = runBaselineChecker('feishu_https');
      assert.equal(
        result.status,
        0,
        `checker must not apply a generic external-HTTPS ban to Feishu read-only config; stdout=${result.stdout} stderr=${result.stderr}`,
      );
    },
  ],
  [
    'force rebuild deploys exactly once before the final checker',
    () => {
      const result = runForceRebuildHarness();
      assert.equal(result.status, 0, `--force-rebuild harness must exit successfully; stdout=${result.stdout} stderr=${result.stderr}`);
      assert.deepEqual(
        result.calls,
        ['deploy:0', 'check'],
        `--force-rebuild must force image build, call deploy exactly once, then check exactly once; got ${JSON.stringify(result.calls)}`,
      );
    },
  ],
];

const plannedAllLocalFailures = [];
for (const [name, testCase] of plannedAllLocalCases) {
  try {
    testCase();
  } catch (error) {
    plannedAllLocalFailures.push(`${name}: ${error && error.message ? error.message : String(error)}`);
  }
}

assert.equal(
  plannedAllLocalFailures.length,
  0,
  `planned all-local baseline contract failures:\n- ${plannedAllLocalFailures.join('\n- ')}`,
);

console.log('PASS test_0175_local_baseline_matrix_contract');
