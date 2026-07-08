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

function feishuTaskMessage(action, payloadRecords = []) {
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
    mt('endpoint_pin', 'str', `UIPUT/ws/dam/pic/de/R1/0.3000/${action}`, '0', 0, 1, 0),
    mt('response_pin', 'str', 'UIPUT/ws/dam/pic/de/U1/0.2000/result', '0', 0, 1, 0),
    mt('model_type', 'model.single', 'Data.Single', '0', 0, 1, 1),
    mt('message_server', 'str', 'local', '0', 0, 1, 1),
    mt('between', 'str', 'DEM_V1N', '0', 0, 1, 1),
    mt('model_type', 'model.subtableconnection', 1, '0', 0, 2, 0),
    mt('model_type', 'model.subtable', 'Data', '0.1'),
    mt('model_name', 'model.name', 'payload', '0.1'),
    mt('sys_msg_type', 'str', 'task_data', '0.1'),
    ...payloadRecords,
  ];
}

function dispatchTask(rt, action, payloadRecords) {
  return rt.addLabel(rt.getModel(0), 0, 0, 0, {
    k: 'in3',
    t: 'pin.bus.cb.in',
    v: feishuTaskMessage(action, payloadRecords),
  });
}

function taskSingle(records = []) {
  return [
    mt('model_type', 'model.single', 'Data.Single', '0.1', 0, 0, 1),
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
  return taskSingle(Object.entries(values).map(([key, [type, value]]) => mt(key, type, value, '0.1', 0, 0, 1)));
}

function idRecord(id) {
  return mt('id', 'int', id, '0.1', 0, 0, 1);
}

function tasks(rt) {
  return labelValue(rt, 'feishu_task_manager_tasks') || [];
}

function lastResult(rt) {
  return labelValue(rt, 'feishu_task_manager_last_result') || {};
}

function taskEvents(rt) {
  return rt.intercepts.list().filter((entry) => entry.type === 'feishu_task_manager_event');
}

async function test_add_task_creates_visible_task_state() {
  for (const [name, Runtime] of runtimeVariants) {
    const rt = new Runtime();
    const result = dispatchTask(rt, 'add_task', addTaskRecords());
    assert.equal(result.applied, true, `${name}: add_task must be accepted`);
    assert.deepEqual(tasks(rt).map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
    })), [{ id: 1, title: '任务标题', status: 'added_waiting_receive' }], `${name}: visible task state`);
    assert.equal(lastResult(rt).action, 'add_task', `${name}: last result action`);
    assert.equal(lastResult(rt).task_id, 1, `${name}: generated task id`);
    assert.equal(taskEvents(rt).at(-1)?.payload.status, 'added_waiting_receive', `${name}: task event status`);
  }
}

async function test_edit_receive_finish_archive_task_lifecycle() {
  for (const [name, Runtime] of runtimeVariants) {
    const rt = new Runtime();
    dispatchTask(rt, 'add_task', addTaskRecords());
    dispatchTask(rt, 'edit_task', taskSingle([
      idRecord(1),
      mt('body', 'str', '任务内容2', '0.1', 0, 0, 1),
      mt('publisher', 'str', '任务发布者2', '0.1', 0, 0, 1),
    ]));
    assert.equal(tasks(rt)[0].body, '任务内容2', `${name}: edit_task body`);
    assert.equal(tasks(rt)[0].publisher, '任务发布者2', `${name}: edit_task publisher`);
    assert.equal(tasks(rt)[0].status, 'added_waiting_receive', `${name}: edit_task preserves status`);

    dispatchTask(rt, 'receive_task', taskSingle([
      idRecord(1),
      mt('receive_time', 'str', '2026-07-08 16:10', '0.1', 0, 0, 1),
      mt('receiver', 'str', '任务接受者', '0.1', 0, 0, 1),
    ]));
    assert.equal(tasks(rt)[0].status, 'received_waiting_finish', `${name}: receive_task status`);
    assert.equal(tasks(rt)[0].receiver, '任务接受者', `${name}: receive_task receiver`);

    dispatchTask(rt, 'finish_task', taskSingle([
      idRecord(1),
      mt('end_time', 'str', '2026-07-08 16:20', '0.1', 0, 0, 1),
      mt('is_success', 'bool', true, '0.1', 0, 0, 1),
    ]));
    assert.equal(tasks(rt)[0].status, 'finished_waiting_archive', `${name}: finish_task status`);
    assert.equal(tasks(rt)[0].is_success, true, `${name}: finish_task success flag`);

    dispatchTask(rt, 'archive_task', taskSingle([
      idRecord(1),
      mt('archive_time', 'str', '2026-07-08 16:30', '0.1', 0, 0, 1),
      mt('review', 'str', '发布人评价', '0.1', 0, 0, 1),
    ]));
    assert.equal(tasks(rt)[0].status, 'archived', `${name}: archive_task status`);
    assert.equal(tasks(rt)[0].review, '发布人评价', `${name}: archive_task review`);
    assert.equal(lastResult(rt).action, 'archive_task', `${name}: last archive result`);
  }
}

async function test_delete_task_marks_task_deleted() {
  for (const [name, Runtime] of runtimeVariants) {
    const rt = new Runtime();
    dispatchTask(rt, 'add_task', addTaskRecords());
    const result = dispatchTask(rt, 'delete_task', taskSingle([idRecord(1)]));
    assert.equal(result.applied, true, `${name}: delete_task must be accepted`);
    assert.equal(tasks(rt)[0].status, 'deleted', `${name}: deleted task status`);
    assert.equal(lastResult(rt).action, 'delete_task', `${name}: last delete result`);
  }
}

async function test_unknown_task_id_rejects_with_reason() {
  for (const [name, Runtime] of runtimeVariants) {
    const rt = new Runtime();
    const result = dispatchTask(rt, 'receive_task', taskSingle([
      idRecord(99),
      mt('receive_time', 'str', '2026-07-08 16:10', '0.1', 0, 0, 1),
      mt('receiver', 'str', '任务接受者', '0.1', 0, 0, 1),
    ]));
    assert.equal(result.applied, false, `${name}: unknown task id must reject`);
    assert.equal(latestRejectedReason(rt), 'bus_in_task_not_found:99', `${name}: task_not_found reason`);
  }
}

const tests = [
  test_add_task_creates_visible_task_state,
  test_edit_receive_finish_archive_task_lifecycle,
  test_delete_task_marks_task_deleted,
  test_unknown_task_id_rejects_with_reason,
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
