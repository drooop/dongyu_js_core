#!/usr/bin/env node

import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildAstFromCellwiseModel } from '../../packages/ui-model-demo-frontend/src/ui_cellwise_projection.js';

const EXAMPLE_MODEL_ID = 1050;
const BUS_IN_KEY = 'bus_event_submit_1050_0_0_0';
const EGRESS_LABEL = 'minimal_submit_matrix_submit_out';
const EGRESS_FUNC = 'forward_minimal_submit_matrix_from_model0';
const REMOTE_PATCH = 'deploy/sys-v1ns/remote-worker/patches/13_model1050_minimal_submit.json';
const HIERARCHY_PATCH = 'packages/worker-base/system-models/runtime_hierarchy_mounts.json';
const GUIDE_DOC = 'docs/user-guide/slide-app-runtime/minimal_submit_app_provider_guide.md';
const VISUAL_DOC = 'docs/user-guide/slide-app-runtime/minimal_submit_app_provider_visualized.md';
const INTERACTIVE_DOC = 'docs/user-guide/slide-app-runtime/minimal_submit_app_provider_interactive.html';

function readJson(path) {
  return JSON.parse(readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8'));
}

function readText(path) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
}

function findRecord(records, predicate) {
  return records.find((record) => record && predicate(record)) || null;
}

function recordsFor(path) {
  return readJson(path).records || [];
}

function makeSnapshotFromRecords(records, modelId) {
  const cells = {};
  for (const record of records) {
    if (!record || record.op !== 'add_label' || record.model_id !== modelId) continue;
    const cellKey = `${record.p},${record.r},${record.c}`;
    if (!cells[cellKey]) cells[cellKey] = { labels: {} };
    cells[cellKey].labels[record.k] = { k: record.k, t: record.t, v: record.v };
  }
  return { models: { [String(modelId)]: { id: modelId, name: `Model ${modelId}`, cells } } };
}

function findNodeById(node, id) {
  if (!node || typeof node !== 'object') return null;
  if (node.id === id) return node;
  for (const child of Array.isArray(node.children) ? node.children : []) {
    const found = findNodeById(child, id);
    if (found) return found;
  }
  return null;
}

function assertNoLegacyRouteSurface(text, label) {
  assert.equal(text.includes('pin.connect.model'), false, `${label} must not use pin.connect.model`);
  assert.equal(/ctx\.(writeLabel|getLabel|rmLabel)/u.test(text), false, `${label} must not use legacy ctx label APIs`);
}

function wait(ms = 350) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withServerState(fn) {
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0359-minimal-matrix-'));
  process.env.DY_AUTH = '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.WORKER_BASE_WORKSPACE = `it0359_minimal_matrix_${Date.now()}`;
  process.env.WORKER_BASE_DATA_ROOT = join(tempRoot, 'runtime');
  process.env.DOCS_ROOT = join(tempRoot, 'docs');
  process.env.STATIC_PROJECTS_ROOT = join(tempRoot, 'static');
  const { createServerState } = await import(new URL('../../packages/ui-model-demo-server/server.mjs', import.meta.url));
  const state = createServerState({ dbPath: null });
  try {
    await state.activateRuntimeMode('running');
    return await fn(state);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
    delete process.env.WORKER_BASE_WORKSPACE;
    delete process.env.WORKER_BASE_DATA_ROOT;
    delete process.env.DOCS_ROOT;
    delete process.env.STATIC_PROJECTS_ROOT;
    delete process.env.DY_PERSISTED_ASSET_ROOT;
  }
}

