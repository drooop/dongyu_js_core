import assert from 'node:assert/strict';
import { loadSsotDeActor } from '../lib/ssot_de_actor_test_helpers.mjs';
import {
  DEFAULT_TOPIC_BASE,
  externalPacket,
  mt,
  payloadValue,
  pinPayloadV2Records,
} from '../lib/pin_payload_v2_test_helpers.mjs';

const model3200Id = 3200;
let requestSequence = 0;

function recordAt(k, t, v, { p = 0, r = 0, c = 0 } = {}) {
  return { id: 1, p, r, c, k, t, v };
}

function resourceRows(uiResources = ['UI.app1', 'UI.app2'], serviceResources = ['calculator']) {
  return [
    recordAt('type', 'str', 'UI', { c: 1 }),
    recordAt('resource', 'list', uiResources, { c: 1 }),
    recordAt('type', 'str', 'service', { c: 2 }),
    recordAt('resource', 'list', serviceResources, { c: 2 }),
  ];
}

function nonRootResourceRows() {
  return [
    recordAt('type', 'str', 'UI', { p: 1 }),
    recordAt('resource', 'list', ['UI.page'], { p: 1 }),
    recordAt('type', 'str', 'service', { r: 1 }),
    recordAt('resource', 'list', ['search'], { r: 1 }),
  ];
}

function resourceRequest(sysMsgType, payloadRecords = [], { isNeedResponse = true } = {}) {
  requestSequence += 1;
  return pinPayloadV2Records({
    opId: `0457_resource_${sysMsgType.replaceAll('.', '_')}_${requestSequence}`,
    endpointWorkerId: 'R1',
    endpointTableId: 'host',
    endpointModelId: model3200Id,
    endpointPin: 'resource',
    topic: `${DEFAULT_TOPIC_BASE}/R1/${model3200Id}/resource`,
    responseTopic: `${DEFAULT_TOPIC_BASE}/U1/1/result`,
    routeKind: 'control',
    originWorkerId: 'U1',
    originTableId: 'app:0457:resource-contract',
    originModelId: 1,
    originPin: 'send',
    replyTargetWorkerId: 'U1',
    replyTargetTableId: 'app:0457:resource-contract',
    replyTargetModelId: 1,
    replyTargetPin: 'result',
    payloadModelId: 1,
    payloadRecords: [
      recordAt('model_type', 'model.table', 'Data'),
      recordAt('sys_msg_type', 'str', sysMsgType),
      ...payloadRecords,
    ],
    extraRecords: [
      mt('is_need_response', 'bool', isNeedResponse),
      mt('message_server', 'str', 'local'),
      mt('between', 'str', 'DEM_V1N'),
    ],
    timestamp: 1700000004500 + requestSequence,
  });
}

function setupActor() {
  const actor = loadSsotDeActor('r1');
  assert.equal(actor.loadRejected, 0, 'R1 patches must load without rejection');
  actor.runtime.setRuntimeMode('edit');
  const mqttStart = actor.runtime.startMqttLoop({
    transport: 'mock',
    host: 'localhost',
    port: 1883,
    client_id: '0457-resource-r1',
    topic_mode: 'uiput_mm_v1',
    topic_base: DEFAULT_TOPIC_BASE,
    worker_id: 'R1',
    payload_mode: 'pin_payload_v1',
  });
  assert.equal(mqttStart.status, 'running', 'R1 mock MQTT client must start');
  actor.runtime.setRuntimeMode('running');
  return actor;
}

async function settlePropagation() {
  for (let index = 0; index < 12; index += 1) {
    await new Promise((resolvePromise) => setImmediate(resolvePromise));
  }
}

async function dispatchResource(actor, sysMsgType, payloadRecords = [], options = {}) {
  const handled = actor.runtime.mqttIncoming(
    `${DEFAULT_TOPIC_BASE}/R1/${model3200Id}/resource`,
    externalPacket(resourceRequest(sysMsgType, payloadRecords, options)),
  );
  await settlePropagation();
  return handled;
}

function model3200Root(actor) {
  return actor.runtime.getModel(model3200Id).getCell(0, 0, 0);
}

function rootValue(actor, key) {
  return model3200Root(actor).labels.get(key)?.v;
}

function catalog(actor) {
  return rootValue(actor, 'feishu_resource_manager_catalog') || {};
}

function lastResult(actor) {
  return rootValue(actor, 'feishu_resource_manager_last_result') || {};
}

function responseHandlerResult(actor) {
  const result = model3200Root(actor).labels.get('result');
  return result && Array.isArray(result.v) ? payloadValue(result.v, 'handler_result', 1) : null;
}

