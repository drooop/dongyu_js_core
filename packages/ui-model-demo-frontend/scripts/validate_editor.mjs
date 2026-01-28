import { createRenderer } from '../../ui-renderer/src/index.js';
import { createDemoStore } from '../src/demo_modeltable.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function findFirstNode(ast, type) {
  if (!ast) return null;
  if (ast.type === type) return ast;
  const children = ast.children || [];
  for (const child of children) {
    const found = findFirstNode(child, type);
    if (found) return found;
  }
  return null;
}

function findNodeById(ast, id) {
  if (!ast) return null;
  if (ast.id === id) return ast;
  const children = ast.children || [];
  for (const child of children) {
    const found = findNodeById(child, id);
    if (found) return found;
  }
  return null;
}

function createHost(store, calls) {
  return {
    getSnapshot: () => store.snapshot,
    dispatchAddLabel: (label) => {
      calls.push({ type: 'add', label });
      store.dispatchAddLabel(label);
    },
    dispatchRmLabel: (labelRef) => {
      calls.push({ type: 'rm', labelRef });
      store.dispatchRmLabel(labelRef);
    },
  };
}

function mailboxEnvelope({ event_id, action, op_id, target, value }) {
  const payload = { action, meta: { op_id } };
  if (target !== undefined) payload.target = target;
  if (value !== undefined) payload.value = value;
  return {
    event_id,
    type: action,
    payload,
    source: 'ui_renderer',
    ts: 0,
  };
}

function sendMailbox(store, envelope) {
  store.dispatchAddLabel({ p: 0, r: 0, c: 1, k: 'ui_event', t: 'event', v: envelope });
}

function getMailboxCell(store) {
  const mailboxModel = store.runtime.getModel(99);
  return store.runtime.getCell(mailboxModel, 0, 0, 1);
}

function getErrorCode(store) {
  const cell = getMailboxCell(store);
  const err = cell.labels.get('ui_event_error');
  return err && err.v ? err.v.code : null;
}

function getErrorOpId(store) {
  const cell = getMailboxCell(store);
  const err = cell.labels.get('ui_event_error');
  return err && err.v ? err.v.op_id : null;
}

function getLastOpId(store) {
  const cell = getMailboxCell(store);
  const last = cell.labels.get('ui_event_last_op_id');
  return last ? String(last.v || '') : '';
}

