#!/usr/bin/env node

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..', '..');
const preparePath = resolve(repoRoot, 'scripts/ops/prepare_0457_local_rollback.sh');
const rollbackPath = resolve(repoRoot, 'scripts/ops/rollback_0457_local.sh');
const fakeCliPath = resolve(repoRoot, 'scripts/tests/helpers/fake_0457_rollback_cli.mjs');
const harnessRoot = mkdtempSync(join(tmpdir(), 'dy-0457-rollback-contract-'));
const fakeBin = join(harnessRoot, 'bin');
const exactResidueKeys = [
  'secret/ui-server-secret',
  'configmap/mosquitto-config',
  'deployment/ui-server',
  'service/ui-server',
];
mkdirSync(fakeBin, { recursive: true });
process.on('exit', () => rmSync(harnessRoot, { recursive: true, force: true }));

function writeExecutable(path, source) {
  writeFileSync(path, source, 'utf8');
  chmodSync(path, 0o755);
}

for (const command of ['kubectl', 'docker', 'git', 'ditto', 'df', 'du']) {
  writeExecutable(
    join(fakeBin, command),
    '#!/usr/bin/env bash\nexec node "$DY_0457_FAKE_HELPER" ' + command + ' "$@"\n',
  );
}

function createSqlite(path, marker) {
  mkdirSync(resolve(path, '..'), { recursive: true });
  const source = [
    'import sqlite3,sys',
    'con=sqlite3.connect(sys.argv[1])',
    'con.execute("create table if not exists marker (value text not null)")',
    'con.execute("delete from marker")',
    'con.execute("insert into marker(value) values (?)",(sys.argv[2],))',
    'con.commit()',
    'con.close()',
  ].join(';');
  const result = spawnSync('python3', ['-c', source, path, marker], { encoding: 'utf8' });
  assert.equal(result.status, 0, 'failed to create SQLite fixture: ' + result.stderr);
}

function readSqliteMarker(path) {
  const source = [
    'import sqlite3,sys',
    'con=sqlite3.connect("file:"+sys.argv[1]+"?mode=ro",uri=True)',
    'print(con.execute("select value from marker").fetchone()[0])',
    'con.close()',
  ].join(';');
  const result = spawnSync('python3', ['-c', source, path], { encoding: 'utf8' });
  assert.equal(result.status, 0, 'failed to read SQLite marker: ' + result.stderr);
  return result.stdout.trim();
}

function baseState() {
  return {
    context: 'orbstack',
    dockerContext: 'orbstack',
    namespace: 'dy-0457-test',
    pvcUid: 'pvc-uid-0457',
    pvName: 'pvc-volume-0457',
    pvUid: 'pv-uid-0457',
    claimRefUid: 'pvc-uid-0457',
    helper: null,
    failEvent: null,
    failConsumed: false,
    failRestoreScaleRemaining: 0,
    enospc: false,
    podImageMismatch: null,
    replicas: {
      mosquitto: 1,
      synapse: 1,
      'remote-worker': 1,
      'workspace-manager': 1,
      'mbr-worker': 1,
      'ui-server': 1,
    },
    images: {
      'dy-ui-server:v1': 'sha256:ui-pre',
      'dy-remote-worker:v3': 'sha256:remote-pre',
      'dy-mbr-worker:v2': 'sha256:mbr-pre',
      'ghcr.io/element-hq/synapse:latest': 'sha256:synapse-pre',
      'eclipse-mosquitto:2': 'sha256:mosquitto-pre',
    },
  };
}

function createFixture(name, statePatch = {}) {
  const root = join(harnessRoot, name);
  const repo = join(root, 'repo');
  const persist = join(root, 'persist');
  const pvc = join(root, 'pvc');
  const backups = join(root, 'backups');
  const statePath = join(root, 'state.json');
  const callLog = join(root, 'calls.log');

  mkdirSync(join(repo, '.git'), { recursive: true });
  mkdirSync(join(repo, 'deploy/env'), { recursive: true });
  writeFileSync(join(repo, 'deploy/env/local.env'), 'SNAPSHOT_ENV=pre\n', 'utf8');
  writeFileSync(join(repo, 'deploy/env/local.generated.env'), 'SNAPSHOT_GENERATED=pre\n', 'utf8');

  mkdirSync(join(persist, 'assets'), { recursive: true });
  writeFileSync(join(persist, 'assets/manifest.v0.json'), '{"marker":"pre"}\n', 'utf8');
  writeFileSync(join(persist, 'assets/pre-only.txt'), 'pre\n', 'utf8');
  createSqlite(join(persist, 'ui-server/runtime/default/yhl.db'), 'pre');

  mkdirSync(join(pvc, 'media_store'), { recursive: true });
  createSqlite(join(pvc, 'homeserver.db'), 'pre');
  writeFileSync(join(pvc, 'homeserver.yaml'), 'server_name: local\n', 'utf8');
  writeFileSync(join(pvc, 'log.config'), 'version: 1\n', 'utf8');
  writeFileSync(join(pvc, 'signing.key'), 'test signing key\n', 'utf8');
  writeFileSync(join(pvc, 'media_store/pre.txt'), 'pre\n', 'utf8');
  writeFileSync(callLog, '', 'utf8');

  const state = { ...baseState(), ...statePatch };
  state.replicas = { ...baseState().replicas, ...(statePatch.replicas || {}) };
  state.images = { ...baseState().images, ...(statePatch.images || {}) };
  writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n', 'utf8');

  return { root, repo, persist, pvc, backups, statePath, callLog };
}

function harnessEnv(fixture, options = {}) {
  const env = {
    ...process.env,
    PATH: fakeBin + delimiter + (process.env.PATH || ''),
    DY_0457_FAKE_HELPER: fakeCliPath,
    DY_0457_FAKE_STATE: fixture.statePath,
    DY_0457_FAKE_PVC: fixture.pvc,
    DY_0457_CALL_LOG: fixture.callLog,
  };
  delete env.DY_0457_ROLLBACK_TEST_ONLY;
  delete env.DY_0457_ROLLBACK_TEST_ROOT;
  if (options.testGate !== false) {
    env.DY_0457_ROLLBACK_TEST_ONLY = 'FAKE_ORBSTACK_ONLY';
    env.DY_0457_ROLLBACK_TEST_ROOT = fixture.root;
  }
  return env;
}

function readState(fixture) {
  return JSON.parse(readFileSync(fixture.statePath, 'utf8'));
}

function updateState(fixture, mutate) {
  const state = readState(fixture);
  mutate(state);
  writeFileSync(fixture.statePath, JSON.stringify(state, null, 2) + '\n', 'utf8');
}

function calls(fixture) {
  return readFileSync(fixture.callLog, 'utf8').trim().split(/\r?\n/u).filter(Boolean);
}

