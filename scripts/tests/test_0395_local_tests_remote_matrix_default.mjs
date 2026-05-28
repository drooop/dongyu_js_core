#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const repoRoot = resolve(import.meta.dirname, '..', '..');

function read(relPath) {
  return readFileSync(resolve(repoRoot, relPath), 'utf8');
}

const localEnvExample = read('deploy/env/local.env.example');
const matrixCheck = read('scripts/matrix_connection_check.py');
const deployCommon = read('scripts/ops/_deploy_common.sh');
const deployLocal = read('scripts/ops/deploy_local.sh');
const addressRecord = read('docs/user-guide/project_address_record.md');

assert.match(
  localEnvExample,
  /^MATRIX_HOMESERVER_URL=https:\/\/matrix\.dongyudigital\.com$/m,
  'local.env.example must default local tests to the remote Matrix homeserver',
);

assert.match(
  localEnvExample,
  /^SYNAPSE_SERVER_NAME=synapse\.dongyudigital\.com$/m,
  'local.env.example must use the remote Matrix server name',
);

assert.doesNotMatch(
  localEnvExample,
  /ChangeMeLocal2026|ChangeMeCloud2026|SYNAPSE_SERVER_NAME=localhost/u,
  'local.env.example must not keep local Synapse or tracked remote passwords as defaults',
);

assert.match(
  matrixCheck,
  /DEFAULT_REMOTE_HOMESERVER\s*=\s*"https:\/\/matrix\.dongyudigital\.com"/u,
  'matrix_connection_check.py must have an explicit remote Matrix default',
);

