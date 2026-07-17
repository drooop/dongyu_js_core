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

function taskSingle(records = []) {
  return [
    recordAt('model_type', 'model.single', 'Data.Single', { c: 1 }),
    ...records,
  ];
}

function addTaskRecords(overrides = {}) {
  const values = {
    title: ['str', '任务标题'],
    body: ['str', '任务内容'],
    publisher: ['str', '任务发布者'],
    publish_time: ['str', '2026-07-08 16:00'],
    ...overrides,
  };
  return taskSingle(Object.entries(values).map(([key, [type, value]]) => recordAt(key, type, value, { c: 1 })));
}

function addTaskReturnRecords(overrides = {}) {
  return taskSingle([
    idRecord(1),
    recordAt('title', 'str', '任务标题', { c: 1 }),
    recordAt('body', 'str', '任务内容', { c: 1 }),
    recordAt('publisher', 'str', '任务发布者', { c: 1 }),
    recordAt('publish_time', 'str', '2026-07-08 16:00', { c: 1 }),
  ].map((record) => Object.prototype.hasOwnProperty.call(overrides, record.k)
    ? { ...record, ...overrides[record.k] }
    : record));
}

function idRecord(id) {
  return recordAt('id', 'int', id, { c: 1 });
}

function taskRequest(action, payloadRecords, { isNeedResponse = true } = {}) {
  requestSequence += 1;
  return pinPayloadV2Records({
    opId: `0457_task_${action}_${requestSequence}`,
    endpointWorkerId: 'R1',
    endpointTableId: 'host',
    endpointModelId: model3200Id,
    endpointPin: action,
    topic: `${DEFAULT_TOPIC_BASE}/R1/${model3200Id}/${action}`,
    responseTopic: `${DEFAULT_TOPIC_BASE}/U1/1/result`,
    routeKind: 'control',
    originWorkerId: 'U1',
    originTableId: 'app:0457:task-contract',
    originModelId: 1,
    originPin: 'send',
    replyTargetWorkerId: 'U1',
    replyTargetTableId: 'app:0457:task-contract',
    replyTargetModelId: 1,
    replyTargetPin: 'result',
    payloadModelId: 1,
    payloadRecords: [
      recordAt('model_type', 'model.table', 'Data'),
      recordAt('sys_msg_type', 'str', 'task_data'),
      ...payloadRecords,
    ],
    extraRecords: [
      mt('is_need_response', 'bool', isNeedResponse),
      mt('message_server', 'str', 'local'),
      mt('between', 'str', 'DEM_V1N'),
    ],
    timestamp: 1700000004400 + requestSequence,
  });
}

function setupActor() {
  const actor = loadSsotDeActor('r1');
  assert.equal(actor.loadRejected, 0, 'R1 patches must load without rejection');
  actor.runtime.setRuntimeMode('edit');
  actor.runtime.setRuntimeMode('running');
  return actor;
}

async function settlePropagation() {
  for (let index = 0; index < 12; index += 1) {
    await new Promise((resolvePromise) => setImmediate(resolvePromise));
  }
}