function run() {
  const store = createDemoStore();
  const calls = [];
  const host = createHost(store, calls);
  const renderer = createRenderer({ host });

  const ast = store.getUiAst();
  assert(ast && ast.type === 'Root', 'editor_ast: missing Root');

  const btnCreateModel = findNodeById(ast, 'btn_create_model1');
  const btnAdd = findNodeById(ast, 'btn_add_title');
  const inputUpdate = findNodeById(ast, 'input_update_title');
  const btnRemove = findNodeById(ast, 'btn_remove_title');
  const btnClear = findNodeById(ast, 'btn_clear_cell');
  assert(btnCreateModel && btnAdd && inputUpdate && btnRemove && btnClear, 'editor_ast: missing nodes');

  // 1) create model 1
  const labelCreate = renderer.dispatchEvent(btnCreateModel, {});
  assert(labelCreate && labelCreate.t === 'event', 'editor_event_only: label.t must be event');

  // no state bypass: model 1 not created before consume
  assert(!store.runtime.getModel(1), 'editor_no_state_bypass: model created before consume');
  store.consumeOnce();
  assert(store.runtime.getModel(1), 'editor_submodel_create: model 1 not created');

  // 2) add label
  renderer.dispatchEvent(btnAdd, {});
  assert(!store.runtime.getCell(store.runtime.getModel(1), 0, 0, 0).labels.get('title'), 'editor_no_state_bypass: label changed before consume');
  store.consumeOnce();
  const m1 = store.runtime.getModel(1);
  const cell = store.runtime.getCell(m1, 0, 0, 0);
  assert(cell.labels.get('title') && cell.labels.get('title').v === 'Hello', 'editor_cell_crud: add failed');

  // 3) update via input (payload.value from input)
  renderer.dispatchEvent(inputUpdate, { value: 'World' });
  store.consumeOnce();
  assert(cell.labels.get('title') && cell.labels.get('title').v === 'World', 'editor_cell_crud: update failed');

  // 4) remove
  renderer.dispatchEvent(btnRemove, {});
  store.consumeOnce();
  assert(!cell.labels.get('title'), 'editor_cell_crud: remove failed');

  // 5) clear cell does not throw
  renderer.dispatchEvent(btnClear, {});
  store.consumeOnce();

  // 6) envelope shape
  const lastAdd = calls.filter((c) => c.type === 'add').slice(-1)[0];
  assert(lastAdd && lastAdd.label && lastAdd.label.k === 'ui_event', 'editor_event_mailbox_only: must write ui_event');
  assert(lastAdd.label.v && lastAdd.label.v.source === 'ui_renderer', 'editor_event_payload_shape: source mismatch');
  assert(lastAdd.label.v.payload && lastAdd.label.v.payload.meta && typeof lastAdd.label.v.payload.meta.op_id === 'string', 'editor_event_payload_shape: op_id missing');

  // 7) consumed_once: mailbox cleared
  const mailboxCell = getMailboxCell(store);
  const uiEvent = mailboxCell.labels.get('ui_event');
  assert(uiEvent && uiEvent.v === null, 'editor_event_consumed_once: ui_event not cleared');

  // renderer should skip writing when mailbox is full
  const callsBeforeSkip = calls.length;
  sendMailbox(store, mailboxEnvelope({ event_id: 240, action: 'label_remove', op_id: 'op_240', target: { model_id: 1, p: 0, r: 0, c: 0, k: 'title' } }));
  const skipped = renderer.dispatchEvent(btnRemove, {});
  assert(skipped && skipped.skipped === true, 'editor_renderer_skip_mailbox_full');
  assert(calls.length === callsBeforeSkip, 'editor_renderer_skip_mailbox_full: must not dispatch');
  store.consumeOnce();

  // invalid_target: falsy mailbox envelope must be consumed + cleared
  store.dispatchAddLabel({ p: 0, r: 0, c: 1, k: 'ui_event', t: 'event', v: '' });
  store.consumeOnce();
  assert(getErrorCode(store) === 'invalid_target', 'editor_invalid_target_falsy_envelope');
  assert(getMailboxCell(store).labels.get('ui_event').v === null, 'editor_invalid_target_falsy_envelope: mailbox not cleared');

  // invalid_target missing op_id
  sendMailbox(store, {
    event_id: 200,
    type: 'label_add',
    payload: { action: 'label_add' },
    source: 'ui_renderer',
    ts: 0,
  });
  store.consumeOnce();
  assert(getErrorCode(store) === 'invalid_target', 'editor_invalid_target_missing_op_id');
  assert(getErrorOpId(store) === '', 'editor_error_op_id_empty_on_missing_op_id');

  // invalid_target non-string op_id
  sendMailbox(store, {
    event_id: 201,
    type: 'label_add',
    payload: { action: 'label_add', meta: { op_id: 123 } },
    source: 'ui_renderer',
    ts: 0,
  });
  store.consumeOnce();
  assert(getErrorCode(store) === 'invalid_target', 'editor_invalid_target_non_string_op_id');
  assert(getErrorOpId(store) === '', 'editor_error_op_id_empty_on_non_string_op_id');

  // invalid_target over unknown_action (missing op_id + unknown_action)
  sendMailbox(store, {
    event_id: 202,
    type: 'nope',
    payload: { action: 'nope' },
    source: 'ui_renderer',
    ts: 0,
  });
  store.consumeOnce();
  assert(getErrorCode(store) === 'invalid_target', 'editor_invalid_target_over_unknown_action');

  // unknown_action
  sendMailbox(store, mailboxEnvelope({ event_id: 203, action: 'nope', op_id: 'op_203' }));
  store.consumeOnce();
  assert(getErrorCode(store) === 'unknown_action', 'editor_unknown_action');

  // invalid_target missing target
  sendMailbox(store, mailboxEnvelope({ event_id: 210, action: 'label_add', op_id: 'op_210', value: { t: 'str', v: 'x' } }));
  store.consumeOnce();
  assert(getErrorCode(store) === 'invalid_target', 'editor_invalid_target_missing_target');

  // invalid_target missing target coords
  sendMailbox(store, mailboxEnvelope({ event_id: 211, action: 'label_add', op_id: 'op_211', target: { model_id: 1 }, value: { t: 'str', v: 'x' } }));
  store.consumeOnce();
  assert(getErrorCode(store) === 'invalid_target', 'editor_invalid_target_missing_target_coords');

  // invalid_target missing target k
  sendMailbox(store, mailboxEnvelope({ event_id: 212, action: 'label_add', op_id: 'op_212', target: { model_id: 1, p: 0, r: 0, c: 0 }, value: { t: 'str', v: 'x' } }));
  store.consumeOnce();
  assert(getErrorCode(store) === 'invalid_target', 'editor_invalid_target_missing_target_k');

  // invalid_target missing value
  sendMailbox(store, mailboxEnvelope({ event_id: 213, action: 'label_add', op_id: 'op_213', target: { model_id: 1, p: 0, r: 0, c: 0, k: 'title' } }));
  store.consumeOnce();
  assert(getErrorCode(store) === 'invalid_target', 'editor_invalid_target_missing_value');

  // invalid_target non-string value.t
  sendMailbox(store, mailboxEnvelope({ event_id: 214, action: 'label_add', op_id: 'op_214', target: { model_id: 1, p: 0, r: 0, c: 0, k: 'title' }, value: { t: 123, v: 'x' } }));
  store.consumeOnce();
  assert(getErrorCode(store) === 'invalid_target', 'editor_invalid_target_non_string_value_t');

  // invalid_target missing value.v
  sendMailbox(store, mailboxEnvelope({ event_id: 2141, action: 'label_add', op_id: 'op_2141', target: { model_id: 1, p: 0, r: 0, c: 0, k: 'title' }, value: { t: 'str' } }));
  store.consumeOnce();
  assert(getErrorCode(store) === 'invalid_target', 'editor_invalid_target_missing_value_v');

  // invalid_target source mismatch
  sendMailbox(store, {
    event_id: 2142,
    type: 'label_add',
    payload: { action: 'label_add', meta: { op_id: 'op_2142' }, target: { model_id: 1, p: 0, r: 0, c: 0, k: 'title' }, value: { t: 'str', v: 'x' } },
    source: 'not_ui_renderer',
    ts: 0,
  });
  store.consumeOnce();
  assert(getErrorCode(store) === 'invalid_target', 'editor_invalid_target_source_mismatch');

  // invalid_target type mismatch
  sendMailbox(store, {
    event_id: 2143,
    type: 'label_remove',
    payload: { action: 'label_add', meta: { op_id: 'op_2143' }, target: { model_id: 1, p: 0, r: 0, c: 0, k: 'title' }, value: { t: 'str', v: 'x' } },
    source: 'ui_renderer',
    ts: 0,
  });
  store.consumeOnce();
  assert(getErrorCode(store) === 'invalid_target', 'editor_invalid_target_type_mismatch');

  // forbidden_k
  sendMailbox(store, mailboxEnvelope({ event_id: 215, action: 'label_add', op_id: 'op_215', target: { model_id: 1, p: 0, r: 0, c: 0, k: 'run_x' }, value: { t: 'str', v: 'x' } }));
  store.consumeOnce();
  assert(getErrorCode(store) === 'forbidden_k', 'editor_forbidden_k_reject');

  // forbidden_t
  sendMailbox(store, mailboxEnvelope({ event_id: 216, action: 'label_add', op_id: 'op_216', target: { model_id: 1, p: 0, r: 0, c: 0, k: 'title' }, value: { t: 'PIN_IN', v: 'x' } }));
  store.consumeOnce();
  assert(getErrorCode(store) === 'forbidden_t', 'editor_forbidden_t_reject');

  // reserved_cell
  sendMailbox(store, mailboxEnvelope({ event_id: 217, action: 'label_add', op_id: 'op_217', target: { model_id: 0, p: 0, r: 0, c: 0, k: 'title' }, value: { t: 'str', v: 'x' } }));
  store.consumeOnce();
  assert(getErrorCode(store) === 'reserved_cell', 'editor_reserved_cell_reject');

  // error priority invalid_target vs forbidden_k: missing value beats forbidden_k
  sendMailbox(store, mailboxEnvelope({ event_id: 218, action: 'label_add', op_id: 'op_218', target: { model_id: 1, p: 0, r: 0, c: 0, k: 'run_x' } }));
  store.consumeOnce();
  assert(getErrorCode(store) === 'invalid_target', 'editor_error_priority_invalid_target_vs_forbidden_k');

  // value ignored for cell_clear does not affect priority
  sendMailbox(store, mailboxEnvelope({ event_id: 219, action: 'cell_clear', op_id: 'op_219', target: { model_id: 1, p: 0, r: 0, c: 0 }, value: { t: 'PIN_IN', v: 'x' } }));
  store.consumeOnce();
  assert(getErrorCode(store) !== 'forbidden_t', 'editor_value_ignored_does_not_affect_priority');

  // submodel_create target ignored
  sendMailbox(store, mailboxEnvelope({
    event_id: 220,
    action: 'submodel_create',
    op_id: 'op_220',
    target: { model_id: 0, p: 0, r: 0, c: 0, k: 'run_x' },
    value: { t: 'json', v: { id: 2, name: 'M2', type: 'main' } },
  }));
  store.consumeOnce();
  assert(store.runtime.getModel(2), 'editor_submodel_create_target_ignored');

  // submodel_create duplicate id
  sendMailbox(store, mailboxEnvelope({ event_id: 221, action: 'submodel_create', op_id: 'op_221', value: { t: 'json', v: { id: 2, name: 'M2', type: 'main' } } }));
  store.consumeOnce();
  assert(getErrorCode(store) === 'invalid_target', 'editor_submodel_create_duplicate_id_invalid_target');

  // submodel_create invalid name
  sendMailbox(store, mailboxEnvelope({ event_id: 222, action: 'submodel_create', op_id: 'op_222', value: { t: 'json', v: { id: 3, name: '', type: 'main' } } }));
  store.consumeOnce();
  assert(getErrorCode(store) === 'invalid_target', 'editor_submodel_create_invalid_target');

  // submodel_create invalid value.t
  sendMailbox(store, mailboxEnvelope({ event_id: 223, action: 'submodel_create', op_id: 'op_223', value: { t: 'str', v: { id: 4, name: 'M4', type: 'main' } } }));
  store.consumeOnce();
  assert(getErrorCode(store) === 'invalid_target', 'editor_submodel_create_value_t_invalid_target');

  // op_id_replay
  const lastOk = getLastOpId(store);
  sendMailbox(store, mailboxEnvelope({ event_id: 224, action: 'label_remove', op_id: lastOk, target: { model_id: 1, p: 0, r: 0, c: 0, k: 'title' } }));
  store.consumeOnce();
  assert(getErrorCode(store) === 'op_id_replay', 'editor_op_id_replay');

  // mailbox full host enforcement
  sendMailbox(store, mailboxEnvelope({ event_id: 230, action: 'label_remove', op_id: 'op_230', target: { model_id: 1, p: 0, r: 0, c: 0, k: 'title' } }));
  let fullThrown = false;
  try {
    sendMailbox(store, mailboxEnvelope({ event_id: 231, action: 'label_remove', op_id: 'op_231', target: { model_id: 1, p: 0, r: 0, c: 0, k: 'title' } }));
  } catch (_) {
    fullThrown = true;
  }
  assert(fullThrown === true, 'editor_single_outstanding_event');
  store.consumeOnce();

  const results = [
    'editor_event_only: PASS',
    'editor_cell_crud: PASS',
    'editor_submodel_create: PASS',
    'editor_no_state_bypass: PASS',
    'editor_event_consumed_once: PASS',
    'editor_forbidden_k_reject: PASS',
    'editor_forbidden_t_reject: PASS',
    'editor_reserved_model_reject: PASS',
    'editor_event_payload_shape: PASS',
    'editor_reserved_cell_reject: PASS',
    'editor_error_priority: PASS',
    'editor_invalid_target_missing_op_id: PASS',
    'editor_invalid_target_non_string_op_id: PASS',
    'editor_invalid_target_missing_target: PASS',
    'editor_invalid_target_missing_target_coords: PASS',
    'editor_invalid_target_missing_target_k: PASS',
    'editor_invalid_target_missing_value: PASS',
    'editor_invalid_target_non_string_value_t: PASS',
    'editor_invalid_target_missing_value_v: PASS',
    'editor_invalid_target_source_mismatch: PASS',
    'editor_invalid_target_type_mismatch: PASS',
    'editor_error_priority_invalid_target_vs_forbidden_k: PASS',
    'editor_error_op_id_empty_on_missing_op_id: PASS',
    'editor_error_op_id_empty_on_non_string_op_id: PASS',
    'editor_invalid_target_over_unknown_action: PASS',
    'editor_unknown_action: PASS',
    'editor_invalid_target_falsy_envelope: PASS',
    'editor_submodel_create_target_ignored: PASS',
    'editor_submodel_create_invalid_target: PASS',
    'editor_submodel_create_duplicate_id_invalid_target: PASS',
    'editor_submodel_create_value_t_invalid_target: PASS',
    'editor_value_ignored_does_not_affect_priority: PASS',
    'editor_renderer_skip_mailbox_full: PASS',
    'editor_single_outstanding_event: PASS',
    'editor_op_id_replay: PASS',
  ];
  process.stdout.write(results.join('\n'));
  process.stdout.write('\n');
}

try {
  run();
  process.exit(0);
} catch (err) {
  process.stderr.write(`FAIL: ${err.message}\n`);
  process.exit(1);
}
