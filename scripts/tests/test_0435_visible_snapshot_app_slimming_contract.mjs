#!/usr/bin/env node

import assert from 'node:assert/strict';

function label(k, t, v) {
  return { k, t, v };
}

function fixtureSnapshot() {
  return {
    models: {
      '0': {
        table_id: 'host',
        id: 0,
        cells: {
          '0,0,0': {
            p: 0,
            r: 0,
            c: 0,
            labels: {
              sys_worker_id: label('sys_worker_id', 'worker.id', '5/10/28/35/13'),
              sys_worker_role: label('sys_worker_role', 'worker.role', 'DEM'),
              runtime_mode: label('runtime_mode', 'str', 'running'),
              host_noise: label('host_noise', 'str', 'host-only bootstrap noise'),
            },
          },
        },
      },
      '-2': {
        table_id: 'host',
        id: -2,
        cells: {
          '0,0,0': {
            p: 0,
            r: 0,
            c: 0,
            labels: {
              ws_apps_registry: label('ws_apps_registry', 'json', [
                {
                  table_id: 'app:drop:e2e:2-0-20:1',
                  model_id: 0,
                  name: 'E2E 颜色生成器',
                  app_origin: 'slid_in',
                },
              ]),
            },
          },
        },
      },
      '-28': {
        table_id: 'host',
        id: -28,
        cells: {
          '0,0,0': {
            p: 0,
            r: 0,
            c: 0,
            labels: {
              shell_title: label('shell_title', 'str', 'Dongyu Tablet'),
            },
          },
        },
      },
    },
    tables: {
      'app:drop:e2e:2-0-20:1': {
        table_id: 'app:drop:e2e:2-0-20:1',
        models: {
          '0': {
            table_id: 'app:drop:e2e:2-0-20:1',
            id: 0,
            cells: {
              '0,0,0': {
                p: 0,
                r: 0,
                c: 0,
                labels: {
                  model_type: label('model_type', 'model.subtable', 'UI.SlideApp'),
                  app_name: label('app_name', 'str', 'E2E 颜色生成器'),
                  bg_color: label('bg_color', 'str', '#7deed2'),
                },
              },
            },
          },
        },
      },
    },
    v1nConfig: {
      publicMode: 'demo',
      access_token: 'must-not-leak',
    },
  };
}

function modelKeys(snapshot) {
  return Object.keys(snapshot?.models || {}).sort();
}

function tableModelKeys(snapshot, tableId) {
  return Object.keys(snapshot?.tables?.[tableId]?.models || {}).sort();
}

async function test_visible_profile_for_app_table_is_target_only() {
  const server = await import('../../packages/ui-model-demo-server/server.mjs');
  const body = server.buildClientSnapshotProfileWithStats(fixtureSnapshot(), {
    profile: 'visible',
    visibleModelRefs: [{ table_id: 'app:drop:e2e:2-0-20:1', model_id: 0 }],
  });

  assert.deepEqual(
    modelKeys(body.snapshot),
    [],
    `profile=visible for an App table must not repeat host bootstrap models; actual=${JSON.stringify(modelKeys(body.snapshot))}`,
  );
  assert.deepEqual(
    tableModelKeys(body.snapshot, 'app:drop:e2e:2-0-20:1'),
    ['0'],
    'profile=visible must include the requested App table root model',
  );
  assert.equal(
    body.snapshot.v1nConfig.access_token,
    undefined,
    'profile=visible must keep v1nConfig sanitized while slimming the payload',
  );
  assert.equal(
    body.snapshot_stats.models.some((entry) => entry.table_id === 'host'),
    false,
    'visible snapshot stats must not count filtered host bootstrap models',
  );
}

async function test_bootstrap_with_visible_app_table_still_combines_shell_and_visible_model() {
  const server = await import('../../packages/ui-model-demo-server/server.mjs');
  const body = server.buildClientSnapshotProfileWithStats(fixtureSnapshot(), {
    profile: 'bootstrap',
    visibleModelRefs: [{ table_id: 'app:drop:e2e:2-0-20:1', model_id: 0 }],
  });

  assert.equal(
    modelKeys(body.snapshot).includes('-2'),
    true,
    'profile=bootstrap must keep shell/editor state for first paint',
  );
  assert.equal(
    modelKeys(body.snapshot).includes('-28'),
    true,
    'profile=bootstrap must keep desktop shell model for first paint',
  );
  assert.deepEqual(
    tableModelKeys(body.snapshot, 'app:drop:e2e:2-0-20:1'),
    ['0'],
    'profile=bootstrap plus visible refs must still include the visible App table model',
  );
}

const tests = [
  test_visible_profile_for_app_table_is_target_only,
  test_bootstrap_with_visible_app_table_still_combines_shell_and_visible_model,
];

let failed = 0;
for (const test of tests) {
  try {
    await test();
    console.log(`PASS ${test.name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${test.name}`);
    console.error(error && error.stack ? error.stack : error);
  }
}

if (failed > 0) {
  console.error(`${failed} failed, ${tests.length - failed} passed`);
  process.exit(1);
}

console.log(`${tests.length} passed, 0 failed`);
