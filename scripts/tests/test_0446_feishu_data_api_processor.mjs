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

function feishuDataMessage(sysMsgType, payloadType = 'Data', payloadRecords = []) {
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
    mt('endpoint_pin', 'str', 'UIPUT/ws/dam/pic/de/R1/0.3000/data', '0', 0, 1, 0),
    mt('response_pin', 'str', 'UIPUT/ws/dam/pic/de/U1/0.2000/result', '0', 0, 1, 0),
    mt('model_type', 'model.single', 'Data.Single', '0', 0, 1, 1),
    mt('message_server', 'str', 'local', '0', 0, 1, 1),
    mt('between', 'str', 'DEM_V1N', '0', 0, 1, 1),
    mt('model_type', 'model.subtableconnection', 1, '0', 0, 2, 0),
    mt('model_type', 'model.subtable', payloadType, '0.1'),
    mt('model_name', 'model.name', 'payload', '0.1'),
    mt('sys_msg_type', 'str', sysMsgType, '0.1'),
    ...payloadRecords,
  ];
}

function modeltableRecords() {
  return [
    mt('model_type', 'model.single', 'Data.Single', '0.1', 0, 0, 1),
    mt('data_key', 'str', 'alpha', '0.1', 0, 0, 1),
    mt('data_value', 'int', 7, '0.1', 0, 0, 1),
  ];
}

function flowRecords() {
  return [
    mt('flow_name', 'str', '审批流', '0.1', 0, 0, 1),
    mt('flow_steps', 'list', ['start', 'review', 'end'], '0.1', 0, 0, 1),
  ];
}

function dispatchData(rt, sysMsgType, payloadType = 'Data', payloadRecords = []) {
  return rt.addLabel(rt.getModel(0), 0, 0, 0, {
    k: 'in3',
    t: 'pin.bus.cb.in',
    v: feishuDataMessage(sysMsgType, payloadType, payloadRecords),
  });
}

function dataEvents(rt) {
  return rt.intercepts.list().filter((entry) => entry.type === 'feishu_data_manager_event');
}

async function test_save_modeltable_records_visible_payload() {
  for (const [name, Runtime] of runtimeVariants) {
    const rt = new Runtime();
    const result = dispatchData(rt, 'data.save_modeltable', 'Data', modeltableRecords());
    assert.equal(result.applied, true, `${name}: data.save_modeltable must be accepted`);
    assert.equal(labelValue(rt, 'feishu_data_manager_last_result')?.action, 'save_modeltable', `${name}: last result action`);
    assert.equal(labelValue(rt, 'feishu_data_manager_last_result')?.kind, 'modeltable', `${name}: last result kind`);
    assert.equal(labelValue(rt, 'feishu_data_manager_store')?.modeltable?.saved?.record_count, 3, `${name}: saved modeltable count`);
    assert.equal(labelValue(rt, 'feishu_data_manager_store')?.modeltable?.saved?.records?.[1]?.k, 'data_key', `${name}: saved modeltable record`);
    assert.equal(dataEvents(rt).at(-1)?.payload.action, 'save_modeltable', `${name}: data intercept action`);
  }
}

async function test_load_modeltable_records_visible_payload_without_response() {
  for (const [name, Runtime] of runtimeVariants) {
    const rt = new Runtime();
    const result = dispatchData(rt, 'data.load_modeltable', 'Data', modeltableRecords());
    assert.equal(result.applied, true, `${name}: data.load_modeltable must be accepted`);
    assert.equal(labelValue(rt, 'feishu_data_manager_store')?.modeltable?.loaded?.record_count, 3, `${name}: loaded modeltable count`);
    assert.equal(labelValue(rt, 'feishu_data_manager_last_result')?.action, 'load_modeltable', `${name}: last result action`);
    const busOutEvents = rt.intercepts.list().filter((entry) => entry.type === 'mqtt_publish' || entry.type === 'feishu_message_api_response');
    assert.equal(busOutEvents.length, 0, `${name}: data.load_modeltable must not synthesize a response`);
  }
}

async function test_save_and_load_flow_records_visible_payload() {
  for (const [name, Runtime] of runtimeVariants) {
    const rt = new Runtime();
    const save = dispatchData(rt, 'data.save_flow', 'Flow', flowRecords());
    assert.equal(save.applied, true, `${name}: data.save_flow must be accepted`);
    assert.equal(labelValue(rt, 'feishu_data_manager_store')?.flow?.saved?.record_count, 2, `${name}: saved flow count`);
    const load = dispatchData(rt, 'data.load_flow', 'Flow', flowRecords());
    assert.equal(load.applied, true, `${name}: data.load_flow must be accepted`);
    assert.equal(labelValue(rt, 'feishu_data_manager_store')?.flow?.loaded?.records?.[0]?.k, 'flow_name', `${name}: loaded flow record`);
    assert.equal(labelValue(rt, 'feishu_data_manager_last_result')?.kind, 'flow', `${name}: last result flow kind`);
  }
}

async function test_data_messages_require_payload_records() {
  for (const [name, Runtime] of runtimeVariants) {
    const rt = new Runtime();
    const result = dispatchData(rt, 'data.save_modeltable', 'Data');
    assert.equal(result.applied, false, `${name}: empty data.save_modeltable must reject`);
    assert.equal(latestRejectedReason(rt), 'bus_in_missing_data_payload_records', `${name}: missing data payload reason`);
  }
}

async function test_flow_messages_require_flow_payload_root() {
  for (const [name, Runtime] of runtimeVariants) {
    const rt = new Runtime();
    const result = dispatchData(rt, 'data.save_flow', 'Data', flowRecords());
    assert.equal(result.applied, false, `${name}: data.save_flow with Data payload root must reject`);
    assert.equal(latestRejectedReason(rt), 'bus_in_invalid_data_payload_type', `${name}: invalid flow payload type reason`);
  }
}

const tests = [
  test_save_modeltable_records_visible_payload,
  test_load_modeltable_records_visible_payload_without_response,
  test_save_and_load_flow_records_visible_payload,
  test_data_messages_require_payload_records,
  test_flow_messages_require_flow_payload_root,
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