function scaleDownCalls(fixture) {
  return calls(fixture).filter((line) => /\bkubectl\b.*\bscale\b.*--replicas=0/u.test(line));
}

function dataMutationCalls(fixture) {
  return calls(fixture).filter((line) => (
    line.startsWith('ditto ')
    || (/\bkubectl\b.*\bexec\b/u.test(line) && /FAILED_NAME=|cat > \/data\/homeserver\.db/u.test(line))
  ));
}

function assertCurrentStatePreserved(fixture, replicas = 2) {
  assert.equal(JSON.parse(readFileSync(join(fixture.persist, 'assets/manifest.v0.json'), 'utf8')).marker, 'current');
  assert.equal(readSqliteMarker(join(fixture.persist, 'ui-server/runtime/default/yhl.db')), 'current');
  assert.equal(readSqliteMarker(join(fixture.pvc, 'homeserver.db')), 'current');
  assert.equal(readFileSync(join(fixture.repo, 'deploy/env/local.env'), 'utf8'), 'SNAPSHOT_ENV=current\n');
  const state = readState(fixture);
  assert.deepEqual(Object.values(state.replicas), [replicas, replicas, replicas, replicas, replicas, replicas]);
  assert.equal(state.images['dy-ui-server:v1'], 'sha256:ui-current');
  assert.equal(state.images['dy-remote-worker:v3'], 'sha256:remote-current');
  assert.equal(state.images['dy-mbr-worker:v2'], 'sha256:mbr-current');
  assert.equal(state.images['ghcr.io/element-hq/synapse:latest'], 'sha256:synapse-current');
  assert.equal(state.images['eclipse-mosquitto:2'], 'sha256:mosquitto-current');
  assert.equal(state.helper, null);
}

function assertRetainedFailClosedTransaction(fixture, result) {
  const output = result.stdout + result.stderr;
  assert.match(output, /pre-attempt recovery was incomplete/u);
  assert.match(output, /recovery remains fail-closed with deployments quiesced/u);
  assert.deepEqual(Object.values(readState(fixture).replicas), [0, 0, 0, 0, 0, 0]);
  const retained = output.match(/TRANSACTION EVIDENCE RETAINED: (.+)/u);
  assert.ok(retained, 'transaction evidence path was not reported');
  const retainedPath = retained[1].trim();
  assert.ok(existsSync(retainedPath), 'retained transaction evidence directory is missing');
  return retainedPath;
}

function refreshBackupChecksum(backup, relativePath) {
  const absolutePath = join(backup, relativePath);
  const digest = createHash('sha256').update(readFileSync(absolutePath)).digest('hex');
  const checksumPath = join(backup, 'checksums.sha256');
  const entry = './' + relativePath;
  const lines = readFileSync(checksumPath, 'utf8').trimEnd().split(/\r?\n/u);
  const index = lines.findIndex((line) => line.endsWith('  ' + entry));
  assert.ok(index >= 0, 'checksum entry missing: ' + entry);
  lines[index] = digest + '  ' + entry;
  writeFileSync(checksumPath, lines.join('\n') + '\n', 'utf8');
}

function runPrepare(fixture, options = {}) {
  const args = [
    preparePath,
    '--apply',
    '--confirm', 'PREPARE-0457',
    '--repo-root', fixture.repo,
    '--backup-base', options.backupBase || fixture.backups,
    '--persist-root', fixture.persist,
    '--namespace', 'dy-0457-test',
    '--baseline-sha', 'fake-baseline',
    ...(options.extraArgs || []),
  ];
  return spawnSync('bash', args, {
    cwd: repoRoot,
    env: harnessEnv(fixture),
    encoding: 'utf8',
    timeout: 90000,
  });
}

function preparedBackup(fixture) {
  const entries = existsSync(fixture.backups) ? readdirSync(fixture.backups) : [];
  assert.equal(entries.length, 1, 'expected one prepared backup, got ' + JSON.stringify(entries));
  return join(fixture.backups, entries[0]);
}

function runVerify(fixture, backup) {
  return spawnSync('bash', [
    preparePath,
    '--verify', backup,
    '--repo-root', fixture.repo,
    '--backup-base', fixture.backups,
    '--persist-root', fixture.persist,
    '--namespace', 'dy-0457-test',
  ], {
    cwd: repoRoot,
    env: harnessEnv(fixture),
    encoding: 'utf8',
    timeout: 90000,
  });
}

function runRollback(fixture, backup, extraArgs = []) {
  return spawnSync('bash', [
    rollbackPath,
    '--backup', backup,
    '--apply',
    '--confirm', 'ROLLBACK-0457',
    ...extraArgs,
  ], {
    cwd: repoRoot,
    env: harnessEnv(fixture),
    encoding: 'utf8',
    timeout: 90000,
  });
}

function runRollbackDryRun(fixture, backup, extraArgs = []) {
  return spawnSync('bash', [
    rollbackPath,
    '--backup', backup,
    ...extraArgs,
  ], {
    cwd: repoRoot,
    env: harnessEnv(fixture),
    encoding: 'utf8',
    timeout: 90000,
  });
}

function mutatePostSnapshotState(fixture, replicas = 2) {
  writeFileSync(join(fixture.repo, 'deploy/env/local.env'), 'SNAPSHOT_ENV=current\n', 'utf8');
  writeFileSync(join(fixture.repo, 'deploy/env/local.generated.env'), 'SNAPSHOT_GENERATED=current\n', 'utf8');
  writeFileSync(join(fixture.persist, 'assets/manifest.v0.json'), '{"marker":"current"}\n', 'utf8');
  writeFileSync(join(fixture.persist, 'assets/current-only.txt'), 'current\n', 'utf8');
  createSqlite(join(fixture.persist, 'ui-server/runtime/default/yhl.db'), 'current');
  createSqlite(join(fixture.pvc, 'homeserver.db'), 'current');
  writeFileSync(join(fixture.pvc, 'media_store/current.txt'), 'current\n', 'utf8');
  updateState(fixture, (state) => {
    for (const name of Object.keys(state.replicas)) state.replicas[name] = replicas;
    state.images['dy-ui-server:v1'] = 'sha256:ui-current';
    state.images['dy-remote-worker:v3'] = 'sha256:remote-current';
    state.images['dy-mbr-worker:v2'] = 'sha256:mbr-current';
    state.images['ghcr.io/element-hq/synapse:latest'] = 'sha256:synapse-current';
    state.images['eclipse-mosquitto:2'] = 'sha256:mosquitto-current';
  });
}

const prepare = readFileSync(preparePath, 'utf8');
const rollback = readFileSync(rollbackPath, 'utf8');
const cases = [];

function contract(name, fn) {
  cases.push([name, fn]);
}

