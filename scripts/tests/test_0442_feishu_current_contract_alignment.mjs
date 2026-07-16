import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import {
  DEFAULT_TOPIC_BASE,
  pinPayloadV2Records,
} from '../lib/pin_payload_v2_test_helpers.mjs';

const require = createRequire(import.meta.url);
const cjsRuntime = require('../../packages/worker-base/src/runtime.js');
const esmRuntime = await import('../../packages/worker-base/src/runtime.mjs');

const runtimeVariants = [
  ['cjs', cjsRuntime.ModelTableRuntime],
  ['esm', esmRuntime.ModelTableRuntime],
];

const LEGACY_REJECTION_REASON = 'bus_in_legacy_feishu_message_api_v1_removed';

const legacyModel0LabelKeys = [
  'feishu_message_api_last_type',
  'feishu_message_api_last_family',
  'feishu_message_api_last_action',
  'feishu_message_api_last_result',
  'feishu_message_api_response_out',
  'feishu_message_api_response_last_result',
  'feishu_resource_manager_catalog',
  'feishu_resource_manager_last_result',
  'feishu_data_manager_store',
  'feishu_data_manager_last_result',
  'feishu_ui_manager_state',
  'feishu_ui_manager_last_result',
  'feishu_task_manager_tasks',
  'feishu_task_manager_last_result',
];

const legacyInterceptTypes = [
  'feishu_message_api_dispatch',
  'feishu_message_api_response_outbox',
  'feishu_resource_manager_event',
  'feishu_data_manager_event',
  'feishu_ui_manager_event',
  'feishu_task_manager_event',
];

function latestRejectedReason(rt) {
  const events = rt.eventLog.list();
  for (let index = events.length - 1; index >= 0; index -= 1) {
    if (events[index]?.result === 'rejected') return events[index].reason ?? null;
  }
  return null;
}

function assertRejected(rt, result, reason, message) {
  assert.equal(result.applied, false, message);
  assert.equal(latestRejectedReason(rt), reason, `${message}: reason`);
}

function mt(k, t, v, id = '0', p = 0, r = 0, c = 0) {
  return { id, p, r, c, k, t, v };
}

function completeLegacyFeishuMessageApiV1Records() {
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
    mt('origin_pin', 'str', `${DEFAULT_TOPIC_BASE}/U1/2000/result`, '0', 0, 1, 0),
    mt('endpoint_pin', 'str', `${DEFAULT_TOPIC_BASE}/R1/3200/resource`, '0', 0, 1, 0),
    mt('response_pin', 'str', `${DEFAULT_TOPIC_BASE}/U1/2000/result`, '0', 0, 1, 0),
    mt('model_type', 'model.single', 'Data.Single', '0', 0, 1, 1),
    mt('message_server', 'str', 'local', '0', 0, 1, 1),
    mt('between', 'str', 'DEM_V1N', '0', 0, 1, 1),
    mt('model_type', 'model.subtableconnection', 1, '0', 0, 2, 0),
    mt('model_type', 'model.subtable', 'Data', '0.1'),
    mt('model_name', 'model.name', 'payload', '0.1'),
    mt('sys_msg_type', 'str', 'resource.report', '0.1'),
    mt('type', 'str', 'UI', '0.1', 0, 0, 1),
    mt('resource', 'list', ['UI.app1'], '0.1', 0, 0, 1),
  ];
}

function legacyShapeWithOnlyKindChangedToV2() {
  return completeLegacyFeishuMessageApiV1Records().map((record) => (
    record.id === '0'
      && record.p === 0
      && record.r === 0
      && record.c === 1
      && record.k === '__mt_payload_kind'
      ? { ...record, v: 'pin_payload.v2' }
      : record
  ));
}

function formalNumericPinPayloadV2Records(opId) {
  return pinPayloadV2Records({
    opId,
    endpointWorkerId: 'R1',
    endpointTableId: 'host',
    endpointModelId: 100,
    endpointPin: 'submit',
    topic: `${DEFAULT_TOPIC_BASE}/R1/100/submit`,
    responseTopic: `${DEFAULT_TOPIC_BASE}/U1/2000/result`,
    routeKind: 'control',
    originWorkerId: 'U1',
    originTableId: 'host',
    originModelId: 2000,
    originPin: 'send',
    replyTargetWorkerId: 'U1',
    replyTargetTableId: 'host',
    replyTargetModelId: 2000,
    replyTargetPin: 'result',
    payloadModelId: 1,
    payloadRecords: [
      { id: 1, p: 0, r: 0, c: 0, k: 'model_type', t: 'model.table', v: 'Data' },
      { id: 1, p: 0, r: 0, c: 0, k: 'sys_msg_type', t: 'str', v: 'resource.report' },
      { id: 1, p: 0, r: 0, c: 0, k: 'input_value', t: 'str', v: 'generic-v2' },
    ],
    timestamp: 1700000004420,
  });
}

function dispatchControlBus(rt, records, key = 'in3') {
  return rt.addLabel(rt.getModel(0), 0, 0, 0, {
    k: key,
    t: 'pin.bus.cb.in',
    v: records,
  });
}

function legacyFeishuObservability(rt) {
  const root = rt.getModel(0)?.getCell(0, 0, 0);
  return {
    labels: legacyModel0LabelKeys.filter((key) => root?.labels?.has(key)),
    intercepts: rt.intercepts.list()
      .map((entry) => entry?.type)
      .filter((type) => legacyInterceptTypes.includes(type)),
  };
}

