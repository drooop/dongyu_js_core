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

function payloadLabel(model, key) {
  return model.getCell(0, 0, 0).labels.get(key) || null;
}

function feishuMessage({
  sysMsgType,
  endpointPin = 'UIPUT/ws/dam/pic/de/R1/0.3000/submit1',
  payloadType = 'Data',
  payloadRecords = [],
}) {
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
    mt('endpoint_pin', 'str', endpointPin, '0', 0, 1, 0),
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

function taskPayloadRecords(overrides = {}) {
  const fields = {
    title: '任务标题',
    body: '任务内容',
    publisher: '任务发布者',
    publish_time: '任务发布时间',
    ...overrides,
  };
  const records = [mt('model_type', 'model.single', 'Data.Single', '0.1', 0, 0, 1)];
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) records.push(mt(key, 'str', value, '0.1', 0, 0, 1));
  }
  return records;
}

function dispatchMessage(rt, message) {
  const model0 = rt.getModel(0);
  return rt.addLabel(model0, 0, 0, 0, {
    k: 'in3',
    t: 'pin.bus.cb.in',
    v: message,
  });
}

function assertDispatch(rt, expected) {
  const dispatch = rt.intercepts.list().filter((entry) => entry.type === 'feishu_message_api_dispatch').at(-1);
  assert.ok(dispatch, 'dispatch intercept must be recorded');
  assert.equal(dispatch.payload.status, 'accepted');
  assert.equal(dispatch.payload.sys_msg_type, expected.sysMsgType);
  assert.equal(dispatch.payload.family, expected.family);
  assert.equal(dispatch.payload.action, expected.action);
  assert.equal(dispatch.payload.payload_table_id, '0.1');

  const model0 = rt.getModel(0);
  assert.equal(payloadLabel(model0, 'feishu_message_api_last_type')?.v, expected.sysMsgType);
  assert.equal(payloadLabel(model0, 'feishu_message_api_last_family')?.v, expected.family);
  assert.equal(payloadLabel(model0, 'feishu_message_api_last_action')?.v, expected.action);
  assert.equal(payloadLabel(model0, 'feishu_message_api_last_result')?.v?.status, 'accepted');
}

async function test_resource_message_dispatches_to_resource_handler() {
  for (const [name, Runtime] of runtimeVariants) {
    const rt = new Runtime();
    const result = dispatchMessage(rt, feishuMessage({
      sysMsgType: 'resource.report',
      payloadRecords: [
        mt('type', 'str', 'UI', '0.1', 0, 0, 1),
        mt('resource', 'list', ['UI.app1'], '0.1', 0, 0, 1),
      ],
    }));
    assert.equal(result.applied, true, `${name}: resource.report message must be accepted`);
    assertDispatch(rt, { sysMsgType: 'resource.report', family: 'resource', action: 'report' });
  }
}

async function test_data_message_dispatches_to_data_handler() {
  for (const [name, Runtime] of runtimeVariants) {
    const rt = new Runtime();
    const result = dispatchMessage(rt, feishuMessage({
      sysMsgType: 'data.save_modeltable',
      payloadRecords: [mt('data1', 'str', 'aa', '0.1', 0, 0, 1)],
    }));
    assert.equal(result.applied, true, `${name}: data.save_modeltable message must be accepted`);
    assertDispatch(rt, { sysMsgType: 'data.save_modeltable', family: 'data', action: 'save_modeltable' });
  }
}

async function test_ui_message_dispatches_to_ui_handler() {
  for (const [name, Runtime] of runtimeVariants) {
    const rt = new Runtime();
    const result = dispatchMessage(rt, feishuMessage({
      sysMsgType: 'ui.refresh_data',
      payloadRecords: [mt('data1', 'str', 'aa', '0.1', 0, 0, 1)],
    }));
    assert.equal(result.applied, true, `${name}: ui.refresh_data message must be accepted`);
    assertDispatch(rt, { sysMsgType: 'ui.refresh_data', family: 'ui', action: 'refresh_data' });
  }
}

async function test_task_message_dispatches_to_task_handler() {
  for (const [name, Runtime] of runtimeVariants) {
    const rt = new Runtime();
    const result = dispatchMessage(rt, feishuMessage({
      sysMsgType: 'task_data',
      endpointPin: 'UIPUT/ws/dam/pic/de/R1/0.3000/add_task',
      payloadRecords: taskPayloadRecords(),
    }));
    assert.equal(result.applied, true, `${name}: task add_task message must be accepted`);
    assertDispatch(rt, { sysMsgType: 'task_data', family: 'task', action: 'add_task' });
  }
}

async function test_task_add_requires_documented_fields() {
  for (const [name, Runtime] of runtimeVariants) {
    const rt = new Runtime();
    const result = dispatchMessage(rt, feishuMessage({
      sysMsgType: 'task_data',
      endpointPin: 'UIPUT/ws/dam/pic/de/R1/0.3000/add_task',
      payloadRecords: taskPayloadRecords({ title: undefined }),
    }));
    assert.equal(result.applied, false, `${name}: add_task without title must reject`);
    assert.equal(latestRejectedReason(rt), 'bus_in_missing_task_field:title', `${name}: missing title reason`);
  }
}

const tests = [
  test_resource_message_dispatches_to_resource_handler,
  test_data_message_dispatches_to_data_handler,
  test_ui_message_dispatches_to_ui_handler,
  test_task_message_dispatches_to_task_handler,
  test_task_add_requires_documented_fields,
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