function test_seeded_workspace_model_is_cellwise_and_bus_event_v2() {
  const records = recordsFor('packages/worker-base/system-models/workspace_positive_models.json');
  const hierarchyRecords = recordsFor(HIERARCHY_PATCH);
  assert.ok(findRecord(records, (record) => record.op === 'create_model' && record.model_id === EXAMPLE_MODEL_ID), 'minimal submit Matrix example model must be seeded');
  const hierarchyMount = findRecord(hierarchyRecords, (record) => record.model_id === 0 && record.t === 'model.submt' && record.v === EXAMPLE_MODEL_ID);
  assert.ok(hierarchyMount, 'minimal submit Matrix example model must be mounted into Workspace hierarchy');
  assert.deepEqual(
    { p: hierarchyMount.p, r: hierarchyMount.r, c: hierarchyMount.c },
    { p: 9, r: 0, c: EXAMPLE_MODEL_ID },
    'minimal submit Matrix example mount must avoid the Workspace import auto-mount row',
  );

  const appName = findRecord(records, (record) => record.model_id === EXAMPLE_MODEL_ID && record.k === 'app_name');
  assert.equal(appName?.v, '最小 Submit 双总线示例', 'example app name must be visible and specific');
  assert.equal(findRecord(records, (record) => record.model_id === EXAMPLE_MODEL_ID && record.k === 'ui_authoring_version')?.v, 'cellwise.ui.v1');
  assert.equal(findRecord(records, (record) => record.model_id === EXAMPLE_MODEL_ID && record.k === 'display_text')?.v, 'Waiting for submit');

  const dualBus = findRecord(records, (record) => record.model_id === EXAMPLE_MODEL_ID && record.k === 'dual_bus_model')?.v;
  assert.deepEqual(
    dualBus,
    {
      model0_egress_label: EGRESS_LABEL,
      model0_egress_func: EGRESS_FUNC,
    },
    'dual_bus_model must bind the example to Model 0 egress',
  );

  const ast = buildAstFromCellwiseModel(makeSnapshotFromRecords(records, EXAMPLE_MODEL_ID), EXAMPLE_MODEL_ID);
  const input = findNodeById(ast, 'minimal_submit_matrix_input');
  const submit = findNodeById(ast, 'minimal_submit_matrix_button');
  const display = findNodeById(ast, 'minimal_submit_matrix_display');
  assert.ok(input, 'input node must be cellwise');
  assert.ok(submit, 'submit button node must be cellwise');
  assert.ok(display, 'display label node must be cellwise');

  assert.equal(input.bind?.read?.model_id, EXAMPLE_MODEL_ID, 'input must read from the example model');
  assert.equal(input.bind?.write?.action, 'ui_owner_label_update', 'input draft must write through owner update');
  assert.equal(input.bind?.write?.target_ref?.k, 'input_text', 'input draft must target input_text');

  assert.equal(submit.bind?.write?.bus_event_v2, true, 'submit must enter Model 0 through bus_event_v2');
  assert.equal(submit.bind?.write?.bus_in_key, BUS_IN_KEY, 'submit must use the declared Model 0 bus-in key');
  assert.equal(submit.bind?.write?.pin, undefined, 'submit must not directly write a positive-model pin');
  assert.equal(submit.bind?.write?.action, undefined, 'submit must not use legacy action routing');
  assert.ok(Array.isArray(submit.bind?.write?.value_ref), 'submit payload must be a temporary ModelTable array');
  assert.deepEqual(
    submit.bind.write.value_ref.find((record) => record.k === 'text')?.v,
    { $label: { model_id: EXAMPLE_MODEL_ID, p: 0, r: 0, c: 0, k: 'input_text' } },
    'submit payload must carry the input text as a ModelTable record',
  );
  assert.equal(display.bind?.read?.k, 'display_text', 'display label must read display_text');
  return { key: 'seeded_workspace_model_is_cellwise_and_bus_event_v2', status: 'PASS' };
}