contract('scripts and fake behavior helper have valid syntax', () => {
  for (const script of [preparePath, rollbackPath]) {
    const result = spawnSync('bash', ['-n', script], { encoding: 'utf8' });
    assert.equal(result.status, 0, script + ' bash -n failed: ' + result.stderr);
  }
  const helper = spawnSync('node', ['--check', fakeCliPath], { encoding: 'utf8' });
  assert.equal(helper.status, 0, 'fake helper syntax failed: ' + helper.stderr);
});

contract('prepare hardens identity, path, image, capacity, and quiesced backup boundaries', () => {
  assert.match(prepare, /dy\.0457\.local-rollback\.v2/u);
  for (const token of ['pvc_uid', 'pv_name', 'pv_uid', 'claim_ref', 'assert_path_topology', 'check_backup_disk_capacity']) {
    assert.match(prepare, new RegExp(token, 'u'), 'prepare missing ' + token);
  }
  for (const app of ['ui-server', 'remote-worker', 'workspace-manager', 'mbr-worker', 'synapse', 'mosquitto']) {
    assert.match(prepare, new RegExp('assert_pod_image_matches_local ' + app, 'u'));
  }
  assert.match(prepare, /quiesce_snapshot_deployments/u);
  assert.match(prepare, /snapshot data copy requires confirmed pod quiescence/u);
  assert.match(prepare, /synapse-0457-backup/u);
  assert.match(prepare, /src\.backup\(dst/u);
  assert.match(prepare, /restore_quiesced_replicas/u);
  assert.doesNotMatch(prepare, /at least 3 GiB/u);
});

contract('rollback is fail-closed on snapshot overrides and live volume identity', () => {
  for (const token of [
    'repo-root override must exactly match',
    'persist-root override must exactly match',
    'namespace override must exactly match',
    'verify_live_volume_identity',
    'live Synapse PVC identity drift detected',
    'live Synapse PV identity drift detected',
  ]) {
    assert.match(rollback, new RegExp(token, 'u'), 'rollback missing ' + token);
  }
  assert.match(rollback, /synapse_volume\.pvc_uid/u);
  assert.match(rollback, /synapse_volume\.pv_uid/u);
  assert.match(rollback, /synapse_volume\.claim_ref/u);
  const resourcePreflight = rollback.slice(
    rollback.indexOf('preflight_resources()'),
    rollback.indexOf('preflight_host_restore_capacity()'),
  );
  assert.doesNotMatch(resourcePreflight, /get pod -l app=synapse/u);
  assert.match(rollback, /preflight_synapse_restore_capacity[\s\S]*exec "\$RESTORE_HELPER"/u);
});

contract('rollback has a transaction recovery state machine', () => {
  for (const token of [
    'capture_transaction_state',
    'recover_failed_rollback',
    'recover_synapse_state',
    'recover_host_tree',
    'replicas.tsv',
    'image-ids.tsv',
    'ROLLBACK_ACTIVE',
  ]) {
    assert.match(rollback, new RegExp(token, 'u'), 'rollback missing ' + token);
  }
  assert.doesNotMatch(rollback, /kubectl[^\n]*delete[^\n]*(?:pvc|pv|synapse-data)/u);
  assert.doesNotMatch(rollback, /rm -rf[^\n]*(?:persist\/assets|persist\/ui-server|synapse-data)/u);
  const applySource = rollback.slice(rollback.indexOf('apply_rollback()'), rollback.indexOf('print_dry_run_plan()'));
  const captureIndex = applySource.indexOf('capture_transaction_state');
  const activeIndex = applySource.indexOf('ROLLBACK_ACTIVE=1');
  const quiesceIndex = applySource.indexOf('quiesce_deployments');
  const loadIndex = applySource.indexOf('docker load');
  const loadedVerificationIndex = applySource.indexOf('verify_loaded_images');
  assert.ok(
    captureIndex >= 0
      && captureIndex < activeIndex
      && activeIndex < quiesceIndex
      && quiesceIndex < loadIndex
      && loadIndex < loadedVerificationIndex,
    'transaction capture and active recovery gate must precede quiesce, docker load, and loaded-image verification',
  );
  const transactionCapture = rollback.slice(
    rollback.indexOf('capture_transaction_state()'),
    rollback.indexOf('cleanup_restore_helper()'),
  );
  for (const image of [
    'dy-ui-server:v1',
    'dy-remote-worker:v3',
    'dy-mbr-worker:v2',
    'ghcr.io/element-hq/synapse:latest',
    'eclipse-mosquitto:2',
  ]) {
    assert.match(transactionCapture, new RegExp(image.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'));
  }
});

contract('confirmation refusals are observational', () => {
  const fixture = createFixture('confirmation-refusal');
  const prepareResult = spawnSync('bash', [preparePath, '--apply'], {
    cwd: repoRoot,
    env: harnessEnv(fixture),
    encoding: 'utf8',
  });
  assert.notEqual(prepareResult.status, 0);
  assert.deepEqual(calls(fixture), []);
  const rollbackResult = spawnSync('bash', [
    rollbackPath, '--backup', join(fixture.root, 'missing'), '--apply',
  ], {
    cwd: repoRoot,
    env: harnessEnv(fixture),
    encoding: 'utf8',
  });
  assert.notEqual(rollbackResult.status, 0);
  assert.deepEqual(calls(fixture), []);
});

contract('real execution scope is locked and fixtures require the explicit temp gate', () => {
  const fixture = createFixture('execution-scope-lock');
  const prepareResult = spawnSync('bash', [
    preparePath,
    '--dry-run',
    '--repo-root', fixture.repo,
    '--backup-base', fixture.backups,
    '--persist-root', fixture.persist,
    '--namespace', 'dy-0457-test',
  ], {
    cwd: repoRoot,
    env: harnessEnv(fixture, { testGate: false }),
    encoding: 'utf8',
  });
  assert.notEqual(prepareResult.status, 0);
  assert.match(prepareResult.stderr, /execution scope must use namespace=dongyu/u);
  assert.deepEqual(scaleDownCalls(fixture), []);

  assert.equal(runPrepare(fixture).status, 0);
  const backup = preparedBackup(fixture);
  writeFileSync(fixture.callLog, '', 'utf8');
  const rollbackResult = spawnSync('bash', [
    rollbackPath,
    '--backup', backup,
    '--apply',
    '--confirm', 'ROLLBACK-0457',
  ], {
    cwd: repoRoot,
    env: harnessEnv(fixture, { testGate: false }),
    encoding: 'utf8',
  });
  assert.notEqual(rollbackResult.status, 0);
  assert.match(rollbackResult.stderr, /execution scope must use namespace=dongyu/u);
  assert.deepEqual(scaleDownCalls(fixture), []);
});

contract('prepare fake full path succeeds and restores all quiesced replicas', () => {
  const fixture = createFixture('prepare-success');
  const result = runPrepare(fixture);
  assert.equal(result.status, 0, 'prepare success failed: stdout=' + result.stdout + ' stderr=' + result.stderr);
  const backup = preparedBackup(fixture);
  const snapshot = JSON.parse(readFileSync(join(backup, 'snapshot.json'), 'utf8'));
  assert.equal(snapshot.format, 'dy.0457.local-rollback.v2');
  assert.equal(snapshot.synapse_volume.pvc_uid, 'pvc-uid-0457');
  assert.equal(snapshot.synapse_volume.pv_uid, 'pv-uid-0457');
  assert.equal(snapshot.synapse_volume.claim_ref.uid, 'pvc-uid-0457');
  assert.equal(readSqliteMarker(join(backup, 'synapse/homeserver.db')), 'pre');
  assert.equal(readSqliteMarker(join(backup, 'ui-server/runtime/default/yhl.db')), 'pre');
  assert.deepEqual(Object.values(readState(fixture).replicas), [1, 1, 1, 1, 1, 1]);
  assert.equal(readState(fixture).helper, null);
  const commandLog = calls(fixture);
  const firstDataCopy = commandLog.findIndex((line) => line.startsWith('ditto '));
  assert.ok(firstDataCopy > 0, 'snapshot data copy was not observed');
  for (const deployment of ['ui-server', 'mbr-worker', 'synapse']) {
    const confirmations = commandLog
      .slice(0, firstDataCopy)
      .filter((line) => line.includes('get pod -l app=' + deployment + ' -o name'));
    assert.equal(confirmations.length, 2, deployment + ' must be checked before and after any delete wait');
  }
});

contract('post-deploy snapshot verify uses frozen archive metadata and pre-0457 aliases', () => {
  const fixture = createFixture('prepare-post-deploy-verify');
  assert.equal(runPrepare(fixture).status, 0);
  const backup = preparedBackup(fixture);
  mutatePostSnapshotState(fixture, 1);

  const postDeploy = runVerify(fixture, backup);
  assert.equal(
    postDeploy.status,
    0,
    'post-deploy snapshot verify must ignore intentionally changed active image tags: stdout='
      + postDeploy.stdout + ' stderr=' + postDeploy.stderr,
  );
  assert.match(postDeploy.stdout, /snapshot verified/u);

  updateState(fixture, (state) => {
    state.images['dy-ui-server:pre-0457-e0c48fa'] = 'sha256:wrong-alias';
  });
  const wrongAlias = runVerify(fixture, backup);
  assert.notEqual(wrongAlias.status, 0, 'a changed pre-0457 alias must fail verification');
  assert.match(wrongAlias.stderr, /snapshot image alias mismatch/u);

  updateState(fixture, (state) => {
    state.images['dy-ui-server:pre-0457-e0c48fa'] = 'sha256:ui-pre';
  });
  const imageIdsPath = join(backup, 'images/image-ids.tsv');
  const originalImageIds = readFileSync(imageIdsPath, 'utf8');
  const mismatchedImageIds = originalImageIds.replace(
    'dy-ui-server:v1\tsha256:ui-pre',
    'dy-ui-server:v1\tsha256:remote-pre',
  );
  assert.notEqual(mismatchedImageIds, originalImageIds, 'image ID fixture replacement must apply');
  writeFileSync(imageIdsPath, mismatchedImageIds, 'utf8');
  refreshBackupChecksum(backup, 'images/image-ids.tsv');
  const wrongMapping = runVerify(fixture, backup);
  assert.notEqual(wrongMapping.status, 0, 'a mismatched active-to-alias snapshot mapping must fail');
  assert.match(wrongMapping.stderr, /snapshot image ID mapping mismatch/u);

  writeFileSync(imageIdsPath, originalImageIds, 'utf8');
  refreshBackupChecksum(backup, 'images/image-ids.tsv');
  const imageMetadataPath = join(backup, 'images/images.json');
  const imageMetadata = JSON.parse(readFileSync(imageMetadataPath, 'utf8'));
  writeFileSync(
    imageMetadataPath,
    JSON.stringify(imageMetadata.filter((record) => record.Id !== 'sha256:synapse-pre')) + '\n',
    'utf8',
  );
  refreshBackupChecksum(backup, 'images/images.json');
  const missingFrozenMetadata = runVerify(fixture, backup);
  assert.notEqual(missingFrozenMetadata.status, 0, 'an image ID absent from frozen metadata must fail');
  assert.match(missingFrozenMetadata.stderr, /snapshot image ID missing from frozen metadata/u);
});

contract('snapshot verify rejects swapped Synapse and Mosquitto TSV image IDs', () => {
  const fixture = createFixture('prepare-swapped-infra-image-ids');
  const prepared = runPrepare(fixture);
  assert.equal(
    prepared.status,
    0,
    'prepare failed: stdout=' + prepared.stdout + ' stderr=' + prepared.stderr,
  );
  const backup = preparedBackup(fixture);
  const imageIdsPath = join(backup, 'images/image-ids.tsv');
  const rows = readFileSync(imageIdsPath, 'utf8').trimEnd().split(/\r?\n/u).map((line) => line.split('\t'));
  const synapse = rows.find(([tag]) => tag === 'ghcr.io/element-hq/synapse:latest');
  const mosquitto = rows.find(([tag]) => tag === 'eclipse-mosquitto:2');
  assert.ok(synapse && mosquitto, 'infrastructure image rows must exist');
  const synapseId = synapse[1];
  const mosquittoId = mosquitto[1];
  synapse[1] = mosquitto[1];
  mosquitto[1] = synapseId;
  writeFileSync(imageIdsPath, rows.map((row) => row.join('\t')).join('\n') + '\n', 'utf8');
  refreshBackupChecksum(backup, 'images/image-ids.tsv');

  const result = runVerify(fixture, backup);
  assert.notEqual(
    result.status,
    0,
    'swapping infrastructure expected IDs must fail closed: stdout='
      + result.stdout + ' stderr=' + result.stderr,
  );

  writeFileSync(imageIdsPath, rows.map(([tag, id]) => {
    if (tag === 'ghcr.io/element-hq/synapse:latest') return [tag, synapseId].join('\t');
    if (tag === 'eclipse-mosquitto:2') return [tag, mosquittoId].join('\t');
    return [tag, id].join('\t');
  }).join('\n') + '\n', 'utf8');
  refreshBackupChecksum(backup, 'images/image-ids.tsv');

  const imageMetadataPath = join(backup, 'images/images.json');
  const originalImageMetadata = JSON.parse(readFileSync(imageMetadataPath, 'utf8'));
  const swappedImageMetadata = structuredClone(originalImageMetadata);
  const synapseImage = swappedImageMetadata.find((record) => record.Id === synapseId);
  const mosquittoImage = swappedImageMetadata.find((record) => record.Id === mosquittoId);
  assert.ok(synapseImage && mosquittoImage, 'infrastructure metadata records must exist');
  const synapseTags = synapseImage.RepoTags;
  synapseImage.RepoTags = mosquittoImage.RepoTags;
  mosquittoImage.RepoTags = synapseTags;
  writeFileSync(imageMetadataPath, JSON.stringify(swappedImageMetadata) + '\n', 'utf8');
  refreshBackupChecksum(backup, 'images/images.json');
  const wrongRepoTags = runVerify(fixture, backup);
  assert.notEqual(wrongRepoTags.status, 0, 'swapped RepoTags must fail exact image binding');
  assert.match(wrongRepoTags.stderr, /snapshot image metadata binding mismatch/u);

  writeFileSync(imageMetadataPath, JSON.stringify(originalImageMetadata) + '\n', 'utf8');
  refreshBackupChecksum(backup, 'images/images.json');
  const snapshotPath = join(backup, 'snapshot.json');
  const snapshot = JSON.parse(readFileSync(snapshotPath, 'utf8'));
  snapshot.images['ghcr.io/element-hq/synapse:latest'] = mosquittoId;
  writeFileSync(snapshotPath, JSON.stringify(snapshot) + '\n', 'utf8');
  refreshBackupChecksum(backup, 'snapshot.json');
  const wrongSnapshotManifest = runVerify(fixture, backup);
  assert.notEqual(wrongSnapshotManifest.status, 0, 'snapshot.json must bind the exact active image ID');
  assert.match(wrongSnapshotManifest.stderr, /snapshot manifest image binding mismatch/u);
});

contract('prepare rejects string RepoTags that could masquerade as an exact tag array', () => {
  const fixture = createFixture('prepare-repotags-string');
  const prepared = runPrepare(fixture);
  assert.equal(
    prepared.status,
    0,
    'prepare failed: stdout=' + prepared.stdout + ' stderr=' + prepared.stderr,
  );
  const backup = preparedBackup(fixture);
  const imageMetadataPath = join(backup, 'images/images.json');
  const imageMetadata = JSON.parse(readFileSync(imageMetadataPath, 'utf8'));
  const synapseImage = imageMetadata.find((record) => record.Id === 'sha256:synapse-pre');
  assert.ok(synapseImage, 'Synapse metadata record must exist');
  synapseImage.RepoTags = 'ghcr.io/element-hq/synapse:latest';
  writeFileSync(imageMetadataPath, JSON.stringify(imageMetadata) + '\n', 'utf8');
  refreshBackupChecksum(backup, 'images/images.json');

  const result = runVerify(fixture, backup);
  assert.notEqual(result.status, 0, 'RepoTags string must not satisfy exact image binding');
  assert.match(result.stderr, /snapshot image metadata is invalid/u);
});

contract('rollback apply rejects corrupt frozen image bindings before any mutation', () => {
  const fixture = createFixture('rollback-corrupt-frozen-image-bindings');
  const prepared = runPrepare(fixture);
  assert.equal(
    prepared.status,
    0,
    'prepare failed: stdout=' + prepared.stdout + ' stderr=' + prepared.stderr,
  );
  const backup = preparedBackup(fixture);
  mutatePostSnapshotState(fixture, 2);

  const imageMetadataPath = join(backup, 'images/images.json');
  const snapshotPath = join(backup, 'snapshot.json');
  const originalImageMetadata = readFileSync(imageMetadataPath, 'utf8');
  const originalSnapshot = readFileSync(snapshotPath, 'utf8');

  function assertRejectedBeforeMutation(expectedError) {
    for (const [mode, run] of [
      ['dry-run', runRollbackDryRun],
      ['apply', runRollback],
    ]) {
      writeFileSync(fixture.callLog, '', 'utf8');
      const result = run(fixture, backup);
      assert.notEqual(
        result.status,
        0,
        `${mode}: corrupt snapshot unexpectedly reached rollback: stdout=${result.stdout} stderr=${result.stderr}`,
      );
      assert.match(result.stderr, expectedError, `${mode}: exact semantic preflight failure`);
      assert.equal(calls(fixture).some((line) => line.startsWith('docker load ')), false, `${mode}: docker load`);
      assert.deepEqual(scaleDownCalls(fixture), [], `${mode}: scale down`);
      assert.deepEqual(dataMutationCalls(fixture), [], `${mode}: data mutation`);
    }
  }

  rmSync(imageMetadataPath);
  assertRejectedBeforeMutation(/backup artifact missing or empty: images\/images\.json/u);
  writeFileSync(imageMetadataPath, originalImageMetadata, 'utf8');

  const stringRepoTags = JSON.parse(originalImageMetadata);
  const stringSynapse = stringRepoTags.find((record) => record.Id === 'sha256:synapse-pre');
  assert.ok(stringSynapse, 'Synapse metadata record must exist');
  stringSynapse.RepoTags = 'ghcr.io/element-hq/synapse:latest';
  writeFileSync(imageMetadataPath, JSON.stringify(stringRepoTags) + '\n', 'utf8');
  refreshBackupChecksum(backup, 'images/images.json');
  assertRejectedBeforeMutation(/snapshot image metadata is invalid/u);

  const swappedRepoTags = JSON.parse(originalImageMetadata);
  const swappedSynapse = swappedRepoTags.find((record) => record.Id === 'sha256:synapse-pre');
  const swappedMosquitto = swappedRepoTags.find((record) => record.Id === 'sha256:mosquitto-pre');
  assert.ok(swappedSynapse && swappedMosquitto, 'infrastructure metadata records must exist');
  const synapseTags = swappedSynapse.RepoTags;
  swappedSynapse.RepoTags = swappedMosquitto.RepoTags;
  swappedMosquitto.RepoTags = synapseTags;
  writeFileSync(imageMetadataPath, JSON.stringify(swappedRepoTags) + '\n', 'utf8');
  refreshBackupChecksum(backup, 'images/images.json');
  assertRejectedBeforeMutation(/snapshot image metadata binding mismatch/u);

  writeFileSync(imageMetadataPath, originalImageMetadata, 'utf8');
  refreshBackupChecksum(backup, 'images/images.json');
  const wrongSnapshot = JSON.parse(originalSnapshot);
  wrongSnapshot.images['ghcr.io/element-hq/synapse:latest'] = 'sha256:mosquitto-pre';
  writeFileSync(snapshotPath, JSON.stringify(wrongSnapshot) + '\n', 'utf8');
  refreshBackupChecksum(backup, 'snapshot.json');
  assertRejectedBeforeMutation(/snapshot manifest image binding mismatch/u);
});

contract('prepare partial scale failure restores replicas before any data copy', () => {
  const fixture = createFixture('prepare-partial-scale', { failScaleDownAt: 2 });
  const result = runPrepare(fixture);
  assert.notEqual(result.status, 0);
  assert.match(result.stdout + result.stderr, /injected_failure:partial_scale_down/u);
  assert.deepEqual(Object.values(readState(fixture).replicas), [1, 1, 1, 1, 1, 1]);
  assert.deepEqual(dataMutationCalls(fixture), []);
});

contract('prepare delayed pod termination blocks data copy and restores replicas', () => {
  const fixture = createFixture('prepare-delayed-termination', { delayedTerminationApp: 'synapse' });
  const result = runPrepare(fixture);
  assert.notEqual(result.status, 0);
  assert.match(result.stdout + result.stderr, /injected_failure:delayed_termination/u);
  assert.deepEqual(Object.values(readState(fixture).replicas), [1, 1, 1, 1, 1, 1]);
  assert.deepEqual(dataMutationCalls(fixture), []);
});

contract('prepare rejects backup overlap in either containment direction before scale', () => {
  const fixture = createFixture('prepare-overlap');
  const result = runPrepare(fixture, {
    backupBase: join(fixture.persist, 'assets', 'nested-backups'),
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /path_overlap/u);
  assert.deepEqual(scaleDownCalls(fixture), []);
});

contract('prepare ENOSPC preflight uses estimated size and fails before scale', () => {
  const fixture = createFixture('prepare-enospc', { enospc: true });
  const result = runPrepare(fixture);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /insufficient backup space/u);
  assert.deepEqual(scaleDownCalls(fixture), []);
});

contract('prepare rejects Synapse live/local image mismatch before scale', () => {
  const fixture = createFixture('prepare-image-mismatch', { podImageMismatch: 'synapse' });
  const result = runPrepare(fixture);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /pod imageID does not match local image/u);
  assert.deepEqual(scaleDownCalls(fixture), []);
});

contract('prepare replica restore failure is not swallowed and EXIT trap retries recovery', () => {
  const fixture = createFixture('prepare-restore-failure', { failRestoreScaleRemaining: 3 });
  const result = runPrepare(fixture);
  assert.notEqual(result.status, 0, 'restore failure must remain visible');
  assert.match(result.stdout + result.stderr, /injected_failure:restore_scale/u);
  assert.deepEqual(Object.values(readState(fixture).replicas), [1, 1, 1, 1, 1, 1]);
});

contract('rollback fake full path restores snapshot data and saved replicas', () => {
  const fixture = createFixture('rollback-success');
  const prepareResult = runPrepare(fixture);
  assert.equal(prepareResult.status, 0, prepareResult.stderr);
  const backup = preparedBackup(fixture);
  mutatePostSnapshotState(fixture, 2);
  writeFileSync(fixture.callLog, '', 'utf8');

  const result = runRollback(fixture, backup);
  assert.equal(result.status, 0, 'rollback success failed: stdout=' + result.stdout + ' stderr=' + result.stderr);
  assert.equal(JSON.parse(readFileSync(join(fixture.persist, 'assets/manifest.v0.json'), 'utf8')).marker, 'pre');
  assert.equal(readSqliteMarker(join(fixture.persist, 'ui-server/runtime/default/yhl.db')), 'pre');
  assert.equal(readSqliteMarker(join(fixture.pvc, 'homeserver.db')), 'pre');
  assert.equal(readFileSync(join(fixture.repo, 'deploy/env/local.env'), 'utf8'), 'SNAPSHOT_ENV=pre\n');
  assert.deepEqual(Object.values(readState(fixture).replicas), [1, 1, 1, 1, 1, 1]);
  assert.equal(readState(fixture).helper, null);
  assert.ok(readdirSync(fixture.persist).some((name) => name.startsWith('assets.failed-before-rollback-')));
  assert.ok(readdirSync(fixture.persist).some((name) => name.startsWith('ui-server.failed-before-rollback-')));

  const commandLog = calls(fixture);
  const loadIndex = commandLog.findIndex((line) => line.startsWith('docker load '));
  const quiesceIndexes = commandLog
    .map((line, index) => (/\bkubectl\b.*\bscale\b.*--replicas=0/u.test(line) ? index : -1))
    .filter((index) => index >= 0);
  assert.equal(quiesceIndexes.length, 6, 'all six deployments must be quiesced before archive loading');
  assert.equal(
    quiesceIndexes.every((index) => index < loadIndex),
    true,
    'docker load must not mutate local image aliases until all deployments have been scaled to zero',
  );
});

contract('rollback frozen preflight self-recovers missing live aliases while post-deploy audit remains strict', () => {
  const fixture = createFixture('rollback-missing-live-aliases');
  const prepared = runPrepare(fixture);
  assert.equal(prepared.status, 0, prepared.stderr);
  const backup = preparedBackup(fixture);
  mutatePostSnapshotState(fixture, 2);
  updateState(fixture, (state) => {
    delete state.images['dy-ui-server:pre-0457-e0c48fa'];
    state.images['dy-remote-worker:pre-0457-e0c48fa'] = 'sha256:remote-drifted-alias';
    delete state.images['dy-mbr-worker:pre-0457-e0c48fa'];
  });

  const audit = runVerify(fixture, backup);
  assert.notEqual(audit.status, 0, 'the explicit live-alias audit must continue to detect drift');
  assert.match(audit.stderr, /snapshot image alias mismatch/u);

  writeFileSync(fixture.callLog, '', 'utf8');
  const dryRun = runRollbackDryRun(fixture, backup);
  assert.equal(
    dryRun.status,
    0,
    'rollback dry-run must trust the frozen archive binding instead of requiring recoverable live aliases: '
      + dryRun.stderr,
  );
  assert.equal(calls(fixture).some((line) => line.startsWith('docker load ')), false);
  assert.deepEqual(scaleDownCalls(fixture), []);

  writeFileSync(fixture.callLog, '', 'utf8');
  const result = runRollback(fixture, backup);
  assert.equal(
    result.status,
    0,
    'rollback apply must be able to restore missing or drifted aliases from the verified archive: '
      + result.stderr,
  );
  assert.equal(readState(fixture).images['dy-ui-server:pre-0457-e0c48fa'], 'sha256:ui-pre');
  assert.equal(readState(fixture).images['dy-remote-worker:pre-0457-e0c48fa'], 'sha256:remote-pre');
  assert.equal(readState(fixture).images['dy-mbr-worker:pre-0457-e0c48fa'], 'sha256:mbr-pre');
});

contract('rollback preflight and PVC capacity do not require a usable current Synapse pod', () => {
  const fixture = createFixture('rollback-no-current-synapse-pod');
  assert.equal(runPrepare(fixture).status, 0);
  const backup = preparedBackup(fixture);
  mutatePostSnapshotState(fixture, 2);
  updateState(fixture, (state) => {
    state.currentSynapsePodUnavailable = true;
    state.failCurrentSynapseExec = true;
  });
  writeFileSync(fixture.callLog, '', 'utf8');

  const result = runRollback(fixture, backup);
  assert.equal(result.status, 0, 'pod-independent rollback failed: stdout=' + result.stdout + ' stderr=' + result.stderr);
  const commandLog = calls(fixture);
  const loadIndex = commandLog.findIndex((line) => line.startsWith('docker load '));
  const preMutationLog = commandLog.slice(0, loadIndex);
  assert.ok(preMutationLog.some((line) => /exec synapse-0457-restore .*df -Pk \/data/u.test(line)),
    'PVC free-space check did not use the restore helper');
  assert.equal(preMutationLog.some((line) => /exec synapse-0(?:\s|$)/u.test(line)), false,
    'rollback preflight unexpectedly execed the current Synapse pod');
});

contract('rollback partial scale failure restores all replicas and five image tags without touching data', () => {
  const fixture = createFixture('rollback-partial-scale');
  assert.equal(runPrepare(fixture).status, 0);
  const backup = preparedBackup(fixture);
  mutatePostSnapshotState(fixture, 2);
  updateState(fixture, (state) => {
    state.scaleDownCount = 0;
    state.failScaleDownAt = 3;
  });
  writeFileSync(fixture.callLog, '', 'utf8');

  const result = runRollback(fixture, backup);
  assert.notEqual(result.status, 0);
  assert.match(result.stdout + result.stderr, /injected_failure:partial_scale_down/u);
  assert.match(result.stdout + result.stderr, /pre-attempt state recovery completed/u);
  assertCurrentStatePreserved(fixture, 2);
  assert.deepEqual(dataMutationCalls(fixture), []);
});

contract('image-tag recovery failure keeps all deployments stopped and retains transaction evidence', () => {
  const fixture = createFixture('rollback-image-tag-recovery-failure');
  assert.equal(runPrepare(fixture).status, 0);
  const backup = preparedBackup(fixture);
  mutatePostSnapshotState(fixture, 2);
  updateState(fixture, (state) => {
    state.scaleDownCount = 0;
    state.failScaleDownAt = 3;
    state.failRecoveryImageTagRemaining = 1;
  });
  writeFileSync(fixture.callLog, '', 'utf8');

  const result = runRollback(fixture, backup);
  assert.notEqual(result.status, 0);
  assert.match(result.stdout + result.stderr, /injected_failure:image_tag_recovery/u);
  const retainedPath = assertRetainedFailClosedTransaction(fixture, result);
  assert.equal((result.stdout + result.stderr).includes('pre-attempt state recovery completed'), false);
  rmSync(retainedPath, { recursive: true, force: true });
});

contract('replica recovery failure immediately returns every deployment to zero', () => {
  const fixture = createFixture('rollback-replica-recovery-failure');
  assert.equal(runPrepare(fixture).status, 0);
  const backup = preparedBackup(fixture);
  mutatePostSnapshotState(fixture, 2);
  updateState(fixture, (state) => {
    state.scaleDownCount = 0;
    state.failScaleDownAt = 3;
    state.failRestoreScaleRemaining = 3;
  });
  writeFileSync(fixture.callLog, '', 'utf8');

  const result = runRollback(fixture, backup);
  assert.notEqual(result.status, 0);
  assert.match(result.stdout + result.stderr, /injected_failure:restore_scale/u);
  const retainedPath = assertRetainedFailClosedTransaction(fixture, result);
  rmSync(retainedPath, { recursive: true, force: true });
});

contract('helper cleanup failure blocks replica recovery in the no-data branch', () => {
  const fixture = createFixture('rollback-helper-cleanup-failure');
  assert.equal(runPrepare(fixture).status, 0);
  const backup = preparedBackup(fixture);
  mutatePostSnapshotState(fixture, 2);
  updateState(fixture, (state) => {
    state.failHelperCleanupRemaining = 9;
  });
  writeFileSync(fixture.callLog, '', 'utf8');

  const result = runRollback(fixture, backup);
  assert.notEqual(result.status, 0);
  assert.match(result.stdout + result.stderr, /injected_failure:helper_cleanup/u);
  const retainedPath = assertRetainedFailClosedTransaction(fixture, result);
  assert.equal(readState(fixture).helper, 'synapse-0457-restore');
  rmSync(retainedPath, { recursive: true, force: true });
});

contract('rollback delayed pod termination blocks all data mutation and restores current state', () => {
  const fixture = createFixture('rollback-delayed-termination');
  assert.equal(runPrepare(fixture).status, 0);
  const backup = preparedBackup(fixture);
  mutatePostSnapshotState(fixture, 2);
  updateState(fixture, (state) => {
    state.delayedTerminationApp = 'synapse';
    state.delayedTerminationConsumed = false;
  });
  writeFileSync(fixture.callLog, '', 'utf8');

  const result = runRollback(fixture, backup);
  assert.notEqual(result.status, 0);
  assert.match(result.stdout + result.stderr, /injected_failure:delayed_termination/u);
  assert.match(result.stdout + result.stderr, /pre-attempt state recovery completed/u);
  assertCurrentStatePreserved(fixture, 2);
  assert.deepEqual(dataMutationCalls(fixture), []);
});

contract('rollback recovers all five active image tags when docker load fails after mutation', () => {
  const fixture = createFixture('rollback-docker-load-failure');
  assert.equal(runPrepare(fixture).status, 0);
  const backup = preparedBackup(fixture);
  mutatePostSnapshotState(fixture, 2);
  updateState(fixture, (state) => {
    state.failEvent = 'docker_load_after_mutation';
    state.failConsumed = false;
  });
  writeFileSync(fixture.callLog, '', 'utf8');

  const result = runRollback(fixture, backup);
  assert.notEqual(result.status, 0);
  assert.match(result.stdout + result.stderr, /injected_failure:docker_load_after_mutation/u);
  assert.ok(calls(fixture).some((line) => line.startsWith('docker load ')));
  assert.match(result.stdout + result.stderr, /pre-attempt state recovery completed/u);
  assertCurrentStatePreserved(fixture, 2);
  assert.equal(scaleDownCalls(fixture).length, 6, 'archive loading may begin only after every deployment is quiesced');
});

contract('rollback exact Kubernetes replace removes fields added after the snapshot', () => {
  const fixture = createFixture('rollback-exact-k8s');
  assert.equal(runPrepare(fixture).status, 0);
  const backup = preparedBackup(fixture);
  mutatePostSnapshotState(fixture, 2);
  updateState(fixture, (state) => {
    state.k8sResidue = Object.fromEntries(exactResidueKeys.map((key) => [key, true]));
  });
  writeFileSync(fixture.callLog, '', 'utf8');

  const result = runRollback(fixture, backup);
  assert.equal(result.status, 0, 'exact Kubernetes rollback failed: stdout=' + result.stdout + ' stderr=' + result.stderr);
  const state = readState(fixture);
  for (const key of exactResidueKeys) {
    assert.equal(state.k8sResidue[key], false, key + ' retained a post-snapshot field');
    assert.doesNotMatch(JSON.stringify(state.exactObjects[key]), /txn-extra/u);
  }
});

contract('Kubernetes exact restore canonicalizes only empty metadata maps omitted by the API', () => {
  const fixture = createFixture('rollback-empty-metadata-canonicalization', {
    apiDropsEmptyMetadataMaps: true,
    emitSanitizedEmptyMetadataMaps: ['configmap/mosquitto-config'],
  });
  assert.equal(runPrepare(fixture).status, 0);
  const backup = preparedBackup(fixture);
  const bundlePath = join(backup, 'k8s/configmaps.json');
  const bundle = JSON.parse(readFileSync(bundlePath, 'utf8'));
  const mosquitto = bundle.items.find((item) => item.metadata.name === 'mosquitto-config');
  const synapse = bundle.items.find((item) => item.metadata.name === 'synapse-config');
  assert.ok(mosquitto && synapse);
  assert.equal(Object.hasOwn(mosquitto.metadata, 'annotations'), false,
    'sanitizer retained annotations after removing its only operational key');
  assert.equal(Object.hasOwn(mosquitto.metadata, 'labels'), false,
    'sanitizer retained an empty labels map');

  mosquitto.metadata.annotations = {};
  mosquitto.metadata.labels = {};
  synapse.metadata.annotations = { 'dongyu.example/owner': 'de-runtime' };
  synapse.metadata.labels = { 'dongyu.example/contract': '0457' };
  writeFileSync(bundlePath, JSON.stringify(bundle, null, 2) + '\n', 'utf8');
  refreshBackupChecksum(backup, 'k8s/configmaps.json');
  mutatePostSnapshotState(fixture, 2);
  writeFileSync(fixture.callLog, '', 'utf8');

  const result = runRollback(fixture, backup);
  assert.equal(result.status, 0,
    'API empty-map canonicalization failed: stdout=' + result.stdout + ' stderr=' + result.stderr);
  const restored = readState(fixture).exactObjects;
  assert.equal(restored['configmap/synapse-config'].metadata.annotations['dongyu.example/owner'], 'de-runtime');
  assert.equal(restored['configmap/synapse-config'].metadata.labels['dongyu.example/contract'], '0457');
});

contract('rollback rejects PVC identity drift before any scale-down', () => {
  const fixture = createFixture('rollback-identity-drift');
  assert.equal(runPrepare(fixture).status, 0);
  const backup = preparedBackup(fixture);
  updateState(fixture, (state) => {
    state.pvcUid = 'pvc-uid-replaced';
    state.claimRefUid = 'pvc-uid-replaced';
  });
  writeFileSync(fixture.callLog, '', 'utf8');
  const result = runRollback(fixture, backup);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /identity drift/u);
  assert.deepEqual(scaleDownCalls(fixture), []);
});

contract('rollback rejects namespace override mismatch before mutation', () => {
  const fixture = createFixture('rollback-override-mismatch');
  assert.equal(runPrepare(fixture).status, 0);
  const backup = preparedBackup(fixture);
  writeFileSync(fixture.callLog, '', 'utf8');
  const result = runRollback(fixture, backup, ['--namespace', 'other']);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /namespace override must exactly match/u);
  assert.deepEqual(scaleDownCalls(fixture), []);
});