function assertLegacyRejectedWithoutModel0SideEffects(rt, records, message) {
  const result = dispatchControlBus(rt, records);
  assertRejected(rt, result, LEGACY_REJECTION_REASON, message);
  assert.equal(
    rt.getModel(0).getCell(0, 0, 0).labels.has('in3'),
    false,
    `${message}: rejected BUS_IN must not be stored`,
  );
  assert.deepEqual(
    legacyFeishuObservability(rt),
    { labels: [], intercepts: [] },
    `${message}: rejected legacy input must not produce Feishu Model0 side effects`,
  );
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

async function test_worker_root_bus_in_rejects_complete_legacy_feishu_message_api_v1_shape() {
  for (const [name, Runtime] of runtimeVariants) {
    assertLegacyRejectedWithoutModel0SideEffects(
      new Runtime(),
      completeLegacyFeishuMessageApiV1Records(),
      `${name}: complete legacy 0/0.1 Feishu Message API v1 shape must be removed`,
    );
  }
}

async function test_worker_root_bus_in_rejects_legacy_shape_with_only_v2_kind() {
  for (const [name, Runtime] of runtimeVariants) {
    assertLegacyRejectedWithoutModel0SideEffects(
      new Runtime(),
      legacyShapeWithOnlyKindChangedToV2(),
      `${name}: changing only legacy payload kind to v2 must not bypass the hard cut`,
    );
  }
}

async function test_worker_root_generic_bus_in_accepts_formal_numeric_pin_payload_v2() {
  for (const [name, Runtime] of runtimeVariants) {
    const rt = new Runtime();
    const records = formalNumericPinPayloadV2Records(`0442_formal_numeric_v2_${name}`);
    assert.equal(
      records.every((record) => Number.isInteger(record.id)
        && Number.isInteger(record.p)
        && Number.isInteger(record.r)
        && Number.isInteger(record.c)),
      true,
      `${name}: formal v2 must use numeric ModelTable coordinates`,
    );
    const result = dispatchControlBus(rt, records);
    assert.equal(result.applied, true, `${name}: generic Model0 BUS_IN must accept formal numeric pin_payload.v2`);
    assert.deepEqual(
      legacyFeishuObservability(rt),
      { labels: [], intercepts: [] },
      `${name}: generic formal v2 must not trigger removed Feishu Model0 behavior`,
    );
  }
}

async function test_explicit_v2_route_metadata_is_required_without_autofill() {
  const requiredRouteFields = [
    ['endpoint_worker_id', 'invalid_pin_payload_records'],
    ['endpoint_table_id', 'missing_endpoint_table_id'],
    ['endpoint_model_id', 'invalid_pin_payload_records'],
    ['endpoint_pin', 'invalid_pin_payload_records'],
    ['origin_worker_id', 'invalid_pin_payload_records'],
    ['origin_table_id', 'missing_origin_table_id'],
    ['origin_model_id', 'invalid_pin_payload_records'],
    ['origin_pin', 'invalid_pin_payload_records'],
    ['reply_target_worker_id', 'invalid_pin_payload_records'],
    ['reply_target_table_id', 'missing_reply_target_table_id'],
    ['reply_target_model_id', 'invalid_pin_payload_records'],
    ['reply_target_pin', 'invalid_pin_payload_records'],
  ];
  for (const [name, Runtime] of runtimeVariants) {
    for (const [index, [missingKey, expectedCode]] of requiredRouteFields.entries()) {
      const rt = new Runtime();
      const records = formalNumericPinPayloadV2Records(`0442_no_autofill_${name}_${missingKey}`)
        .filter((record) => record.k !== missingKey);
      const beforeValidation = JSON.parse(JSON.stringify(records));
      const parsed = rt._validatePinPayloadRecords(records);
      assert.equal(parsed.ok, false, `${name}/${missingKey}: omitted explicit route field must reject`);
      assert.equal(parsed.code, expectedCode, `${name}/${missingKey}: exact omitted-field rejection`);
      assert.equal(parsed.endpoint, undefined, `${name}/${missingKey}: validator must not synthesize endpoint`);
      assert.equal(parsed.origin, undefined, `${name}/${missingKey}: validator must not synthesize origin`);
      assert.equal(parsed.replyTarget, undefined, `${name}/${missingKey}: validator must not synthesize reply target`);
      assert.deepEqual(records, beforeValidation, `${name}/${missingKey}: validation must not mutate or auto-fill the payload`);

      const busKey = `route_missing_${index}`;
      const result = dispatchControlBus(rt, records, busKey);
      assert.equal(result.applied, false, `${name}/${missingKey}: Model 0 BUS_IN must fail closed`);
      assert.equal(
        rt.getModel(0).getCell(0, 0, 0).labels.has(busKey),
        false,
        `${name}/${missingKey}: rejected route must not be stored after an implicit fill`,
      );
    }
  }
}

const tests = [
  test_model_v1n_is_accepted_at_worker_root,
  test_model_v1n_is_rejected_outside_worker_root,
  test_numeric_subtableconnection_is_normalized_from_feishu_input,
  test_worker_root_bus_in_rejects_complete_legacy_feishu_message_api_v1_shape,
  test_worker_root_bus_in_rejects_legacy_shape_with_only_v2_kind,
  test_worker_root_generic_bus_in_accepts_formal_numeric_pin_payload_v2,
  test_explicit_v2_route_metadata_is_required_without_autofill,
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
