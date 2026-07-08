import assert from 'node:assert';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const cjsRuntime = require('../../packages/worker-base/src/runtime.js');
const esmRuntime = await import('../../packages/worker-base/src/runtime.mjs');

const runtimeVariants = [
  ['cjs', cjsRuntime.ModelTableRuntime],
  ['esm', esmRuntime.ModelTableRuntime],
];

function latestReason(rt) {
  const events = rt.eventLog.list();
  return events.length ? events[events.length - 1].reason : null;
}

function latestRejectedReason(rt) {
  const events = rt.eventLog.list();
  for (let index = events.length - 1; index >= 0; index -= 1) {
    if (events[index].result === 'rejected') return events[index].reason;
  }
  return latestReason(rt);
}

function assertRejected(rt, result, reason, message) {
  assert.equal(result.applied, false, message);
  assert.equal(latestRejectedReason(rt), reason, `${message}: reason`);
}

function mt(k, t, v, id = '0', p = 0, r = 0, c = 0) {
  return { id, p, r, c, k, t, v };
}

function feishuResourceRequestMessage() {
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
    mt('endpoint_pin', 'str', 'UIPUT/ws/dam/pic/de/R1/0.3000/submit1', '0', 0, 1, 0),
    mt('response_pin', 'str', 'UIPUT/ws/dam/pic/de/U1/0.2000/result', '0', 0, 1, 0),
    mt('model_type', 'model.single', 'Data.Single', '0', 0, 1, 1),
    mt('message_server', 'str', 'local', '0', 0, 1, 1),
    mt('between', 'str', 'DEM_V1N', '0', 0, 1, 1),
    mt('model_type', 'model.subtableconnection', 1, '0', 0, 2, 0),
    mt('model_type', 'model.subtable', 'Data', '0.1'),
    mt('model_name', 'model.name', 'payload', '0.1'),
    mt('sys_msg_type', 'str', 'resource.request', '0.1'),
  ];
}

function withEnvelopeLabel(records, key, value) {
  return records.map((record) => (
    record.id === '0' && record.p === 0 && record.r === 1 && record.c === 0 && record.k === key
      ? { ...record, v: value }
      : record
  ));
}

function withControlBusLabel(records, key, value) {
  return records.map((record) => (
    record.id === '0' && record.p === 0 && record.r === 1 && record.c === 1 && record.k === key
      ? { ...record, v: value }
      : record
  ));
}

function withPayloadSysMsgType(records, sysMsgType) {
  return records.map((record) => (
    record.id === '0.1' && record.k === 'sys_msg_type'
      ? { ...record, v: sysMsgType }
      : record
  ));
}

function feishuTaskMessage(endpointPin = 'UIPUT/ws/dam/pic/de/R1/0.3000/add_task') {
  return withPayloadSysMsgType(
    withEnvelopeLabel(feishuResourceRequestMessage(), 'endpoint_pin', endpointPin),
    'task_data',
  );
}

function feishuManageMessage() {
  return [
    ...withEnvelopeLabel(feishuResourceRequestMessage(), 'route_kind', 'manage'),
    mt('send_user', 'str', '@drop:dongyudigital.com', '0', 0, 1, 1),
    mt('receive_user', 'str', '@mbr:dongyudigital.com', '0', 0, 1, 1),
  ];
}

async function test_model_v1n_is_accepted_at_worker_root() {
  for (const [name, Runtime] of runtimeVariants) {
    const rt = new Runtime();
    const result = rt.addLabel(rt.getModel(0), 0, 0, 0, {
      k: 'model_type',
      t: 'model.v1n',
      v: '',
    });
    assert.equal(result.applied, true, `${name}: model.v1n must be accepted at worker root`);
    assert.equal(rt.getModel(0).getCell(0, 0, 0).labels.get('model_type')?.t, 'model.v1n', `${name}: model.v1n must be stored as current Feishu label.t`);
  }
}

async function test_model_v1n_is_rejected_outside_worker_root() {
  for (const [name, Runtime] of runtimeVariants) {
    const rt = new Runtime();
    const child = rt.createModel({ id: 100, name: 'child', type: 'test' });
    const result = rt.addLabel(child, 0, 0, 0, {
      k: 'model_type',
      t: 'model.v1n',
      v: '',
    });
    assertRejected(rt, result, 'model_v1n_requires_worker_root', `${name}: model.v1n must be scoped to software worker root`);
  }
}