contract('rollback ENOSPC fails during preflight before scale-down', () => {
  const fixture = createFixture('rollback-enospc');
  assert.equal(runPrepare(fixture).status, 0);
  const backup = preparedBackup(fixture);
  updateState(fixture, (state) => { state.enospc = true; });
  writeFileSync(fixture.callLog, '', 'utf8');
  const result = runRollback(fixture, backup);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /insufficient host restore space/u);
  assert.deepEqual(scaleDownCalls(fixture), []);
});

contract('rollback partial failure restores replicas, host trees, env, images, and Synapse data', () => {
  const fixture = createFixture('rollback-partial-recovery', {
    apiDropsEmptyMetadataMaps: true,
    emitSanitizedEmptyMetadataMaps: ['configmap/mosquitto-config'],
  });
  assert.equal(runPrepare(fixture).status, 0);
  const backup = preparedBackup(fixture);
  mutatePostSnapshotState(fixture, 2);
  updateState(fixture, (state) => {
    state.failEvent = 'synapse_write';
    state.failConsumed = false;
    state.k8sResidue = Object.fromEntries(exactResidueKeys.map((key) => [key, true]));
  });
  writeFileSync(fixture.callLog, '', 'utf8');

  const result = runRollback(fixture, backup);
  assert.notEqual(result.status, 0, 'injected partial failure must remain visible');
  assert.match(result.stdout + result.stderr, /pre-attempt state recovery completed/u);
  assertCurrentStatePreserved(fixture, 2);
  const state = readState(fixture);
  for (const key of exactResidueKeys) {
    assert.equal(state.k8sResidue[key], true, key + ' pre-attempt field was not recovered');
    assert.match(JSON.stringify(state.exactObjects[key]), /txn-extra/u);
  }
});

