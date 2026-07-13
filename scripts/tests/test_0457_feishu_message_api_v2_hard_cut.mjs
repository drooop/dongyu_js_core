import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import {
  DEFAULT_TOPIC_BASE,
  externalPacket,
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
const APP_TABLE = 'app:0457:hard-cut';
const RESPONSE_TOPIC = `${DEFAULT_TOPIC_BASE}/U1/2000/result`;

const legacyManagerStateKeys = [
  'feishuResourceManager',
  'feishuDataManager',
  'feishuUiManager',
  'feishuTaskManager',
];

const legacyRuntimeMethods = [
  '_feishuRecordId',
  '_isFeishuMessageRecord',
  '_feishuPayloadLabel',
  '_feishuPayloadValue',
  '_feishuPayloadValueFromCells',
  '_isNonBlankFeishuString',
  '_feishuEndpointPinName',
  '_feishuPayloadLabelAnyCell',
  '_feishuPayloadFields',
  '_validateFeishuRequiredPayloadField',
  '_isDocumentedFeishuSysMsgType',
  '_isDocumentedFeishuTaskPin',
  '_validateFeishuTaskPayloadFields',
  '_validateFeishuPinPayloadV1Records',
  '_isFeishuPinPayloadV1Records',
  '_feishuMessageApiDispatchInfo',
  '_applyFeishuMessageApiDispatch',
  '_feishuTopicEndpoint',
  '_feishuResponsePayloadRecord',
  '_feishuRouteKindForResponse',
  '_feishuLatestHandlerResult',
  '_writeFeishuMessageApiResponseResult',
  '_skipFeishuMessageApiResponse',
  '_applyFeishuMessageApiResponseOutbox',
  '_cloneFeishuRecord',
  '_feishuDataPayloadRootType',
  '_isFeishuDataPayloadMetadataRecord',
  '_feishuDataPayloadRecords',
  '_feishuDataMessageKind',
  '_feishuDataMessageSlot',
  '_validateFeishuDataManagerState',
  '_feishuDataManagerSnapshot',
  '_writeFeishuDataManagerResult',
  '_applyFeishuDataManagerMessage',
  '_validateFeishuUiManagerState',
  '_feishuUiManagerSnapshot',
  '_writeFeishuUiManagerResult',
  '_applyFeishuUiManagerMessage',
  '_feishuResourceEntries',
  '_validateFeishuResourceManagerState',
  '_feishuResourceCatalogSnapshot',
  '_writeFeishuResourceManagerResult',
  '_applyFeishuResourceManagerMessage',
  '_feishuTaskById',
  '_validateFeishuTaskManagerState',
  '_feishuTaskList',
  '_writeFeishuTaskManagerResult',
  '_applyFeishuTaskManagerMessage',
];

// `_cloneFeishuValue` is intentionally not treated as removable by name here.
// Its current deep-clone behavior is generic materialization behavior and is
// guarded semantically below, so production may retain or rename the helper.
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

function legacyMt(k, t, v, id = '0', p = 0, r = 0, c = 0) {
  return { id, p, r, c, k, t, v };
}

function payloadRecord(k, t, v, { p = 0, r = 0, c = 0 } = {}) {
  return { id: 1, p, r, c, k, t, v };
}

function completeLegacyFeishuRecords() {
  return [
    legacyMt('model_type', 'model.subtable', 'Data'),
    legacyMt('model_type', 'model.single', 'Data.Single', '0', 0, 0, 1),
    legacyMt('__mt_payload_kind', 'str', 'pin_payload.v1', '0', 0, 0, 1),
    legacyMt('is_need_response', 'bool', true, '0', 0, 0, 1),
    legacyMt('model_type', 'model.matrix', 'Data', '0', 0, 1, 0),
    legacyMt('model_size', 'model.matrix.size', {
      min_p: 0,
      min_r: 1,
      min_c: 0,
      max_p: 0,
      max_r: 1,
      max_c: 2,
    }, '0', 0, 1, 0),
    legacyMt('route_kind', 'str', 'control', '0', 0, 1, 0),
    legacyMt('origin_pin', 'str', RESPONSE_TOPIC, '0', 0, 1, 0),
    legacyMt('endpoint_pin', 'str', `${DEFAULT_TOPIC_BASE}/R1/3200/resource`, '0', 0, 1, 0),
    legacyMt('response_pin', 'str', RESPONSE_TOPIC, '0', 0, 1, 0),
    legacyMt('model_type', 'model.single', 'Data.Single', '0', 0, 1, 1),
    legacyMt('message_server', 'str', 'local', '0', 0, 1, 1),
    legacyMt('between', 'str', 'DEM_V1N', '0', 0, 1, 1),
    legacyMt('model_type', 'model.subtableconnection', 1, '0', 0, 2, 0),
    legacyMt('model_type', 'model.subtable', 'Data', '0.1'),
    legacyMt('model_name', 'model.name', 'payload', '0.1'),
    legacyMt('sys_msg_type', 'str', 'resource.report', '0.1'),
    legacyMt('type', 'str', 'UI', '0.1', 0, 0, 1),
    legacyMt('resource', 'list', ['UI.app1'], '0.1', 0, 0, 1),
  ];
}

function legacyShapeWithKind(kind) {
  return completeLegacyFeishuRecords().map((record) => (
    record.id === '0'
      && record.p === 0
      && record.r === 0
      && record.c === 1
      && record.k === '__mt_payload_kind'
      ? { ...record, v: kind }
      : record
  ));
}

function genericV2Records({ opId, includeSysMsgType = false } = {}) {
  return pinPayloadV2Records({
    opId,
    endpointWorkerId: 'R1',
    endpointTableId: 'host',
    endpointModelId: 100,
    endpointPin: 'submit',
    topic: `${DEFAULT_TOPIC_BASE}/R1/100/submit`,
    responseTopic: RESPONSE_TOPIC,
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
      payloadRecord('model_type', 'model.table', 'Data'),
      ...(includeSysMsgType ? [payloadRecord('sys_msg_type', 'str', 'resource.report')] : []),
      payloadRecord('input_value', 'str', 'ordinary-model100-request'),
    ],
    timestamp: 1700000005700,
  });
}