function model0Root(actor) {
  return actor.runtime.getModel(0).getCell(0, 0, 0);
}

function assertResourceRequestTraversedR1Chain(actor) {
  const model0Ingress = model0Root(actor).labels.get('r1_cb_in');
  const dispatcher = actor.runtime.getModel(-10);
  const dispatcherOutput = dispatcher?.getCell(0, 0, 0).labels.get('r1_dispatch_3200_resource');
  const model3200Input = model3200Root(actor).labels.get('resource');

  assert.equal(model0Ingress?.t, 'pin.bus.cb.in', 'request must enter Model 0 control bus');
  assert.equal(dispatcherOutput?.t, 'pin.out', 'request must leave the Model -10 dispatcher');
  assert.equal(model3200Input?.t, 'pin.in', 'request must enter Model 3200 resource pin');

  const opIds = [model0Ingress, dispatcherOutput, model3200Input]
    .map((label) => payloadValue(label.v, 'op_id'));
  assert.match(opIds[0], /^0457_resource_/, 'request op_id must be visible at Model 0 ingress');
  assert.deepEqual(opIds, [opIds[0], opIds[0], opIds[0]], 'same request must traverse Model 0, Model -10, and Model 3200');
}

function publishCount(actor) {
  return actor.runtime.mqttTrace.list().filter((entry) => entry.type === 'publish').length;
}

async function test_resource_report_updates_model3200_catalog() {
  const actor = setupActor();
  assert.equal(await dispatchResource(actor, 'resource.report', resourceRows()), true, 'generic transport must deliver resource.report');
  assertResourceRequestTraversedR1Chain(actor);
  assert.deepEqual(catalog(actor), {
    UI: ['UI.app1', 'UI.app2'],
    service: ['calculator'],
  }, 'Model 3200 visible resource catalog');
  assert.equal(lastResult(actor).action, 'report', 'last result action');
  assert.equal(lastResult(actor).entries.length, 2, 'last result entries');
  assert.equal(responseHandlerResult(actor)?.action, 'report', 'response comes from resource handler');
  assert.deepEqual(responseHandlerResult(actor)?.catalog, catalog(actor), 'response contains resource catalog');
  assert.equal(publishCount(actor), 1, 'response-enabled report proves mock MQTT publish baseline');
  assert.equal(
    actor.runtime.mqttTrace.list().find((entry) => entry.type === 'publish')?.payload?.topic,
    `${DEFAULT_TOPIC_BASE}/U1/1/result`,
    'report response publishes to declared response topic',
  );
}

async function test_resource_result_replaces_model3200_catalog() {
  const actor = setupActor();
  assert.equal(await dispatchResource(actor, 'resource.report', resourceRows()), true, 'report baseline transport');
  assert.equal(Object.keys(catalog(actor)).length, 2, 'report establishes catalog baseline');
  assert.equal(
    await dispatchResource(actor, 'resource.result', resourceRows(['UI.app3'], ['task_ods'])),
    true,
    'resource.result transport',
  );
  assert.deepEqual(catalog(actor), {
    UI: ['UI.app3'],
    service: ['task_ods'],
  }, 'resource.result replaces catalog');
  assert.equal(lastResult(actor).action, 'result', 'last result action');
  assert.equal(responseHandlerResult(actor)?.action, 'result', 'response contains result action');
}

async function test_resource_report_accepts_same_cell_entries_at_non_root_coordinates() {
  const actor = setupActor();
  assert.equal(
    await dispatchResource(actor, 'resource.report', nonRootResourceRows()),
    true,
    'generic transport must deliver non-root resource cells',
  );
  assert.deepEqual(catalog(actor), {
    UI: ['UI.page'],
    service: ['search'],
  }, 'resource manager must accept same-cell entries at p=1 and r=1');
  assert.deepEqual(responseHandlerResult(actor)?.catalog, catalog(actor), 'non-root catalog must reach handler response');
}