async function dispatchTask(actor, action, payloadRecords, options = {}) {
  const records = taskRequest(action, payloadRecords, options);
  const handled = actor.runtime.mqttIncoming(
    `${DEFAULT_TOPIC_BASE}/R1/${model3200Id}/${action}`,
    externalPacket(records),
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

function tasks(actor) {
  return rootValue(actor, 'feishu_task_manager_tasks') || [];
}

function lastResult(actor) {
  return rootValue(actor, 'feishu_task_manager_last_result') || {};
}

function responseHandlerResult(actor) {
  const result = model3200Root(actor).labels.get('result');
  return result && Array.isArray(result.v) ? payloadValue(result.v, 'handler_result', 1) : null;
}

async function test_add_task_creates_model3200_visible_task_state() {
  const actor = setupActor();
  assert.equal(await dispatchTask(actor, 'add_task', addTaskRecords()), true, 'generic transport must deliver add_task');
  assert.deepEqual(tasks(actor).map((task) => ({
    id: task.id,
    title: task.title,
    status: task.status,
  })), [{ id: 1, title: '任务标题', status: 'added_waiting_receive' }], 'Model 3200 visible task state');
  assert.equal(lastResult(actor).action, 'add_task', 'last result action');
  assert.equal(lastResult(actor).task_id, 1, 'generated task id');
  assert.equal(lastResult(actor).status, 'added_waiting_receive', 'task business status');
  assert.equal(tasks(actor)[0].body, '任务内容', 'add_task body');
  assert.equal(tasks(actor)[0].publisher, '任务发布者', 'add_task publisher');
  assert.equal(tasks(actor)[0].publish_time, '2026-07-08 16:00', 'add_task publish time');
  assert.equal(responseHandlerResult(actor)?.action, 'add_task', 'generic response contains business action');
  assert.equal(responseHandlerResult(actor)?.task_id, 1, 'generic response contains generated task id');
  assert.equal(model3200Root(actor).labels.get('add_task_return')?.t, 'pin.in', 'F-08 slot remains an input PIN');
  assert.equal(model3200Root(actor).labels.get('add_task_return')?.v, null, 'add_task must not trigger add_task_return');
  assert.deepEqual(
    [...model3200Root(actor).labels.values()].filter((label) => label.t === 'pin.out').map((label) => label.k).sort(),
    ['result'],
    'result remains the only public response PIN',
  );
}

async function test_edit_receive_finish_archive_task_lifecycle() {
  const actor = setupActor();
  assert.equal(await dispatchTask(actor, 'add_task', addTaskRecords()), true, 'add_task transport');
  assert.equal(tasks(actor).length, 1, 'add_task must establish lifecycle baseline');
  assert.equal(await dispatchTask(actor, 'edit_task', taskSingle([
    idRecord(1),
    recordAt('body', 'str', '任务内容2', { c: 1 }),
    recordAt('publisher', 'str', '任务发布者2', { c: 1 }),
  ])), true, 'edit_task transport');
  assert.equal(tasks(actor).length, 1, 'edit_task must preserve the task');
  assert.equal(tasks(actor)[0].body, '任务内容2', 'edit_task body');
  assert.equal(tasks(actor)[0].publisher, '任务发布者2', 'edit_task publisher');
  assert.equal(tasks(actor)[0].status, 'added_waiting_receive', 'edit_task preserves status');

  assert.equal(await dispatchTask(actor, 'receive_task', taskSingle([
    idRecord(1),
    recordAt('receive_time', 'str', '2026-07-08 16:10', { c: 1 }),
    recordAt('receiver', 'str', '任务接受者', { c: 1 }),
  ])), true, 'receive_task transport');
  assert.equal(tasks(actor).length, 1, 'receive_task must preserve the task');
  assert.equal(tasks(actor)[0].status, 'received_waiting_finish', 'receive_task status');
  assert.equal(tasks(actor)[0].receiver, '任务接受者', 'receive_task receiver');
  assert.equal(tasks(actor)[0].receive_time, '2026-07-08 16:10', 'receive_task time');

  assert.equal(await dispatchTask(actor, 'finish_task', taskSingle([
    idRecord(1),
    recordAt('end_time', 'str', '2026-07-08 16:20', { c: 1 }),
    recordAt('is_success', 'bool', true, { c: 1 }),
  ])), true, 'finish_task transport');
  assert.equal(tasks(actor).length, 1, 'finish_task must preserve the task');
  assert.equal(tasks(actor)[0].status, 'finished_waiting_archive', 'finish_task status');
  assert.equal(tasks(actor)[0].is_success, true, 'finish_task success flag');
  assert.equal(tasks(actor)[0].end_time, '2026-07-08 16:20', 'finish_task end time');

  assert.equal(await dispatchTask(actor, 'archive_task', taskSingle([
    idRecord(1),
    recordAt('archive_time', 'str', '2026-07-08 16:30', { c: 1 }),
    recordAt('review', 'str', '发布人评价', { c: 1 }),
  ])), true, 'archive_task transport');
  assert.equal(tasks(actor).length, 1, 'archive_task must preserve the task');
  assert.equal(tasks(actor)[0].status, 'archived', 'archive_task status');
  assert.equal(tasks(actor)[0].review, '发布人评价', 'archive_task review');
  assert.equal(tasks(actor)[0].archive_time, '2026-07-08 16:30', 'archive_task time');
  assert.equal(lastResult(actor).action, 'archive_task', 'last archive result');
  assert.equal(responseHandlerResult(actor)?.action, 'archive_task', 'archive result comes from task handler');
}

async function test_delete_task_marks_task_deleted() {
  const actor = setupActor();
  assert.equal(await dispatchTask(actor, 'add_task', addTaskRecords()), true, 'add_task transport');
  assert.equal(tasks(actor).length, 1, 'add_task must establish delete baseline');
  assert.equal(await dispatchTask(actor, 'delete_task', taskSingle([idRecord(1)])), true, 'generic transport must deliver delete_task');
  assert.equal(tasks(actor).length, 1, 'delete_task must preserve the task record');
  assert.equal(tasks(actor)[0].status, 'deleted', 'deleted task status');
  assert.equal(lastResult(actor).action, 'delete_task', 'last delete result');
}

async function test_unknown_task_id_rejects_inside_model3200_without_result() {
  const actor = setupActor();
  const resultBefore = rootValue(actor, 'result') ?? null;
  assert.equal(await dispatchTask(actor, 'receive_task', taskSingle([
    idRecord(99),
    recordAt('receive_time', 'str', '2026-07-08 16:10', { c: 1 }),
    recordAt('receiver', 'str', '任务接受者', { c: 1 }),
  ])), true, 'generic transport must deliver unknown-id request to actor');
  assert.equal(lastResult(actor).status, 'rejected', 'actor-visible rejection status');
  assert.equal(lastResult(actor).code, 'task_not_found:99', 'actor-visible task_not_found code');
  assert.deepEqual(rootValue(actor, 'result') ?? null, resultBefore, 'rejected task request must not emit result');
}

function validTaskRecords(action) {
  if (action === 'add_task') return addTaskRecords();
  if (action === 'edit_task' || action === 'delete_task') return taskSingle([idRecord(1)]);
  if (action === 'receive_task') {
    return taskSingle([
      idRecord(1),
      recordAt('receive_time', 'str', '2026-07-08 16:10', { c: 1 }),
      recordAt('receiver', 'str', '任务接受者', { c: 1 }),
    ]);
  }
  if (action === 'finish_task') {
    return taskSingle([
      idRecord(1),
      recordAt('end_time', 'str', '2026-07-08 16:20', { c: 1 }),
      recordAt('is_success', 'bool', true, { c: 1 }),
    ]);
  }
  if (action === 'archive_task') {
    return taskSingle([
      idRecord(1),
      recordAt('archive_time', 'str', '2026-07-08 16:30', { c: 1 }),
      recordAt('review', 'str', '发布人评价', { c: 1 }),
    ]);
  }
  throw new Error(`unsupported_task_action:${action}`);
}

function wrongTypeRecord(record) {
  if (record.t === 'str') return { ...record, t: 'int', v: 7 };
  if (record.t === 'int') return { ...record, t: 'str', v: String(record.v) };
  if (record.t === 'bool') return { ...record, t: 'str', v: String(record.v) };
  throw new Error(`unsupported_required_field_type:${record.t}`);
}

const requiredTaskFields = [
  ['add_task', 'title'],
  ['add_task', 'body'],
  ['add_task', 'publisher'],
  ['add_task', 'publish_time'],
  ['edit_task', 'id'],
  ['delete_task', 'id'],
  ['receive_task', 'id'],
  ['receive_task', 'receive_time'],
  ['receive_task', 'receiver'],
  ['finish_task', 'id'],
  ['finish_task', 'end_time'],
  ['finish_task', 'is_success'],
  ['archive_task', 'id'],
  ['archive_task', 'archive_time'],
  ['archive_task', 'review'],
];

const pendingAddTaskReturnCases = [
  ['empty_payload', []],
  ['complete_legacy_fields', addTaskReturnRecords()],
  ['wrong_type_fields', addTaskReturnRecords({ id: { t: 'str', v: '1' }, title: { t: 'int', v: 7 } })],
];

function seedTaskState(actor) {
  const seeded = actor.runtime.addLabel(actor.runtime.getModel(model3200Id), 0, 0, 0, {
    k: 'feishu_task_manager_tasks',
    t: 'json',
    v: [{
      id: 1,
      title: '任务标题',
      body: '任务内容',
      publisher: '任务发布者',
      publish_time: '2026-07-08 16:00',
      status: 'added_waiting_receive',
    }],
  });
  assert.equal(seeded.applied, true, 'test precondition must seed Model 3200 task state');
}

async function assertRequiredTaskFieldRejects(action, field, mutation) {
  const actor = setupActor();
  if (action !== 'add_task') {
    seedTaskState(actor);
    assert.equal(tasks(actor).length, 1, `${action}/${field}: baseline task`);
  }
  const stateBefore = structuredClone(tasks(actor));
  const resultBefore = structuredClone(rootValue(actor, 'result') ?? null);
  const valid = validTaskRecords(action);
  const candidate = mutation === 'missing'
    ? valid.filter((record) => record.k !== field)
    : valid.map((record) => record.k === field ? wrongTypeRecord(record) : record);
  assert.equal(
    await dispatchTask(actor, action, candidate),
    true,
    `${action}/${field}/${mutation}: generic transport must deliver malformed business request`,
  );
  assert.equal(lastResult(actor).status, 'rejected', `${action}/${field}/${mutation}: rejection status`);
  assert.equal(lastResult(actor).code, `missing_task_field:${field}`, `${action}/${field}/${mutation}: exact rejection code`);
  assert.deepEqual(tasks(actor), stateBefore, `${action}/${field}/${mutation}: task state must not mutate`);
  assert.deepEqual(rootValue(actor, 'result') ?? null, resultBefore, `${action}/${field}/${mutation}: result must not change`);
}

async function assertAddTaskReturnRemainsPending(caseName, payloadRecords) {
  const actor = setupActor();
  const stateBefore = structuredClone(tasks(actor));
  const resultBefore = structuredClone(rootValue(actor, 'result') ?? null);
  assert.equal(
    await dispatchTask(actor, 'add_task_return', payloadRecords),
    true,
    `${caseName}: generic transport must deliver the declared input PIN`,
  );
  assert.equal(lastResult(actor).status, 'rejected', `${caseName}: pending F-08 must fail closed`);
  assert.equal(lastResult(actor).code, 'task_action_pending:add_task_return', `${caseName}: exact pending code`);
  assert.deepEqual(tasks(actor), stateBefore, `${caseName}: pending F-08 must not mutate task state`);
  assert.deepEqual(rootValue(actor, 'result') ?? null, resultBefore, `${caseName}: pending F-08 must not emit generic success`);
}

const tests = [
  ...[
    test_add_task_creates_model3200_visible_task_state,
    test_edit_receive_finish_archive_task_lifecycle,
    test_delete_task_marks_task_deleted,
    test_unknown_task_id_rejects_inside_model3200_without_result,
  ].map((run) => ({ name: run.name, run })),
  ...requiredTaskFields.flatMap(([action, field]) => ['missing', 'wrong_type'].map((mutation) => ({
    name: `test_${action}_${field}_${mutation}_rejects_inside_model3200`,
    run: () => assertRequiredTaskFieldRejects(action, field, mutation),
  }))),
  ...pendingAddTaskReturnCases.map(([caseName, payloadRecords]) => ({
    name: `test_add_task_return_${caseName}_remains_pending`,
    run: () => assertAddTaskReturnRemainsPending(caseName, payloadRecords),
  })),
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