contract('rollback recovery failure retains transaction evidence for manual repair', () => {
  const fixture = createFixture('rollback-recovery-failure');
  assert.equal(runPrepare(fixture).status, 0);
  const backup = preparedBackup(fixture);
  mutatePostSnapshotState(fixture, 2);
  updateState(fixture, (state) => {
    state.failEvent = 'synapse_write';
    state.failConsumed = false;
    state.failRecoveryReplace = true;
  });
  writeFileSync(fixture.callLog, '', 'utf8');

  const result = runRollback(fixture, backup);
  assert.notEqual(result.status, 0);
  const output = result.stdout + result.stderr;
  assert.match(output, /injected_failure:recovery_replace/u);
  const retainedPath = assertRetainedFailClosedTransaction(fixture, result);
  assert.ok(existsSync(join(retainedPath, 'replicas.tsv')));
  assert.ok(existsSync(join(retainedPath, 'image-ids.tsv')));
  assert.ok(existsSync(join(retainedPath, 'k8s/deployments.json')));
  assert.equal(
    readFileSync(join(retainedPath, 'image-ids.tsv'), 'utf8').trim().split(/\r?\n/u).length,
    5,
    'transaction evidence must retain all five active image tags',
  );
  rmSync(retainedPath, { recursive: true, force: true });
});

const requestedFilter = process.env.DY_0457_TEST_FILTER || '';
const selectedCases = requestedFilter
  ? cases.filter(([name]) => name.includes(requestedFilter))
  : cases;
assert.ok(selectedCases.length > 0, 'no rollback contract case matched DY_0457_TEST_FILTER');

const failures = [];
for (const [name, fn] of selectedCases) {
  try {
    fn();
  } catch (error) {
    failures.push(name + ': ' + (error && error.message ? error.message : String(error)));
  }
}

assert.equal(
  failures.length,
  0,
  '0457 local rollback contract failures (' + failures.length + '):\n- ' + failures.join('\n- '),
);
console.log(
  'PASS test_0457_local_rollback_contract ('
    + selectedCases.length + '/' + selectedCases.length + ')',
);