function test_model0_mbr_remote_worker_contracts_exist() {
  const workspaceRecords = recordsFor('packages/worker-base/system-models/workspace_positive_models.json');
  const systemRecords = recordsFor('packages/worker-base/system-models/system_models.json');
  const mbrRecords = recordsFor('deploy/sys-v1ns/mbr/patches/mbr_role_v0.json');
  const remoteConfigRecords = recordsFor('deploy/sys-v1ns/remote-worker/patches/00_remote_worker_config.json');

  const egressLabel = findRecord(workspaceRecords, (record) => record.model_id === 0 && record.k === EGRESS_LABEL);
  assert.equal(egressLabel?.t, 'pin.in', 'Model 0 egress label must be pin.in');

  const route = findRecord(workspaceRecords, (record) => record.model_id === 0 && record.k === 'minimal_submit_matrix_submit_route');
  assert.equal(route?.t, 'pin.connect.cell', 'Model 0 submit route must use pin.connect.cell');
  assert.deepEqual(route?.v, [{ from: [0, 0, 0, BUS_IN_KEY], to: [[0, 0, 0, EGRESS_LABEL]] }], 'Model 0 route must connect bus-in to egress label');

  const func = findRecord(workspaceRecords, (record) => record.model_id === -10 && record.k === EGRESS_FUNC);
  assert.equal(func?.t, 'func.js', 'Model 0 forward function must exist');
  assert.match(func?.v?.code || '', /source_model_id:\s*1050/u, 'forward function must send source_model_id=1050');
  assert.match(func?.v?.code || '', /pin:\s*'submit'/u, 'forward function must send submit pin');
  assert.match(func?.v?.code || '', /ctx\.sendMatrix\(packet\)/u, 'forward function must actually send Matrix');
  assertNoLegacyRouteSurface(func?.v?.code || '', 'Model 0 forward function');

  const routeLabel = findRecord(systemRecords, (record) => record.model_id === -10 && record.k === 'mbr_route_1050');
  assert.deepEqual(routeLabel?.v, { pin: 'submit', type: 'pin_payload' }, 'system route must allow the example submit pin');
  const mbrIds = findRecord(mbrRecords, (record) => record.k === 'mbr_mqtt_model_ids')?.v || [];
  assert.ok(mbrIds.includes(EXAMPLE_MODEL_ID), 'MBR must subscribe the example model MQTT topics');
  const subscriptions = findRecord(remoteConfigRecords, (record) => record.k === 'remote_subscriptions')?.v || [];
  assert.ok(subscriptions.includes('UIPUT/ws/dam/pic/de/sw/1050/submit'), 'remote-worker must subscribe submit topic');
  assert.ok(subscriptions.includes('UIPUT/ws/dam/pic/de/sw/1050/result'), 'remote-worker must subscribe result topic');
  assert.match(readText('scripts/ops/sync_local_persisted_assets.sh'), /13_model1050_minimal_submit\.json/u, 'local asset sync must deploy the remote-worker example patch');
  return { key: 'model0_mbr_remote_worker_contracts_exist', status: 'PASS' };
}