function dispatchControlBus(runtime, records) {
  return runtime.addLabel(runtime.getModel(0), 0, 0, 0, {
    k: 'in3',
    t: 'pin.bus.cb.in',
    v: records,
  });
}

function latestRejectedReason(runtime) {
  const events = runtime.eventLog.list();
  for (let index = events.length - 1; index >= 0; index -= 1) {
    if (events[index]?.result === 'rejected') return events[index].reason ?? null;
  }
  return null;
}

function legacyObservability(runtime) {
  const model0 = runtime.getModel(0);
  const root = model0 ? model0.getCell(0, 0, 0) : null;
  const labels = legacyModel0LabelKeys.filter((key) => root?.labels?.has(key));
  const intercepts = runtime.intercepts.list()
    .map((entry) => entry?.type)
    .filter((type) => legacyInterceptTypes.includes(type));
  return { labels, intercepts };
}

function setupResponseReceiver(Runtime) {
  const runtime = new Runtime();
  const model0 = runtime.getModel(0);
  runtime.addLabel(model0, 0, 0, 0, { k: 'mqtt_topic_mode', t: 'str', v: 'uiput_mm_v1' });
  runtime.addLabel(model0, 0, 0, 0, { k: 'mqtt_topic_base', t: 'str', v: DEFAULT_TOPIC_BASE });
  runtime.addLabel(model0, 0, 0, 0, { k: 'mqtt_worker_id', t: 'str', v: 'U1' });
  runtime.addLabel(model0, 0, 0, 0, { k: 'mqtt_payload_mode', t: 'str', v: 'pin_payload_v1' });
  const target = runtime.createModel({
    table_id: APP_TABLE,
    id: 0,
    name: '0457 hard-cut reply target',
    type: 'app',
  });
  runtime.addLabel(target, 0, 0, 0, { k: 'model_type', t: 'model.subtable', v: 'UI.App' });
  runtime.setRuntimeMode('edit');
  runtime.setRuntimeMode('running');
  return { runtime, target };
}

