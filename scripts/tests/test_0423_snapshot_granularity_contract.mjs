import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

function label(k, t, v) {
  return { k, t, v };
}

function snapshotBytes(value) {
  return Buffer.byteLength(JSON.stringify(value), 'utf8');
}

function fixtureSnapshot() {
  return {
    models: {
      '0': {
        id: 0,
        cells: {
          '0,0,0': {
            p: 0,
            r: 0,
            c: 0,
            labels: {
              sys_worker_id: label('sys_worker_id', 'worker.id', '5/10/28/35/13'),
              sys_worker_role: label('sys_worker_role', 'worker.role', 'DEM'),
              runtime_mode: label('runtime_mode', 'str', 'ready'),
              hidden_runtime_noise: label('hidden_runtime_noise', 'str', 'x'.repeat(4096)),
            },
          },
        },
      },
      '-2': {
        id: -2,
        cells: {
          '0,0,0': {
            p: 0,
            r: 0,
            c: 0,
            labels: {
              ws_apps_registry: label('ws_apps_registry', 'json', [
                { model_id: 4100, name: 'Lazy App', summary: 'Visible only on open.' },
              ]),
              home_table_rows_json: label('home_table_rows_json', 'json', Array.from({ length: 64 }, (_, i) => ({ i, text: 'heavy row' }))),
            },
          },
        },
      },
      '4100': {
        id: 4100,
        cells: {
          '0,0,0': {
            p: 0,
            r: 0,
            c: 0,
            labels: {
              app_name: label('app_name', 'str', 'Lazy App'),
              app_body: label('app_body', 'str', 'hidden app body '.repeat(1024)),
            },
          },
        },
      },
    },
    v1nConfig: {
      mqtt: { host: 'secret-host.local', password: 'secret' },
    },
  };
}

async function test_profile_stats_are_computed_after_profile_filtering() {
  const server = await import('../../packages/ui-model-demo-server/server.mjs');
  assert.equal(
    typeof server.buildClientSnapshotProfileWithStats,
    'function',
    'server must expose buildClientSnapshotProfileWithStats(snapshot, options)',
  );

  const body = server.buildClientSnapshotProfileWithStats(fixtureSnapshot(), { profile: 'bootstrap' });
  assert.equal(Boolean(body && body.snapshot && body.snapshot_stats), true, 'helper must return snapshot and snapshot_stats');
  assert.equal(body.snapshot.models['4100'], undefined, 'bootstrap snapshot must not include positive app body');
  assert.equal(body.snapshot_stats.profile, 'bootstrap');
  assert.equal(body.snapshot_stats.total_bytes, snapshotBytes(body.snapshot), 'total_bytes must match serialized client-visible snapshot');
  assert.equal(
    body.snapshot_stats.models.some((entry) => entry.model_id === 4100),
    false,
    'stats must not count model filtered out of the client-visible profile',
  );
  assert.equal(
    body.snapshot_stats.top_labels.some((entry) => entry.model_id === 4100 || entry.k === 'app_body'),
    false,
    'top label stats must not include filtered positive app body labels',
  );
  assert.equal(
    body.snapshot_stats.dropped_model_count >= 1,
    true,
    'stats must expose dropped_model_count for contributor analysis',
  );
  assert.equal(
    body.snapshot_stats.dropped_label_count >= 1,
    true,
    'stats must expose dropped_label_count for contributor analysis',
  );

  const visibleBody = server.buildClientSnapshotProfileWithStats(fixtureSnapshot(), {
    profile: 'visible',
    visibleModelIds: [4100],
  });
  assert.equal(Boolean(visibleBody.snapshot.models['4100']), true, 'visible profile must include requested app model body');
  assert.equal(
    visibleBody.snapshot_stats.models.some((entry) => entry.model_id === 4100),
    true,
    'visible stats must count requested app model body',
  );
  assert.equal(
    visibleBody.snapshot_stats.top_labels.some((entry) => entry.model_id === 4100 && entry.k === 'app_body'),
    true,
    'visible top labels may include requested app body labels because they are client-visible',
  );
  assert.equal(
    visibleBody.snapshot_stats.total_bytes,
    snapshotBytes(visibleBody.snapshot),
    'visible total_bytes must match serialized client-visible snapshot',
  );

  const fullBody = server.buildClientSnapshotProfileWithStats(fixtureSnapshot(), { profile: 'full' });
  assert.equal(Boolean(fullBody.snapshot.models['4100']), true, 'full diagnostic profile must include app model body');
  assert.equal(fullBody.snapshot_stats.dropped_model_count, 0, 'full diagnostic profile should not report dropped models');
  assert.equal(fullBody.snapshot_stats.dropped_label_count, 0, 'full diagnostic profile should not report dropped labels');
  assert.equal(
    fullBody.snapshot_stats.total_bytes,
    snapshotBytes(fullBody.snapshot),
    'full total_bytes must match serialized diagnostic client snapshot',
  );
}

async function test_profile_size_report_prints_cell_contributors() {
  const output = execFileSync(process.execPath, [
    'scripts/ops/report_snapshot_profile_sizes.mjs',
    '--top-models',
    '2',
    '--top-labels',
    '2',
  ], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  assert.match(output, /\[bootstrap\][\s\S]*top_cells=/u, 'bootstrap report must print top_cells');
  assert.match(output, /\[visible:\d+\][\s\S]*top_cells=/u, 'visible report must print top_cells');
  assert.match(output, /\[full\][\s\S]*top_cells=/u, 'full report must print top_cells');
}

const tests = [
  test_profile_stats_are_computed_after_profile_filtering,
  test_profile_size_report_prints_cell_contributors,
];

let passed = 0;
let failed = 0;
for (const test of tests) {
  try {
    await test();
    passed += 1;
    console.log(`PASS ${test.name}`);
  } catch (err) {
    failed += 1;
    console.error(`FAIL ${test.name}: ${err && err.stack ? err.stack : err}`);
  }
}

if (failed > 0) {
  console.error(`FAIL test_0423_snapshot_granularity_contract: ${failed} failed, ${passed} passed`);
  process.exit(1);
}

console.log(`PASS test_0423_snapshot_granularity_contract: ${passed} passed`);