async function test_numeric_subtableconnection_is_normalized_from_feishu_input() {
  for (const [name, Runtime] of runtimeVariants) {
    const rt = new Runtime();
    const host = rt.getModel(0);
    const result = rt.addLabel(host, 2, 0, 0, {
      k: 'model_type',
      t: 'model.subtableconnection',
      v: 1,
    });
    assert.equal(result.applied, true, `${name}: numeric Feishu subtableconnection must be accepted`);
    const mount = [...rt.subtableMounts.values()].find((entry) => entry.parent.model_id === 0 && entry.hostingCell.p === 2);
    assert.ok(mount, `${name}: numeric Feishu subtableconnection must create a child table mount`);
    assert.equal(mount.root_model_id, 0, `${name}: numeric Feishu child table root model must be 0`);
    assert.match(mount.table_id, /(?:^|[.:])1$/u, `${name}: child table id must derive from numeric Feishu child id`);
  }
}

async function test_feishu_pin_payload_v1_child_table_payload_is_parsed() {
  const api = await import('../lib/feishu_message_api_v1.mjs');
  const parsed = api.parseFeishuPinPayloadV1(feishuResourceRequestMessage());
  assert.equal(parsed.ok, true, 'Feishu pin_payload.v1 message must parse');
  assert.equal(parsed.kind, 'pin_payload.v1');
  assert.equal(parsed.payloadTableId, '0.1');
  assert.equal(parsed.routeKind, 'control');
  assert.equal(parsed.isNeedResponse, true);
  assert.equal(parsed.sysMsgType, 'resource.request');
  assert.equal(parsed.payloadRecords.length, 3);
}

async function test_feishu_message_api_recognizes_documented_sys_msg_types() {
  const api = await import('../lib/feishu_message_api_v1.mjs');
  for (const value of [
    'resource.report',
    'resource.request',
    'resource.result',
    'data.save_modeltable',
    'data.load_modeltable',
    'data.save_flow',
    'data.load_flow',
    'ui.update_data',
    'ui.tmp_data',
    'ui.form_data',
    'ui.refresh_data',
    'task_data',
  ]) {
    assert.equal(api.isDocumentedFeishuSysMsgType(value), true, `${value} must be recognized`);
  }
  assert.equal(api.isDocumentedFeishuSysMsgType('resource.unknown'), false, 'unknown sys_msg_type must fail closed');
}

async function test_feishu_message_api_rejects_unknown_sys_msg_type() {
  const api = await import('../lib/feishu_message_api_v1.mjs');
  const parsed = api.parseFeishuPinPayloadV1(withPayloadSysMsgType(feishuResourceRequestMessage(), 'resource.unknown'));
  assert.equal(parsed.ok, false, 'unknown sys_msg_type must reject the message');
  assert.equal(parsed.code, 'unknown_sys_msg_type');
}

async function test_feishu_message_api_rejects_invalid_bus_metadata() {
  const api = await import('../lib/feishu_message_api_v1.mjs');
  const parsed = api.parseFeishuPinPayloadV1(withControlBusLabel(feishuResourceRequestMessage(), 'message_server', 'remote'));
  assert.equal(parsed.ok, false, 'invalid message_server must reject the message');
  assert.equal(parsed.code, 'invalid_message_server');
}

async function test_feishu_message_api_accepts_manage_route_users() {
  const api = await import('../lib/feishu_message_api_v1.mjs');
  const parsed = api.parseFeishuPinPayloadV1(feishuManageMessage());
  assert.equal(parsed.ok, true, 'manage route with documented users must parse');
  assert.equal(parsed.routeKind, 'manage');
  assert.equal(parsed.sendUser, '@drop:dongyudigital.com');
  assert.equal(parsed.receiveUser, '@mbr:dongyudigital.com');
}