function tableQualifiedResponseRecords(handlerResult) {
  return pinPayloadV2Records({
    opId: '0457_hard_cut_materialize',
    messageRole: 'response',
    endpointWorkerId: 'U1',
    endpointTableId: 'host',
    endpointModelId: 2000,
    endpointPin: 'result',
    topic: RESPONSE_TOPIC,
    responseTopic: RESPONSE_TOPIC,
    routeKind: 'control',
    originWorkerId: 'R1',
    originTableId: 'host',
    originModelId: 3200,
    originPin: 'resource',
    replyTargetWorkerId: 'U1',
    replyTargetTableId: APP_TABLE,
    replyTargetModelId: 0,
    replyTargetPin: 'result',
    payloadModelId: 1,
    payloadRecords: [
      payloadRecord('materialized_result', 'str', 'remote ok'),
      payloadRecord('handler_result', 'json', handlerResult),
    ],
    timestamp: 1700000005701,
  });
}

function makeVariantTests(name, Runtime) {
  return [
    {
      kind: 'EXPECTED_RED',
      name: `${name}_complete_legacy_0_0_1_shape_is_explicitly_rejected`,
      run() {
        const runtime = new Runtime();
        const result = dispatchControlBus(runtime, completeLegacyFeishuRecords());
        assert.deepEqual({
          applied: result?.applied ?? null,
          reason: latestRejectedReason(runtime),
        }, {
          applied: false,
          reason: LEGACY_REJECTION_REASON,
        });
      },
    },
    {
      kind: 'EXPECTED_RED',
      name: `${name}_legacy_0_0_1_shape_with_v2_kind_is_still_explicitly_rejected`,
      run() {
        const runtime = new Runtime();
        const result = dispatchControlBus(runtime, legacyShapeWithKind('pin_payload.v2'));
        assert.deepEqual({
          applied: result?.applied ?? null,
          reason: latestRejectedReason(runtime),
        }, {
          applied: false,
          reason: LEGACY_REJECTION_REASON,
        });
      },
    },
    {
      kind: 'PRESERVATION',
      name: `${name}_formal_numeric_v2_remains_accepted`,
      run() {
        const runtime = new Runtime();
        const result = dispatchControlBus(runtime, genericV2Records({ opId: `0457_hard_cut_plain_${name}` }));
        assert.equal(result?.applied, true, 'formal numeric v2 must remain accepted at the generic bus boundary');
      },
    },
    {
      kind: 'PRESERVATION',
      name: `${name}_non3200_sys_msg_type_remains_ordinary_transport`,
      run() {
        const runtime = new Runtime();
        const result = dispatchControlBus(runtime, genericV2Records({
          opId: `0457_hard_cut_non3200_${name}`,
          includeSysMsgType: true,
        }));
        assert.equal(result?.applied, true, 'non-3200 v2 with sys_msg_type must remain valid generic transport');
        assert.deepEqual(
          legacyObservability(runtime),
          { labels: [], intercepts: [] },
          'sys_msg_type outside Model 3200 must not trigger legacy Feishu business behavior',
        );
      },
    },
    {
      kind: 'EXPECTED_RED',
      name: `${name}_runtime_has_no_legacy_manager_instance_state`,
      run() {
        const runtime = new Runtime();
        const present = legacyManagerStateKeys.filter((key) => Object.prototype.hasOwnProperty.call(runtime, key));
        assert.deepEqual(present, []);
      },
    },
    {
      kind: 'EXPECTED_RED',
      name: `${name}_runtime_has_no_legacy_parser_dispatch_or_manager_methods`,
      run() {
        const runtime = new Runtime();
        const present = legacyRuntimeMethods.filter((key) => typeof runtime[key] === 'function');
        assert.deepEqual(present, []);
      },
    },
    {
      kind: 'EXPECTED_RED',
      name: `${name}_legacy_input_creates_no_model0_feishu_labels_or_intercepts`,
      run() {
        const runtime = new Runtime();
        dispatchControlBus(runtime, completeLegacyFeishuRecords());
        assert.deepEqual(legacyObservability(runtime), { labels: [], intercepts: [] });
      },
    },
    {
      kind: 'PRESERVATION',
      name: `${name}_table_qualified_v2_response_materializes_with_deep_clone`,
      run() {
        const { runtime, target } = setupResponseReceiver(Runtime);
        const sourceHandlerResult = {
          status: 'accepted',
          nested: { value: 'original' },
        };
        const responseRecords = tableQualifiedResponseRecords(sourceHandlerResult);
        const accepted = runtime.mqttIncoming(RESPONSE_TOPIC, externalPacket(responseRecords));
        assert.equal(accepted, true, 'valid table-qualified v2 response must still materialize');

        const storedHandlerResult = target.getCell(0, 0, 0).labels.get('handler_result')?.v;
        assert.deepEqual(storedHandlerResult, {
          status: 'accepted',
          nested: { value: 'original' },
        });
        assert.notStrictEqual(storedHandlerResult, sourceHandlerResult, 'materialization must deep-clone JSON values');

        sourceHandlerResult.nested.value = 'mutated-after-materialization';
        assert.equal(
          target.getCell(0, 0, 0).labels.get('handler_result')?.v?.nested?.value,
          'original',
          'mutating the inbound packet after delivery must not mutate ModelTable state',
        );
        assert.equal(
          runtime.getModel(0).getCell(0, 0, 0).labels.get('pin_payload_response_materialize_last_result')?.v?.status,
          'applied',
          'generic materialization must remain ModelTable-visible',
        );
        assert.equal(
          runtime.intercepts.list().some((entry) => entry?.type === 'pin_payload_response_materialize' && entry.payload?.status === 'applied'),
          true,
          'generic materialization intercept must remain available',
        );
        assert.deepEqual(
          legacyObservability(runtime),
          { labels: [], intercepts: [] },
          'generic response materialization must not invoke legacy Feishu behavior',
        );
      },
    },
  ];
}

