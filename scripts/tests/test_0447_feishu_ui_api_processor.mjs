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

function recordAt(k, t, v, { id = 1, p = 0, r = 0, c = 0 } = {}) {
  return { id, p, r, c, k, t, v };
}

function updateRecords(id = 1, text = 'aa') {
  return [
    recordAt('text', 'str', text, { id, p: 1 }),
    recordAt('button', 'str', 'bb', { id, r: 1 }),
  ];
}

function formRecords(id = 1, suffix = '') {
  return [
    recordAt('data1', 'str', `aa${suffix}`, { id, c: 1 }),
    recordAt('data2', 'int', suffix ? 5678 : 1234, { id, p: 1 }),
  ];
}

function refreshRecords(id = 1) {
  return [
    recordAt('data1', 'str', 'refresh-aa', { id, r: 1 }),
    recordAt('data2', 'int', 5678, { id, r: 1 }),
  ];
}

function uiRequest(sysMsgType, payloadType, payloadRecords = [], { isNeedResponse = true, payloadModelId = 1 } = {}) {
  requestSequence += 1;
  return pinPayloadV2Records({
    opId: `0457_ui_${sysMsgType.replaceAll('.', '_')}_${requestSequence}`,
    endpointWorkerId: 'R1',
    endpointTableId: 'host',
    endpointModelId: model3200Id,
    endpointPin: 'ui',
    topic: `${DEFAULT_TOPIC_BASE}/R1/${model3200Id}/ui`,
    responseTopic: `${DEFAULT_TOPIC_BASE}/U1/1/result`,
    routeKind: 'control',
    originWorkerId: 'U1',
    originTableId: 'app:0457:ui-contract',
    originModelId: 1,
    originPin: 'send',
    replyTargetWorkerId: 'U1',
    replyTargetTableId: 'app:0457:ui-contract',
    replyTargetModelId: 1,
    replyTargetPin: 'result',
    payloadModelId,
    payloadRecords: [
      recordAt('model_type', 'model.table', payloadType, { id: payloadModelId }),
      recordAt('sys_msg_type', 'str', sysMsgType, { id: payloadModelId }),
      ...payloadRecords,
    ],
    extraRecords: [
      mt('is_need_response', 'bool', isNeedResponse),
      mt('message_server', 'str', 'local'),
      mt('between', 'str', 'DEM_V1N'),
    ],
    timestamp: 1700000004700 + requestSequence,
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
    client_id: '0457-ui-r1',
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

async function dispatchUi(actor, sysMsgType, payloadType, payloadRecords = [], options = {}) {
  const records = uiRequest(sysMsgType, payloadType, payloadRecords, options);
  const opId = payloadValue(records, 'op_id');
  const handled = actor.runtime.mqttIncoming(
    `${DEFAULT_TOPIC_BASE}/R1/${model3200Id}/ui`,
    externalPacket(records),
  );
  await settlePropagation();
  return { handled, opId };
}

function model3200Root(actor) {
  return actor.runtime.getModel(model3200Id).getCell(0, 0, 0);
}

function model0Root(actor) {
  return actor.runtime.getModel(0).getCell(0, 0, 0);
}

function rootValue(actor, key) {
  return model3200Root(actor).labels.get(key)?.v;
}

function state(actor) {
  return rootValue(actor, 'feishu_ui_manager_state') || {};
}

function lastResult(actor) {
  return rootValue(actor, 'feishu_ui_manager_last_result') || {};
}

function responseHandlerResult(actor) {
  const result = model3200Root(actor).labels.get('result');
  return result && Array.isArray(result.v) ? payloadValue(result.v, 'handler_result', 1) : null;
}

function publishCount(actor) {
  return actor.runtime.mqttTrace.list().filter((entry) => entry.type === 'publish').length;
}

function assertUiRequestTraversedR1Chain(actor, expectedOpId) {
  const model0Ingress = model0Root(actor).labels.get('r1_cb_in');
  const dispatcherOutput = actor.runtime.getModel(-10)?.getCell(0, 0, 0).labels.get('r1_dispatch_3200_ui');
  const model3200Input = model3200Root(actor).labels.get('ui');
  assert.equal(model0Ingress?.t, 'pin.bus.cb.in', 'request must enter Model 0 control bus');
  assert.equal(dispatcherOutput?.t, 'pin.out', 'request must leave Model -10 UI dispatcher');
  assert.equal(model3200Input?.t, 'pin.in', 'request must enter Model 3200 UI pin');
  const opIds = [model0Ingress, dispatcherOutput, model3200Input].map((label) => payloadValue(label.v, 'op_id'));
  assert.match(expectedOpId, /^0457_ui_/, 'test request must expose a UI op_id');
  assert.deepEqual(opIds, [expectedOpId, expectedOpId, expectedOpId], 'same UI request must traverse Model 0, Model -10, and Model 3200');
}

async function test_update_data_records_current_state_and_history() {
  const actor = setupActor();
  const payloadModelId = 11;
  const first = await dispatchUi(actor, 'ui.update_data', 'Data', updateRecords(payloadModelId), { payloadModelId });
  assert.equal(first.handled, true, 'generic transport must deliver first ui.update_data');
  assertUiRequestTraversedR1Chain(actor, first.opId);
  assert.equal(state(actor).update?.current?.record_count, 2, 'Model 3200 update current record count');
  assert.equal(state(actor).update?.current?.payload_model_id, payloadModelId, 'update state uses declared payload_model_id');
  assert.equal(Object.prototype.hasOwnProperty.call(state(actor).update.current, 'payload_table_id'), false, 'update state must not retain v1 payload_table_id');
  assert.equal(state(actor).update?.history?.length, 1, 'Model 3200 update history first entry');
  const second = await dispatchUi(actor, 'ui.update_data', 'Data', [recordAt('text', 'str', 'cc', { id: payloadModelId, p: 2 })], { payloadModelId });
  assert.equal(second.handled, true, 'generic transport must deliver second ui.update_data');
  assertUiRequestTraversedR1Chain(actor, second.opId);
  assert.equal(state(actor).update?.current?.record_count, 1, 'current state must be replaced by latest update');
  assert.equal(state(actor).update?.current?.records?.[0]?.v, 'cc', 'current state contains latest update value');
  assert.equal(state(actor).update?.history?.length, 2, 'update history must append');
  assert.equal(lastResult(actor).action, 'update_data', 'update last result action');
  assert.equal(lastResult(actor).payload_model_id, payloadModelId, 'UI last result uses v2 payload_model_id');
  assert.equal(Object.prototype.hasOwnProperty.call(lastResult(actor), 'payload_table_id'), false, 'UI last result must not retain v1 payload_table_id');
  const handlerResult = responseHandlerResult(actor);
  assert.equal(handlerResult?.action, 'update_data', 'response comes from UI handler');
  assert.equal(handlerResult?.payload_model_id, payloadModelId, 'UI response uses v2 payload_model_id');
  assert.equal(Object.prototype.hasOwnProperty.call(handlerResult || {}, 'payload_table_id'), false, 'UI response must not retain v1 payload_table_id');
  assert.equal(publishCount(actor), 2, 'two response-enabled updates publish twice');
}

async function test_tmp_data_records_temporary_state_without_history() {
  const actor = setupActor();
  const seed = await dispatchUi(actor, 'ui.update_data', 'Data', updateRecords(), { isNeedResponse: false });
  assert.equal(seed.handled, true, 'seed update state');
  assert.equal(state(actor).update?.history?.length, 1, 'seed update creates one history entry');
  const payloadModelId = 12;
  const tmp = await dispatchUi(
    actor,
    'ui.tmp_data',
    'Data',
    [recordAt('text', 'str', 'draft', { id: payloadModelId, p: 2 })],
    { payloadModelId },
  );
  assert.equal(tmp.handled, true, 'generic transport must deliver ui.tmp_data');
  assertUiRequestTraversedR1Chain(actor, tmp.opId);
  assert.equal(state(actor).tmp?.current?.record_count, 1, 'temporary current record count');
  assert.equal(state(actor).tmp?.current?.records?.[0]?.v, 'draft', 'temporary state value');
  assert.equal(state(actor).tmp?.current?.payload_model_id, payloadModelId, 'temporary state uses declared payload_model_id');
  assert.equal(Object.prototype.hasOwnProperty.call(state(actor).tmp.current, 'payload_table_id'), false, 'temporary state must not retain v1 payload_table_id');
  assert.equal(state(actor).update?.history?.length, 1, 'temporary data must not append update history');
  assert.equal(lastResult(actor).temporary, true, 'temporary result flag');
  assert.equal(lastResult(actor).payload_model_id, payloadModelId, 'temporary result uses v2 payload_model_id');
  assert.equal(Object.prototype.hasOwnProperty.call(lastResult(actor), 'payload_table_id'), false, 'temporary result must not retain v1 payload_table_id');
  const handlerResult = responseHandlerResult(actor);
  assert.equal(handlerResult?.payload_model_id, payloadModelId, 'temporary response uses v2 payload_model_id');
  assert.equal(Object.prototype.hasOwnProperty.call(handlerResult || {}, 'payload_table_id'), false, 'temporary response must not retain v1 payload_table_id');
}

async function test_form_data_appends_submissions() {
  const actor = setupActor();
  const payloadModelId = 14;
  const first = await dispatchUi(actor, 'ui.form_data', 'Data', formRecords(payloadModelId), { payloadModelId });
  assert.equal(first.handled, true, 'first form submission transport');
  assertUiRequestTraversedR1Chain(actor, first.opId);
  const second = await dispatchUi(actor, 'ui.form_data', 'Data', formRecords(payloadModelId, '-2'), { payloadModelId });
  assert.equal(second.handled, true, 'second form submission transport');
  assertUiRequestTraversedR1Chain(actor, second.opId);
  assert.equal(state(actor).form?.submissions?.length, 2, 'form submissions must append');
  assert.equal(state(actor).form?.submissions?.[0]?.records?.[0]?.k, 'data1', 'first form submission record');
  assert.equal(state(actor).form?.submissions?.[1]?.records?.[0]?.v, 'aa-2', 'second form submission value');
  assert.equal(state(actor).form?.submissions?.[1]?.payload_model_id, payloadModelId, 'form state uses declared payload_model_id');
  assert.equal(Object.prototype.hasOwnProperty.call(state(actor).form.submissions[1], 'payload_table_id'), false, 'form state must not retain v1 payload_table_id');
  assert.equal(lastResult(actor).payload_model_id, payloadModelId, 'form result uses v2 payload_model_id');
  assert.equal(Object.prototype.hasOwnProperty.call(lastResult(actor), 'payload_table_id'), false, 'form result must not retain v1 payload_table_id');
  const handlerResult = responseHandlerResult(actor);
  assert.equal(handlerResult?.payload_model_id, payloadModelId, 'form response uses v2 payload_model_id');
  assert.equal(Object.prototype.hasOwnProperty.call(handlerResult || {}, 'payload_table_id'), false, 'form response must not retain v1 payload_table_id');
}

async function test_refresh_data_remains_pending_without_state_or_response() {
  const actor = setupActor();
  const seed = await dispatchUi(actor, 'ui.update_data', 'Data', updateRecords());
  assert.equal(seed.handled, true, 'seed implemented UI state');
  const stateBefore = structuredClone(state(actor));
  const resultBefore = structuredClone(rootValue(actor, 'result'));
  const remoteResultBefore = structuredClone(model0Root(actor).labels.get('remote_result_bus')?.v ?? null);
  const publishesBefore = publishCount(actor);
  const payloadModelId = 17;
  const refresh = await dispatchUi(actor, 'ui.refresh_data', 'Data', refreshRecords(payloadModelId), { payloadModelId });
  assert.equal(refresh.handled, true, 'refresh request reaches Model 3200');
  assertUiRequestTraversedR1Chain(actor, refresh.opId);
  assert.equal(lastResult(actor).status, 'rejected', 'refresh remains actor-visible pending work');
  assert.equal(lastResult(actor).code, 'ui_action_pending:refresh_data', 'refresh exact pending code');
  assert.deepEqual(state(actor), stateBefore, 'pending refresh must not write UI manager state');
  assert.equal(Object.prototype.hasOwnProperty.call(state(actor), 'refresh'), false, 'pending refresh must not create refresh state');
  assert.deepEqual(rootValue(actor, 'result'), resultBefore, 'pending refresh must not emit result');
  assert.deepEqual(model0Root(actor).labels.get('remote_result_bus')?.v ?? null, remoteResultBefore, 'pending refresh must not reach Model 0 result bus');
  assert.equal(publishCount(actor), publishesBefore, 'pending refresh must not publish MQTT response');
}

async function assertInvalidUiRejects({ sysMsgType, payloadType, payloadRecords, payloadModelId = 1, code, name }) {
  const actor = setupActor();
  const stateBefore = structuredClone(state(actor));
  const resultBefore = rootValue(actor, 'result') ?? null;
  const remoteResultBefore = model0Root(actor).labels.get('remote_result_bus')?.v ?? null;
  const publishesBefore = publishCount(actor);
  const dispatched = await dispatchUi(actor, sysMsgType, payloadType, payloadRecords, { payloadModelId });
  assert.equal(dispatched.handled, true, `${name}: generic transport must deliver malformed business payload`);
  assertUiRequestTraversedR1Chain(actor, dispatched.opId);
  assert.equal(lastResult(actor).status, 'rejected', `${name}: actor-visible rejection status`);
  assert.equal(lastResult(actor).code, code, `${name}: exact rejection code`);
  assert.deepEqual(state(actor), stateBefore, `${name}: invalid UI request must not mutate state`);
  assert.deepEqual(rootValue(actor, 'result') ?? null, resultBefore, `${name}: invalid UI request must not emit result`);
  assert.deepEqual(model0Root(actor).labels.get('remote_result_bus')?.v ?? null, remoteResultBefore, `${name}: invalid UI request must not reach Model 0 result bus`);
  assert.equal(publishCount(actor), publishesBefore, `${name}: invalid UI request must not publish MQTT response`);
}

const implementedActions = ['ui.update_data', 'ui.tmp_data', 'ui.form_data'];
const tests = [
  { name: test_update_data_records_current_state_and_history.name, run: test_update_data_records_current_state_and_history },
  { name: test_tmp_data_records_temporary_state_without_history.name, run: test_tmp_data_records_temporary_state_without_history },
  { name: test_form_data_appends_submissions.name, run: test_form_data_appends_submissions },
  { name: test_refresh_data_remains_pending_without_state_or_response.name, run: test_refresh_data_remains_pending_without_state_or_response },
  ...implementedActions.flatMap((sysMsgType) => {
    const payloadModelId = sysMsgType === 'ui.update_data' ? 13 : (sysMsgType === 'ui.tmp_data' ? 15 : 16);
    const validRecords = sysMsgType === 'ui.form_data' ? formRecords(payloadModelId) : updateRecords(payloadModelId);
    return [
      {
        name: `test_${sysMsgType.replaceAll('.', '_')}_rejects_empty_payload_inside_model3200`,
        run: () => assertInvalidUiRejects({
          sysMsgType,
          payloadType: 'Data',
          payloadRecords: [],
          payloadModelId,
          code: 'missing_ui_payload_records',
          name: `${sysMsgType}/empty_payload`,
        }),
      },
      {
        name: `test_${sysMsgType.replaceAll('.', '_')}_rejects_flow_root_inside_model3200`,
        run: () => assertInvalidUiRejects({
          sysMsgType,
          payloadType: 'Flow',
          payloadRecords: validRecords,
          payloadModelId,
          code: 'invalid_ui_payload_type',
          name: `${sysMsgType}/flow_root`,
        }),
      },
    ];
  }),
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
