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

function feishuUiMessage(sysMsgType, payloadType = 'Data', payloadRecords = []) {
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
    mt('endpoint_pin', 'str', 'UIPUT/ws/dam/pic/de/R1/0.3000/ui', '0', 0, 1, 0),
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

function updateRecords() {
  return [
    mt('text', 'str', 'aa', '0.1', 0, 1, 0),
    mt('button', 'str', 'bb', '0.1', 0, 2, 0),
  ];
}

function formRecords() {
  return [
    mt('data1', 'str', 'aa', '0.1', 0, 0, 0),
    mt('data2', 'int', 1234, '0.1', 1, 0, 0),
  ];
}

function refreshRecords() {
  return [
    mt('data1', 'str', 'refresh-aa', '0.1', 0, 0, 0),
    mt('data2', 'int', 5678, '0.1', 1, 0, 0),
  ];
}

function dispatchUi(rt, sysMsgType, payloadType = 'Data', payloadRecords = []) {
  return rt.addLabel(rt.getModel(0), 0, 0, 0, {
    k: 'in3',
    t: 'pin.bus.cb.in',
    v: feishuUiMessage(sysMsgType, payloadType, payloadRecords),
  });
}

function uiEvents(rt) {
  return rt.intercepts.list().filter((entry) => entry.type === 'feishu_ui_manager_event');
}

async function test_update_data_records_current_state_and_history() {
  for (const [name, Runtime] of runtimeVariants) {
    const rt = new Runtime();
    const result = dispatchUi(rt, 'ui.update_data', 'Data', updateRecords());
    assert.equal(result.applied, true, `${name}: ui.update_data must be accepted`);
    const state = labelValue(rt, 'feishu_ui_manager_state');
    assert.equal(state?.update?.current?.record_count, 2, `${name}: update current record count`);
    assert.equal(state?.update?.history?.length, 1, `${name}: update history length`);
    assert.equal(labelValue(rt, 'feishu_ui_manager_last_result')?.action, 'update_data', `${name}: last result action`);
    assert.equal(uiEvents(rt).at(-1)?.payload.action, 'update_data', `${name}: UI intercept action`);
  }
}

async function test_tmp_data_records_temporary_state_without_history() {
  for (const [name, Runtime] of runtimeVariants) {
    const rt = new Runtime();
    const result = dispatchUi(rt, 'ui.tmp_data', 'Data', [mt('text', 'str', 'draft', '0.1', 0, 1, 0)]);
    assert.equal(result.applied, true, `${name}: ui.tmp_data must be accepted`);
    const state = labelValue(rt, 'feishu_ui_manager_state');
    assert.equal(state?.tmp?.current?.record_count, 1, `${name}: tmp current record count`);
    assert.equal(state?.update?.history?.length, 0, `${name}: tmp data must not append update history`);
    assert.equal(labelValue(rt, 'feishu_ui_manager_last_result')?.temporary, true, `${name}: tmp last result temporary`);
  }
}

async function test_form_data_records_submission() {
  for (const [name, Runtime] of runtimeVariants) {
    const rt = new Runtime();
    const result = dispatchUi(rt, 'ui.form_data', 'Data', formRecords());
    assert.equal(result.applied, true, `${name}: ui.form_data must be accepted`);
    const state = labelValue(rt, 'feishu_ui_manager_state');
    assert.equal(state?.form?.submissions?.length, 1, `${name}: form submission count`);
    assert.equal(state?.form?.submissions?.[0]?.records?.[0]?.k, 'data1', `${name}: form submission record`);
  }
}

async function test_refresh_data_records_pending_refresh_without_response() {
  for (const [name, Runtime] of runtimeVariants) {
    const rt = new Runtime();
    const result = dispatchUi(rt, 'ui.refresh_data', 'Data', refreshRecords());
    assert.equal(result.applied, true, `${name}: ui.refresh_data must be accepted`);
    const state = labelValue(rt, 'feishu_ui_manager_state');
    assert.equal(state?.refresh?.pending?.record_count, 2, `${name}: refresh pending count`);
    assert.equal(labelValue(rt, 'feishu_ui_manager_last_result')?.action, 'refresh_data', `${name}: refresh last result`);
    const busOutEvents = rt.intercepts.list().filter((entry) => entry.type === 'mqtt_publish' || entry.type === 'feishu_message_api_response');
    assert.equal(busOutEvents.length, 0, `${name}: ui.refresh_data must not synthesize a response`);
  }
}

async function test_ui_messages_require_payload_records() {
  for (const [name, Runtime] of runtimeVariants) {
    const rt = new Runtime();
    const result = dispatchUi(rt, 'ui.update_data', 'Data');
    assert.equal(result.applied, false, `${name}: empty ui.update_data must reject`);
    assert.equal(latestRejectedReason(rt), 'bus_in_missing_ui_payload_records', `${name}: missing UI payload reason`);
  }
}

async function test_ui_messages_require_data_payload_root() {
  for (const [name, Runtime] of runtimeVariants) {
    const rt = new Runtime();
    const result = dispatchUi(rt, 'ui.refresh_data', 'Flow', refreshRecords());
    assert.equal(result.applied, false, `${name}: ui.refresh_data with Flow payload root must reject`);
    assert.equal(latestRejectedReason(rt), 'bus_in_invalid_ui_payload_type', `${name}: invalid UI payload type reason`);
  }
}

const tests = [
  test_update_data_records_current_state_and_history,
  test_tmp_data_records_temporary_state_without_history,
  test_form_data_records_submission,
  test_refresh_data_records_pending_refresh_without_response,
  test_ui_messages_require_payload_records,
  test_ui_messages_require_data_payload_root,
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