async function test_feishu_message_api_recognizes_documented_task_pins() {
  const api = await import('../lib/feishu_message_api_v1.mjs');
  for (const value of [
    'add_task',
    'add_task_return',
    'edit_task',
    'delete_task',
    'receive_task',
    'finish_task',
    'archive_task',
  ]) {
    assert.equal(api.isDocumentedFeishuTaskPin(value), true, `${value} must be recognized`);
  }
  assert.equal(api.isDocumentedFeishuTaskPin('restore_task'), false, 'unknown task pin must fail closed');
}

async function test_feishu_message_api_rejects_task_data_unknown_task_pin() {
  const api = await import('../lib/feishu_message_api_v1.mjs');
  const parsed = api.parseFeishuPinPayloadV1(feishuTaskMessage('UIPUT/ws/dam/pic/de/R1/0.3000/restore_task'));
  assert.equal(parsed.ok, false, 'task_data must target a documented task pin');
  assert.equal(parsed.code, 'unknown_task_pin');
}

async function test_worker_root_bus_in_accepts_feishu_pin_payload_v1_records() {
  for (const [name, Runtime] of runtimeVariants) {
    const rt = new Runtime();
    const model0 = rt.getModel(0);
    const result = rt.addLabel(model0, 0, 0, 0, {
      k: 'in3',
      t: 'pin.bus.cb.in',
      v: feishuResourceRequestMessage(),
    });
    assert.equal(result.applied, true, `${name}: worker root bus in must accept Feishu pin_payload.v1 records`);
  }
}

async function test_worker_root_bus_in_rejects_unknown_feishu_sys_msg_type() {
  for (const [name, Runtime] of runtimeVariants) {
    const rt = new Runtime();
    const model0 = rt.getModel(0);
    const result = rt.addLabel(model0, 0, 0, 0, {
      k: 'in3',
      t: 'pin.bus.cb.in',
      v: withPayloadSysMsgType(feishuResourceRequestMessage(), 'resource.unknown'),
    });
    assertRejected(rt, result, 'bus_in_unknown_sys_msg_type', `${name}: unknown Feishu sys_msg_type must fail closed at bus ingress`);
  }
}

async function test_worker_root_bus_in_rejects_invalid_feishu_bus_metadata() {
  for (const [name, Runtime] of runtimeVariants) {
    const rt = new Runtime();
    const model0 = rt.getModel(0);
    const result = rt.addLabel(model0, 0, 0, 0, {
      k: 'in3',
      t: 'pin.bus.cb.in',
      v: withControlBusLabel(feishuResourceRequestMessage(), 'message_server', 'remote'),
    });
    assertRejected(rt, result, 'bus_in_invalid_message_server', `${name}: invalid Feishu message_server must fail closed at bus ingress`);
  }
}

async function test_worker_root_bus_in_rejects_task_data_unknown_task_pin() {
  for (const [name, Runtime] of runtimeVariants) {
    const rt = new Runtime();
    const model0 = rt.getModel(0);
    const result = rt.addLabel(model0, 0, 0, 0, {
      k: 'in3',
      t: 'pin.bus.cb.in',
      v: feishuTaskMessage('UIPUT/ws/dam/pic/de/R1/0.3000/restore_task'),
    });
    assertRejected(rt, result, 'bus_in_unknown_task_pin', `${name}: task_data must fail closed on undocumented task pins`);
  }
}

const tests = [
  test_model_v1n_is_accepted_at_worker_root,
  test_model_v1n_is_rejected_outside_worker_root,
  test_numeric_subtableconnection_is_normalized_from_feishu_input,
  test_feishu_pin_payload_v1_child_table_payload_is_parsed,
  test_feishu_message_api_recognizes_documented_sys_msg_types,
  test_feishu_message_api_rejects_unknown_sys_msg_type,
  test_feishu_message_api_rejects_invalid_bus_metadata,
  test_feishu_message_api_accepts_manage_route_users,
  test_feishu_message_api_recognizes_documented_task_pins,
  test_feishu_message_api_rejects_task_data_unknown_task_pin,
  test_worker_root_bus_in_accepts_feishu_pin_payload_v1_records,
  test_worker_root_bus_in_rejects_unknown_feishu_sys_msg_type,
  test_worker_root_bus_in_rejects_invalid_feishu_bus_metadata,
  test_worker_root_bus_in_rejects_task_data_unknown_task_pin,
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
