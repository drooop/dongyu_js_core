import assert from 'node:assert';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const cjsRuntime = require('../../packages/worker-base/src/runtime.js');
const esmRuntime = await import('../../packages/worker-base/src/runtime.mjs');

const runtimeVariants = [
  ['cjs', cjsRuntime.ModelTableRuntime],
  ['esm', esmRuntime.ModelTableRuntime],
];

function mt(k, t, v, id = '0', p = 0, r = 0, c = 0) {
  return { id, p, r, c, k, t, v };
}

function latestRejectedReason(rt) {
  const events = rt.eventLog.list();
  for (let index = events.length - 1; index >= 0; index -= 1) {
    if (events[index].result === 'rejected') return events[index].reason;
  }
  return null;
}

function labelValue(rt, key) {
  return rt.getModel(0).getCell(0, 0, 0).labels.get(key)?.v;
}

function feishuResourceMessage(sysMsgType, payloadRecords = []) {
  return [
    mt('model_type', 'model.subtable', 'Data'),
    mt('model_type', 'model.single', 'Data.Single', '0', 0, 0, 1),
    mt('__mt_payload_kind', 'str', 'pin_payload.v1', '0', 0, 0, 1),
    mt('is_need_response', 'bool', true, '0', 0, 0, 1),
    mt('model_type', 'model.matrix', 'Data', '0', 0, 1, 0),
    mt('model_size', 'model.matrix.size', {
      min_p: 0,
      min_r: 1,
      min_c: 0,
      max_p: 0,
      max_r: 1,
      max_c: 2,
    }, '0', 0, 1, 0),
    mt('route_kind', 'str', 'control', '0', 0, 1, 0),
    mt('origin_pin', 'str', 'UIPUT/ws/dam/pic/de/U1/0.2000/result', '0', 0, 1, 0),
    mt('endpoint_pin', 'str', 'UIPUT/ws/dam/pic/de/R1/0.3000/resource', '0', 0, 1, 0),
    mt('response_pin', 'str', 'UIPUT/ws/dam/pic/de/U1/0.2000/result', '0', 0, 1, 0),
    mt('model_type', 'model.single', 'Data.Single', '0', 0, 1, 1),
    mt('message_server', 'str', 'local', '0', 0, 1, 1),
    mt('between', 'str', 'DEM_V1N', '0', 0, 1, 1),
    mt('model_type', 'model.subtableconnection', 1, '0', 0, 2, 0),
    mt('model_type', 'model.subtable', 'Data', '0.1'),
    mt('model_name', 'model.name', 'payload', '0.1'),
    mt('sys_msg_type', 'str', sysMsgType, '0.1'),
    ...payloadRecords,
  ];
}

function resourceRows(uiResources = ['UI.app1', 'UI.app2'], serviceResources = ['calculator']) {
  return [
    mt('type', 'str', 'UI', '0.1', 0, 0, 1),
    mt('resource', 'list', uiResources, '0.1', 0, 0, 1),
    mt('type', 'str', 'service', '0.1', 0, 0, 2),
    mt('resource', 'list', serviceResources, '0.1', 0, 0, 2),
  ];
}

function dispatchResource(rt, sysMsgType, payloadRecords = []) {
  return rt.addLabel(rt.getModel(0), 0, 0, 0, {
    k: 'in3',
    t: 'pin.bus.cb.in',
    v: feishuResourceMessage(sysMsgType, payloadRecords),
  });
}

function resourceEvents(rt) {
  return rt.intercepts.list().filter((entry) => entry.type === 'feishu_resource_manager_event');
}

async function test_resource_report_updates_visible_catalog() {
  for (const [name, Runtime] of runtimeVariants) {
    const rt = new Runtime();
    const result = dispatchResource(rt, 'resource.report', resourceRows());
    assert.equal(result.applied, true, `${name}: resource.report must be accepted`);
    assert.deepEqual(labelValue(rt, 'feishu_resource_manager_catalog'), {
      UI: ['UI.app1', 'UI.app2'],
      service: ['calculator'],
    }, `${name}: visible resource catalog`);
    assert.equal(labelValue(rt, 'feishu_resource_manager_last_result')?.action, 'report', `${name}: last result action`);
    assert.equal(resourceEvents(rt).at(-1)?.payload.action, 'report', `${name}: resource intercept action`);
  }
}

async function test_resource_result_replaces_visible_catalog() {
  for (const [name, Runtime] of runtimeVariants) {
    const rt = new Runtime();
    dispatchResource(rt, 'resource.report', resourceRows());
    const result = dispatchResource(rt, 'resource.result', resourceRows(['UI.app3'], ['task_ods']));
    assert.equal(result.applied, true, `${name}: resource.result must be accepted`);
    assert.deepEqual(labelValue(rt, 'feishu_resource_manager_catalog'), {
      UI: ['UI.app3'],
      service: ['task_ods'],
    }, `${name}: resource.result replaces catalog`);
    assert.equal(labelValue(rt, 'feishu_resource_manager_last_result')?.action, 'result', `${name}: last result action`);
  }
}

async function test_resource_request_records_current_catalog_without_response() {
  for (const [name, Runtime] of runtimeVariants) {
    const rt = new Runtime();
    dispatchResource(rt, 'resource.report', resourceRows());
    const result = dispatchResource(rt, 'resource.request');
    assert.equal(result.applied, true, `${name}: resource.request must be accepted`);
    assert.equal(labelValue(rt, 'feishu_resource_manager_last_result')?.action, 'request', `${name}: request last result`);
    assert.deepEqual(labelValue(rt, 'feishu_resource_manager_last_result')?.catalog, {
      UI: ['UI.app1', 'UI.app2'],
      service: ['calculator'],
    }, `${name}: request exposes current catalog`);
    const busOutEvents = rt.intercepts.list().filter((entry) => entry.type === 'mqtt_publish' || entry.type === 'feishu_message_api_response');
    assert.equal(busOutEvents.length, 0, `${name}: resource.request must not synthesize a response`);
  }
}

async function test_resource_report_requires_resource_entries() {
  for (const [name, Runtime] of runtimeVariants) {
    const rt = new Runtime();
    const result = dispatchResource(rt, 'resource.report');
    assert.equal(result.applied, false, `${name}: empty resource.report must reject`);
    assert.equal(latestRejectedReason(rt), 'bus_in_missing_resource_entries', `${name}: missing resource reason`);
  }
}

const tests = [
  test_resource_report_updates_visible_catalog,
  test_resource_result_replaces_visible_catalog,
  test_resource_request_records_current_catalog_without_response,
  test_resource_report_requires_resource_entries,
];

let failed = 0;
for (const test of tests) {
  try {
    await test();
    console.log(`[PASS] ${test.name}`);
  } catch (error) {
    failed += 1;
    console.error(`[FAIL] ${test.name}`);
    console.error(error && error.stack ? error.stack : error);
  }
}

if (failed > 0) {
  console.error(`${failed} failed, ${tests.length - failed} passed out of ${tests.length}`);
  process.exit(1);
}

console.log(`${tests.length} passed, 0 failed out of ${tests.length}`);