const tests = [
  ...runtimeVariants.flatMap(([name, Runtime]) => makeVariantTests(name, Runtime)),
  {
    kind: 'EXPECTED_RED',
    name: 'standalone_feishu_parser_surfaces_are_absent',
    run() {
      const parserSurfaces = readdirSync(new URL('../lib/', import.meta.url))
        .filter((name) => /^feishu_message_api.*\.mjs$/u.test(name))
        .sort();
      assert.deepEqual(
        parserSurfaces,
        [],
        'neither the standalone v1 parser nor a replacement standalone v2 parser may remain',
      );
    },
  },
];

let failed = 0;
let expectedRedFailures = 0;
let preservationFailures = 0;
for (const test of tests) {
  try {
    await test.run();
    console.log(`[PASS][${test.kind}] ${test.name}`);
  } catch (error) {
    failed += 1;
    if (test.kind === 'EXPECTED_RED') expectedRedFailures += 1;
    if (test.kind === 'PRESERVATION') preservationFailures += 1;
    console.error(`[FAIL][${test.kind}] ${test.name}`);
    console.error(error && error.stack ? error.stack : error);
  }
}

const passed = tests.length - failed;
if (failed > 0) {
  console.error(
    `${failed} failed, ${passed} passed out of ${tests.length}; `
      + `${expectedRedFailures} expected RED failures, ${preservationFailures} preservation failures`,
  );
  process.exit(1);
}

console.log(`${tests.length} passed, 0 failed out of ${tests.length}`);