function test_remote_worker_patch_returns_display_text_result() {
  assert.ok(existsSync(new URL(`../../${REMOTE_PATCH}`, import.meta.url)), 'remote-worker model 1050 patch must exist');
  const records = recordsFor(REMOTE_PATCH);
  assert.ok(findRecord(records, (record) => record.op === 'create_model' && record.model_id === EXAMPLE_MODEL_ID), 'remote worker must create model 1050');
  assert.equal(findRecord(records, (record) => record.model_id === EXAMPLE_MODEL_ID && record.k === 'submit')?.t, 'pin.in', 'remote submit pin must be pin.in');
  assert.equal(findRecord(records, (record) => record.model_id === EXAMPLE_MODEL_ID && record.k === 'result')?.t, 'pin.out', 'remote result pin must be pin.out');
  assert.equal(findRecord(records, (record) => record.model_id === EXAMPLE_MODEL_ID && record.k === 'result_out_topic')?.v, 'UIPUT/ws/dam/pic/de/sw/1050/result');

  const func = findRecord(records, (record) => record.model_id === EXAMPLE_MODEL_ID && record.k === 'on_minimal_submit_matrix_remote_submit');
  assert.equal(func?.t, 'func.js', 'remote submit handler must be func.js');
  const code = func?.v?.code || '';
  assert.match(code, /Submitted: /u, 'remote handler must build Submitted display text');
  assert.match(code, /ctx\.publishMqtt\(topic,\s*\{ version: 'v1', type: 'pin_payload'/u, 'remote handler must publish a pin_payload result');
  assert.match(code, /source_model_id:\s*1050/u, 'remote result must target source_model_id 1050');
  assert.match(code, /pin:\s*'result'/u, 'remote result must use result pin');
  assertNoLegacyRouteSurface(code, 'remote submit handler');
  return { key: 'remote_worker_patch_returns_display_text_result', status: 'PASS' };
}

function test_docs_describe_real_matrix_roundtrip() {
  const guide = readText(GUIDE_DOC);
  const visual = readText(VISUAL_DOC);
  const html = readText(INTERACTIVE_DOC);
  for (const [label, text] of [['guide', guide], ['visual', visual], ['html', html]]) {
    assert.match(text, /UIPUT\/ws\/dam\/pic\/de\/sw\/1050\/submit/u, `${label} must document submit topic`);
    assert.match(text, /UIPUT\/ws\/dam\/pic\/de\/sw\/1050\/result/u, `${label} must document result topic`);
    assert.match(text, /bus_event_submit_1050_0_0_0/u, `${label} must document Model 0 bus-in key`);
    assert.match(text, /Submitted: <输入内容>|Submitted: &lt;输入内容&gt;/u, `${label} must document visible result`);
  }
  assert.match(guide, /UI click -> Model 0 -> Matrix -> MBR -> MQTT -> remote-worker -> MQTT -> MBR -> Matrix -> ui-server -> UI model/u);
  return { key: 'docs_describe_real_matrix_roundtrip', status: 'PASS' };
}

async function test_server_roundtrip_materializes_matrix_result_to_ui_model() {
  return withServerState(async (state) => {
    const published = [];
    state.programEngine.matrixAdapter = {
      publish: async (payload) => {
        published.push(payload);
        setTimeout(() => {
          state.programEngine.handleDyBusEvent({
            version: 'v1',
            type: 'pin_payload',
            op_id: `result_${payload.op_id}`,
            source_model_id: EXAMPLE_MODEL_ID,
            pin: 'result',
            payload: [
              { id: 0, p: 0, r: 0, c: 0, k: 'display_text', t: 'str', v: 'Submitted: hello matrix e2e' },
              { id: 0, p: 0, r: 0, c: 0, k: 'remote_status', t: 'str', v: 'remote_processed' },
            ],
            timestamp: Date.now(),
          });
        }, 60);
      },
    };
    state.programEngine.matrixRoomId = '!test-room:localhost';
    state.programEngine.matrixDmPeerUserId = '@mbr:localhost';

    const result = await state.submitEnvelope({
      type: 'bus_event_v2',
      bus_in_key: BUS_IN_KEY,
      value: [
        { id: 0, p: 0, r: 0, c: 0, k: '__mt_payload_kind', t: 'str', v: 'ui_event.v1' },
        { id: 0, p: 0, r: 0, c: 0, k: 'text', t: 'str', v: 'hello matrix e2e' },
      ],
      meta: { op_id: `it0359_${Date.now()}` },
    });
    assert.equal(result?.result, 'ok', 'bus_event_v2 submit must be accepted');
    await wait(900);

    const snap = state.clientSnap();
    const root = snap.models[String(EXAMPLE_MODEL_ID)]?.cells?.['0,0,0']?.labels || {};
    const model0Root = snap.models['0']?.cells?.['0,0,0']?.labels || {};
    assert.equal(published.length, 1, 'server must publish exactly one Matrix pin_payload');
    assert.equal(published[0].source_model_id, EXAMPLE_MODEL_ID, 'published packet source_model_id');
    assert.equal(published[0].pin, 'submit', 'published packet pin');
    assert.equal(root.display_text?.v, 'Submitted: hello matrix e2e', 'Matrix result must materialize into the UI model label');
    assert.equal(model0Root[EGRESS_LABEL]?.v ?? null, null, 'Model 0 egress label must be cleared after send');
    return { key: 'server_roundtrip_materializes_matrix_result_to_ui_model', status: 'PASS' };
  });
}

const tests = [
  test_seeded_workspace_model_is_cellwise_and_bus_event_v2,
  test_model0_mbr_remote_worker_contracts_exist,
  test_remote_worker_patch_returns_display_text_result,
  test_docs_describe_real_matrix_roundtrip,
  test_server_roundtrip_materializes_matrix_result_to_ui_model,
];

(async () => {
  let passed = 0;
  let failed = 0;
  for (const test of tests) {
    try {
      const result = await test();
      console.log(`[${result.status}] ${result.key}`);
      passed += 1;
    } catch (err) {
      failed += 1;
      console.error(`[FAIL] ${test.name}: ${err.message}`);
    }
  }
  if (failed > 0) {
    console.error(`FAIL test_0359_minimal_submit_matrix_e2e_contract passed=${passed} failed=${failed}`);
    process.exit(1);
  }
  console.log(`PASS test_0359_minimal_submit_matrix_e2e_contract passed=${passed}`);
})().catch((err) => {
  console.error(`FAIL test_0359_minimal_submit_matrix_e2e_contract: ${err.message}`);
  process.exit(1);
});