assert.match(
  matrixCheck,
  /ensure_test_room\(/u,
  'matrix_connection_check.py must create or resolve a test room instead of requiring stale local generated env',
);

assert.match(
  matrixCheck,
  /room_matches_server_name\(/u,
  'matrix_connection_check.py must reject stale local generated room ids when local tests default to remote Matrix',
);

const envDir = mkdtempSync(resolve(tmpdir(), 'dy-matrix-env-'));
const envPath = resolve(envDir, 'local.env');
writeFileSync(
  envPath,
  [
    'SERVER_PASSWORD=${REMOTE_MATRIX_DROP_PASSWORD:?set REMOTE_MATRIX_DROP_PASSWORD}',
    'MBR_PASSWORD=${REMOTE_MATRIX_MBR_PASSWORD:?set REMOTE_MATRIX_MBR_PASSWORD}',
    '',
  ].join('\n'),
);
const envRead = spawnSync(
  'python3',
  [
    '-c',
    [
      'import importlib.util, json, os, pathlib, sys',
      'spec = importlib.util.spec_from_file_location("matrix_connection_check", "scripts/matrix_connection_check.py")',
      'mod = importlib.util.module_from_spec(spec)',
      'spec.loader.exec_module(mod)',
      'print(json.dumps(mod.read_env_file(pathlib.Path(sys.argv[1])), sort_keys=True))',
    ].join('; '),
    envPath,
  ],
  {
    cwd: repoRoot,
    env: {
      ...process.env,
      REMOTE_MATRIX_DROP_PASSWORD: 'drop-secret-from-env',
      REMOTE_MATRIX_MBR_PASSWORD: 'mbr-secret-from-env',
    },
    encoding: 'utf8',
  },
);
assert.equal(envRead.status, 0, envRead.stderr || envRead.stdout);
assert.deepEqual(JSON.parse(envRead.stdout), {
  MBR_PASSWORD: 'mbr-secret-from-env',
  SERVER_PASSWORD: 'drop-secret-from-env',
});

const staleGeneratedEnv = resolve(envDir, 'local.generated.stale.env');
writeFileSync(
  staleGeneratedEnv,
  [
    'MATRIX_BOOTSTRAP_HOMESERVER_URL=https://matrix.dongyudigital.com',
    'MATRIX_BOOTSTRAP_SERVER_USER=drop',
    'MATRIX_BOOTSTRAP_MBR_USER=mbr',
    'DY_MATRIX_ROOM_ID=!stale:localhost',
    'SERVER_ACCESS_TOKEN=old-local-token',
    'MBR_ACCESS_TOKEN=old-local-token',
    '',
  ].join('\n'),
);
const staleGeneratedCheck = spawnSync(
  'bash',
  [
    '-lc',
    [
      'source scripts/ops/_deploy_common.sh',
      'if validate_generated_matrix_bootstrap "$GENERATED_ENV_FILE"; then exit 7; fi',
    ].join('; '),
  ],
  {
    cwd: repoRoot,
    env: {
      ...process.env,
      GENERATED_ENV_FILE: staleGeneratedEnv,
      MATRIX_HOMESERVER_URL: 'https://matrix.dongyudigital.com',
      SYNAPSE_SERVER_NAME: 'synapse.dongyudigital.com',
      SERVER_USER: 'drop',
      MBR_USER: 'mbr',
      NAMESPACE: 'dongyu',
    },
    encoding: 'utf8',
  },
);
assert.equal(staleGeneratedCheck.status, 0, staleGeneratedCheck.stderr || staleGeneratedCheck.stdout);

const remoteGeneratedEnv = resolve(envDir, 'local.generated.remote.env');
writeFileSync(
  remoteGeneratedEnv,
  [
    'MATRIX_BOOTSTRAP_HOMESERVER_URL=https://matrix.dongyudigital.com',
    'MATRIX_BOOTSTRAP_SERVER_USER=drop',
    'MATRIX_BOOTSTRAP_MBR_USER=mbr',
    'DY_MATRIX_ROOM_ID=!fresh:synapse.dongyudigital.com',
    'SERVER_ACCESS_TOKEN=remote-token',
    'MBR_ACCESS_TOKEN=remote-token',
    '',
  ].join('\n'),
);
const remoteGeneratedCheck = spawnSync(
  'bash',
  ['-lc', 'source scripts/ops/_deploy_common.sh; validate_generated_matrix_bootstrap "$GENERATED_ENV_FILE"'],
  {
    cwd: repoRoot,
    env: {
      ...process.env,
      GENERATED_ENV_FILE: remoteGeneratedEnv,
      MATRIX_HOMESERVER_URL: 'https://matrix.dongyudigital.com',
      SYNAPSE_SERVER_NAME: 'synapse.dongyudigital.com',
      SERVER_USER: 'drop',
      MBR_USER: 'mbr',
      NAMESPACE: 'dongyu',
    },
    encoding: 'utf8',
  },
);
assert.equal(remoteGeneratedCheck.status, 0, remoteGeneratedCheck.stderr || remoteGeneratedCheck.stdout);

assert.match(
  deployCommon,
  /matrix_homeserver_url\(\)/u,
  '_deploy_common.sh must centralize Matrix homeserver selection',
);

assert.match(
  deployCommon,
  /HOMESERVER_URL="\$\(matrix_homeserver_url\)"/u,
  '_deploy_common.sh must write the selected homeserver into ModelTable bootstrap labels',
);

assert.match(
  deployLocal,
  /is_remote_matrix_homeserver/u,
  'deploy_local.sh must detect remote Matrix mode',
);

assert.match(
  deployLocal,
  /Skipping local Synapse/u,
  'deploy_local.sh must not default to local Synapse when remote Matrix is configured',
);

assert.match(
  deployCommon,
  /validate_generated_matrix_bootstrap\(\)/u,
  '_deploy_common.sh must provide generated Matrix bootstrap validation',
);

assert.match(
  deployLocal,
  /if \[ "\$SKIP_MATRIX_BOOTSTRAP" = "1" \]; then[\s\S]*validate_generated_matrix_bootstrap/u,
  'deploy_local.sh must not let forced SKIP_MATRIX_BOOTSTRAP=1 bypass generated env validation',
);

assert.match(
  addressRecord,
  /Local test Matrix homeserver[\s\S]*https:\/\/matrix\.dongyudigital\.com/u,
  'project_address_record.md must document the local-test remote Matrix default',
);

console.log('PASS test_0395_local_tests_remote_matrix_default');