async function test_resource_request_reads_catalog_and_suppresses_result() {
  const actor = setupActor();
  assert.equal(await dispatchResource(actor, 'resource.report', resourceRows()), true, 'report baseline transport');
  assert.equal(Object.keys(catalog(actor)).length, 2, 'report establishes request baseline');
  const resultBefore = structuredClone(rootValue(actor, 'result'));
  const remoteResultBefore = structuredClone(model0Root(actor).labels.get('remote_result_bus')?.v ?? null);
  const publishesBefore = publishCount(actor);
  assert.equal(
    await dispatchResource(actor, 'resource.request', [], { isNeedResponse: false }),
    true,
    'resource.request transport',
  );
  assert.equal(lastResult(actor).action, 'request', 'request last result');
  assert.deepEqual(lastResult(actor).catalog, {
    UI: ['UI.app1', 'UI.app2'],
    service: ['calculator'],
  }, 'request exposes current catalog');
  assert.deepEqual(rootValue(actor, 'result'), resultBefore, 'is_need_response=false must not replace result');
  assert.deepEqual(
    model0Root(actor).labels.get('remote_result_bus')?.v ?? null,
    remoteResultBefore,
    'is_need_response=false must not replace Model 0 result bus',
  );
  assert.equal(publishCount(actor), publishesBefore, 'is_need_response=false must not publish MQTT response');
}

const invalidResourceCases = [
  ['empty_records', []],
  ['empty_resource_list', [recordAt('type', 'str', 'UI', { c: 1 }), recordAt('resource', 'list', [], { c: 1 })]],
  ['blank_type', [recordAt('type', 'str', ' ', { c: 1 }), recordAt('resource', 'list', ['UI.app1'], { c: 1 })]],
  ['wrong_resource_type', [recordAt('type', 'str', 'UI', { c: 1 }), recordAt('resource', 'str', 'UI.app1', { c: 1 })]],
];

async function assertInvalidResourceActionRejects(sysMsgType, caseName, payloadRecords) {
  const actor = setupActor();
  const resultBefore = rootValue(actor, 'result') ?? null;
  assert.equal(
    await dispatchResource(actor, sysMsgType, payloadRecords),
    true,
    `${sysMsgType}/${caseName}: generic transport must deliver malformed business payload`,
  );
  assert.equal(lastResult(actor).status, 'rejected', `${sysMsgType}/${caseName}: actor-visible rejection status`);
  assert.equal(lastResult(actor).code, 'missing_resource_entries', `${sysMsgType}/${caseName}: exact rejection code`);
  assert.deepEqual(catalog(actor), {}, `${sysMsgType}/${caseName}: invalid action must not mutate catalog`);
  assert.deepEqual(rootValue(actor, 'result') ?? null, resultBefore, `${sysMsgType}/${caseName}: invalid action must not emit result`);
}

async function test_resource_report_rejects_mixed_valid_and_off_axis_invalid_entry() {
  const actor = setupActor();
  const mixedRecords = [
    recordAt('type', 'str', 'UI', { c: 1 }),
    recordAt('resource', 'list', ['UI.app1'], { c: 1 }),
    recordAt('type', 'str', 'service', { p: 1 }),
    recordAt('resource', 'str', 'calculator', { p: 1 }),
  ];
  const resultBefore = rootValue(actor, 'result') ?? null;
  const remoteResultBefore = model0Root(actor).labels.get('remote_result_bus')?.v ?? null;
  const publishesBefore = publishCount(actor);
  assert.equal(
    await dispatchResource(actor, 'resource.report', mixedRecords),
    true,
    'generic transport must deliver mixed resource payload',
  );
  assert.equal(lastResult(actor).status, 'rejected', 'mixed payload must reject inside Model 3200');
  assert.equal(lastResult(actor).code, 'missing_resource_entries', 'mixed payload exact rejection code');
  assert.deepEqual(catalog(actor), {}, 'mixed payload must not partially write catalog');
  assert.deepEqual(rootValue(actor, 'result') ?? null, resultBefore, 'mixed payload must not emit result');
  assert.deepEqual(model0Root(actor).labels.get('remote_result_bus')?.v ?? null, remoteResultBefore, 'mixed payload must not reach Model 0 result bus');
  assert.equal(publishCount(actor), publishesBefore, 'mixed payload must not publish MQTT response');
}

const tests = [
  ...[
    test_resource_report_updates_model3200_catalog,
    test_resource_result_replaces_model3200_catalog,
    test_resource_report_accepts_same_cell_entries_at_non_root_coordinates,
    test_resource_request_reads_catalog_and_suppresses_result,
    test_resource_report_rejects_mixed_valid_and_off_axis_invalid_entry,
  ].map((run) => ({ name: run.name, run })),
  ...['resource.report', 'resource.result'].flatMap((sysMsgType) => (
    invalidResourceCases.map(([caseName, payloadRecords]) => ({
      name: `test_${sysMsgType.replace('.', '_')}_${caseName}_rejects_inside_model3200`,
      run: () => assertInvalidResourceActionRejects(sysMsgType, caseName, payloadRecords),
    }))
  )),
];

let failed = 0;
for (const test of tests) {
  try {
    await test.run();
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
