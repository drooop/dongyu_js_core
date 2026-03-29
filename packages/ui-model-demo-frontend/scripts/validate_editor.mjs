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
  const mailboxModel = store.runtime.getModel(-1);
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

function getErrorDetail(store) {
  const cell = getMailboxCell(store);
  const err = cell.labels.get('ui_event_error');
  return err && err.v ? err.v.detail : null;
}

function getLastOpId(store) {
  const cell = getMailboxCell(store);
  const last = cell.labels.get('ui_event_last_op_id');
  return last ? String(last.v || '') : '';
}

function run() {
  const results = [];

  const store = createDemoStore({ uiMode: 'v1', adapterMode: 'v1' });
  const stateModel = store.runtime.getModel(-2);
  store.runtime.addLabel(stateModel, 0, 0, 0, { k: 'ui_page', t: 'str', v: 'test' });
  store.setRoutePath('/__test__');
  store.consumeOnce();

  const calls = [];
  const host = createHost(store, calls);
  const renderer = createRenderer({ host });

  const localProbeTarget = { model_id: -2, p: 9, r: 9, c: 9, k: 'probe' };
  const localProbeClearTarget = { model_id: -2, p: 9, r: 9, c: 9 };
  const businessTitleTarget = { model_id: 1, p: 0, r: 0, c: 0, k: 'title' };
  const businessClearTarget = { model_id: 1, p: 0, r: 0, c: 0 };

  const ast = store.getUiAst();
  assert(ast && ast.type === 'Root', 'editor_ast: missing Root');

  const directMutationNote = findNodeById(ast, 'txt_direct_mutation_blocked');
  const btnCreateModel = findNodeById(ast, 'btn_create_next_model');
  const btnAdd = findNodeById(ast, 'btn_apply_add');
  const inputVText = findNodeById(ast, 'input_v_text');
  const btnUpdate = findNodeById(ast, 'btn_apply_update');
  const btnRemove = findNodeById(ast, 'btn_apply_remove');
  const btnClear = findNodeById(ast, 'btn_apply_clear');
  assert(directMutationNote, 'editor_ast: missing direct mutation warning');
  assert(!btnCreateModel, 'editor_ast: legacy submodel_create button must be removed');
  assert(btnAdd && inputVText && btnUpdate && btnRemove && btnClear, 'editor_ast: missing nodes');
  results.push('editor_ast_no_direct_mutation_buttons: PASS');

  const model1 = store.runtime.getModel(1);
  assert(model1, 'editor_default_model_1_missing');
  const businessCell = store.runtime.getCell(model1, 0, 0, 0);
  const localProbeCell = store.runtime.getCell(stateModel, 9, 9, 9);
  const stateRoot = store.runtime.getCell(stateModel, 0, 0, 0);
  const businessTitleBefore = businessCell.labels.get('title')?.v;
  const nextRejectedModelId = Math.max(
    2000,
    ...Array.from(store.runtime.models.keys()).filter((id) => Number.isInteger(id) && id > 0),
  ) + 1;

  // direct mutation to business models must be rejected
  assert(!store.runtime.getModel(nextRejectedModelId), 'editor_submodel_create_rejected_precondition');
  sendMailbox(store, mailboxEnvelope({
    event_id: 110,
    action: 'submodel_create',
    op_id: 'op_110',
    value: { t: 'json', v: { id: nextRejectedModelId, name: `M${nextRejectedModelId}`, type: 'main' } },
  }));
  store.consumeOnce();
  assert(!store.runtime.getModel(nextRejectedModelId), 'editor_submodel_create_rejected_no_create');
  assert(getErrorCode(store) === 'direct_model_mutation_disabled', 'editor_submodel_create_rejected');
  assert(getErrorDetail(store) === 'submodel_create', 'editor_submodel_create_rejected_detail');
  results.push('editor_submodel_create_rejected: PASS');

  const directMutationCases = [
    {
      name: 'editor_label_add_business_rejected',
      envelope: mailboxEnvelope({ event_id: 111, action: 'label_add', op_id: 'op_111', target: businessTitleTarget, value: { t: 'str', v: 'Hello' } }),
      verify: () => assert(businessCell.labels.get('title')?.v === businessTitleBefore, 'editor_label_add_business_rejected_no_write'),
    },
    {
      name: 'editor_label_update_business_rejected',
      envelope: mailboxEnvelope({ event_id: 112, action: 'label_update', op_id: 'op_112', target: businessTitleTarget, value: { t: 'str', v: 'World' } }),
      verify: () => assert(businessCell.labels.get('title')?.v === businessTitleBefore, 'editor_label_update_business_rejected_no_write'),
    },
    {
      name: 'editor_label_remove_business_rejected',
      envelope: mailboxEnvelope({ event_id: 113, action: 'label_remove', op_id: 'op_113', target: businessTitleTarget }),
      verify: () => assert(businessCell.labels.get('title')?.v === businessTitleBefore, 'editor_label_remove_business_rejected_no_write'),
    },
    {
      name: 'editor_cell_clear_business_rejected',
      envelope: mailboxEnvelope({ event_id: 114, action: 'cell_clear', op_id: 'op_114', target: businessClearTarget }),
      verify: () => assert(businessCell.labels.get('title')?.v === businessTitleBefore, 'editor_cell_clear_business_rejected_no_write'),
    },
  ];
  for (const testCase of directMutationCases) {
    sendMailbox(store, testCase.envelope);
    store.consumeOnce();
    assert(getErrorCode(store) === 'direct_model_mutation_disabled', `${testCase.name}_code`);
    assert(getErrorDetail(store) === testCase.envelope.payload.action, `${testCase.name}_detail`);
    testCase.verify();
    results.push(`${testCase.name}: PASS`);
  }

  // allowed local editor-state mutation still works through UI events
  const addEvent = renderer.dispatchEvent(btnAdd, {});
  assert(addEvent && addEvent.t === 'event', 'editor_event_only: label.t must be event');
  assert(
    addEvent.v && addEvent.v.payload && addEvent.v.payload.target && addEvent.v.payload.target.model_id === -2,
    'editor_local_probe_target_model'
  );
  assert(!localProbeCell.labels.get('probe'), 'editor_no_state_bypass: local probe created before consume');
  store.consumeOnce();
  assert(localProbeCell.labels.get('probe') && localProbeCell.labels.get('probe').v === 'Hello', 'editor_local_state_add');
  results.push('editor_local_state_add: PASS');

  renderer.dispatchEvent(inputVText, { value: 'World' });
  assert(stateRoot.labels.get('draft_v_text') && stateRoot.labels.get('draft_v_text').v === 'Hello', 'editor_input_no_state_bypass');
  store.consumeOnce();
  assert(stateRoot.labels.get('draft_v_text') && stateRoot.labels.get('draft_v_text').v === 'World', 'editor_local_state_input');
  results.push('editor_local_state_input: PASS');

  const ast2 = store.getUiAst();
  const btnUpdate2 = findNodeById(ast2, 'btn_apply_update');
  assert(btnUpdate2, 'editor_ast: missing btn_apply_update after value edit');
  renderer.dispatchEvent(btnUpdate2, {});
  store.consumeOnce();
  assert(localProbeCell.labels.get('probe') && localProbeCell.labels.get('probe').v === 'World', 'editor_local_state_update');
  results.push('editor_local_state_update: PASS');

  renderer.dispatchEvent(btnRemove, {});
  store.consumeOnce();
  assert(!localProbeCell.labels.get('probe'), 'editor_local_state_remove');
  results.push('editor_local_state_remove: PASS');

  renderer.dispatchEvent(btnAdd, {});
  store.consumeOnce();
  assert(localProbeCell.labels.get('probe') && localProbeCell.labels.get('probe').v === 'World', 'editor_local_state_readd_before_clear');
  renderer.dispatchEvent(btnClear, {});
  store.consumeOnce();
  assert(localProbeCell.labels.size === 0, 'editor_local_state_clear');
  results.push('editor_local_state_clear: PASS');

  const lastAdd = calls.filter((c) => c.type === 'add').slice(-1)[0];
  assert(lastAdd && lastAdd.label && lastAdd.label.k === 'ui_event', 'editor_event_mailbox_only: must write ui_event');
  assert(lastAdd.label.v && lastAdd.label.v.source === 'ui_renderer', 'editor_event_payload_shape: source mismatch');
  assert(lastAdd.label.v.payload && lastAdd.label.v.payload.meta && typeof lastAdd.label.v.payload.meta.op_id === 'string', 'editor_event_payload_shape: op_id missing');
  results.push('editor_event_payload_shape: PASS');

  const mailboxCell = getMailboxCell(store);
  const uiEvent = mailboxCell.labels.get('ui_event');
  assert(uiEvent && uiEvent.v === null, 'editor_event_consumed_once: ui_event not cleared');
  results.push('editor_event_consumed_once: PASS');

  const callsBeforeSkip = calls.length;
  sendMailbox(store, mailboxEnvelope({ event_id: 240, action: 'label_remove', op_id: 'op_240', target: localProbeTarget }));
  let mailboxFullError = null;
  try {
    renderer.dispatchEvent(btnRemove, {});
  } catch (error) {
    mailboxFullError = error;
  }
  assert(mailboxFullError && mailboxFullError.message === 'event_mailbox_full', 'editor_renderer_mailbox_full_guard');
  assert(calls.length === callsBeforeSkip + 1, 'editor_renderer_mailbox_full_guard: host call must be recorded once');
  assert(
    getMailboxCell(store).labels.get('ui_event')?.v?.payload?.meta?.op_id === 'op_240',
    'editor_renderer_mailbox_full_guard: pending mailbox event must remain unchanged',
  );
  store.consumeOnce();
  results.push('editor_renderer_mailbox_full_guard: PASS');

  // generic mailbox / validation behavior
  store.dispatchAddLabel({ p: 0, r: 0, c: 1, k: 'ui_event', t: 'event', v: '' });
  store.consumeOnce();
  assert(getErrorCode(store) === 'invalid_target', 'editor_invalid_target_falsy_envelope');
  assert(getMailboxCell(store).labels.get('ui_event').v === null, 'editor_invalid_target_falsy_envelope: mailbox not cleared');
  results.push('editor_invalid_target_falsy_envelope: PASS');

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
  results.push('editor_invalid_target_missing_op_id: PASS');
  results.push('editor_error_op_id_empty_on_missing_op_id: PASS');

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
  results.push('editor_invalid_target_non_string_op_id: PASS');
  results.push('editor_error_op_id_empty_on_non_string_op_id: PASS');

  sendMailbox(store, {
    event_id: 202,
    type: 'nope',
    payload: { action: 'nope' },
    source: 'ui_renderer',
    ts: 0,
  });
  store.consumeOnce();
  assert(getErrorCode(store) === 'invalid_target', 'editor_invalid_target_over_unknown_action');
  results.push('editor_invalid_target_over_unknown_action: PASS');

  sendMailbox(store, mailboxEnvelope({ event_id: 203, action: 'nope', op_id: 'op_203' }));
  store.consumeOnce();
  assert(getErrorCode(store) === 'unknown_action', 'editor_unknown_action');
  results.push('editor_unknown_action: PASS');

  sendMailbox(store, mailboxEnvelope({ event_id: 211, action: 'label_add', op_id: 'op_211', target: { model_id: -2 }, value: { t: 'str', v: 'x' } }));
  store.consumeOnce();
  assert(getErrorCode(store) === 'invalid_target', 'editor_invalid_target_missing_target_coords');
  results.push('editor_invalid_target_missing_target_coords: PASS');

  sendMailbox(store, mailboxEnvelope({ event_id: 212, action: 'label_add', op_id: 'op_212', target: { model_id: -2, p: 9, r: 9, c: 9 }, value: { t: 'str', v: 'x' } }));
  store.consumeOnce();
  assert(getErrorCode(store) === 'invalid_target', 'editor_invalid_target_missing_target_k');
  results.push('editor_invalid_target_missing_target_k: PASS');

  sendMailbox(store, mailboxEnvelope({ event_id: 213, action: 'label_add', op_id: 'op_213', target: localProbeTarget }));
  store.consumeOnce();
  assert(getErrorCode(store) === 'invalid_target', 'editor_invalid_target_missing_value');
  results.push('editor_invalid_target_missing_value: PASS');

  sendMailbox(store, mailboxEnvelope({ event_id: 214, action: 'label_add', op_id: 'op_214', target: localProbeTarget, value: { t: 123, v: 'x' } }));
  store.consumeOnce();
  assert(getErrorCode(store) === 'invalid_target', 'editor_invalid_target_non_string_value_t');
  results.push('editor_invalid_target_non_string_value_t: PASS');

  sendMailbox(store, mailboxEnvelope({ event_id: 2141, action: 'label_add', op_id: 'op_2141', target: localProbeTarget, value: { t: 'str' } }));
  store.consumeOnce();
  assert(getErrorCode(store) === 'invalid_target', 'editor_invalid_target_missing_value_v');
  results.push('editor_invalid_target_missing_value_v: PASS');

  sendMailbox(store, {
    event_id: 2142,
    type: 'label_add',
    payload: { action: 'label_add', meta: { op_id: 'op_2142' }, target: localProbeTarget, value: { t: 'str', v: 'x' } },
    source: 'not_ui_renderer',
    ts: 0,
  });
  store.consumeOnce();
  assert(getErrorCode(store) === 'invalid_target', 'editor_invalid_target_source_mismatch');
  results.push('editor_invalid_target_source_mismatch: PASS');

  sendMailbox(store, {
    event_id: 2143,
    type: 'label_remove',
    payload: { action: 'label_add', meta: { op_id: 'op_2143' }, target: localProbeTarget, value: { t: 'str', v: 'x' } },
    source: 'ui_renderer',
    ts: 0,
  });
  store.consumeOnce();
  assert(getErrorCode(store) === 'invalid_target', 'editor_invalid_target_type_mismatch');
  results.push('editor_invalid_target_type_mismatch: PASS');

  sendMailbox(store, mailboxEnvelope({ event_id: 215, action: 'label_add', op_id: 'op_215', target: { ...localProbeTarget, k: 'mqtt_probe' }, value: { t: 'str', v: 'x' } }));
  store.consumeOnce();
  assert(getErrorCode(store) === 'forbidden_k', 'editor_forbidden_k_reject');
  results.push('editor_forbidden_k_reject: PASS');

  sendMailbox(store, mailboxEnvelope({ event_id: 216, action: 'label_add', op_id: 'op_216', target: localProbeTarget, value: { t: 'PIN_IN', v: 'x' } }));
  store.consumeOnce();
  assert(getErrorCode(store) === 'forbidden_t', 'editor_forbidden_t_reject');
  results.push('editor_forbidden_t_reject: PASS');

  sendMailbox(store, mailboxEnvelope({ event_id: 217, action: 'label_add', op_id: 'op_217', target: { model_id: 0, p: 0, r: 0, c: 0, k: 'title' }, value: { t: 'str', v: 'x' } }));
  store.consumeOnce();
  assert(getErrorCode(store) === 'direct_model_mutation_disabled', 'editor_reserved_model_direct_mutation_reject');
  results.push('editor_reserved_model_direct_mutation_reject: PASS');

  sendMailbox(store, mailboxEnvelope({ event_id: 218, action: 'label_add', op_id: 'op_218', target: { ...localProbeTarget, k: 'mqtt_probe' } }));
  store.consumeOnce();
  assert(getErrorCode(store) === 'invalid_target', 'editor_error_priority_invalid_target_vs_forbidden_k');
  results.push('editor_error_priority_invalid_target_vs_forbidden_k: PASS');

  sendMailbox(store, mailboxEnvelope({ event_id: 219, action: 'cell_clear', op_id: 'op_219', target: localProbeClearTarget, value: { t: 'PIN_IN', v: 'x' } }));
  store.consumeOnce();
  assert(getErrorCode(store) !== 'forbidden_t', 'editor_value_ignored_does_not_affect_priority');
  results.push('editor_value_ignored_does_not_affect_priority: PASS');

  const lastOk = getLastOpId(store);
  sendMailbox(store, mailboxEnvelope({ event_id: 224, action: 'label_remove', op_id: lastOk, target: localProbeTarget }));
  store.consumeOnce();
  assert(getErrorCode(store) === 'op_id_replay', 'editor_op_id_replay');
  results.push('editor_op_id_replay: PASS');

  sendMailbox(store, mailboxEnvelope({ event_id: 230, action: 'label_remove', op_id: 'op_230', target: localProbeTarget }));
  let fullThrown = false;
  try {
    sendMailbox(store, mailboxEnvelope({ event_id: 231, action: 'label_remove', op_id: 'op_231', target: localProbeTarget }));
  } catch (_) {
    fullThrown = true;
  }
  assert(fullThrown === true, 'editor_single_outstanding_event');
  store.consumeOnce();
  results.push('editor_single_outstanding_event: PASS');

  // v1 suite: typed normalization stays on local editor-state mutations only
  const storeV1 = createDemoStore({ uiMode: 'v1', adapterMode: 'v1' });
  const stateModelV1 = storeV1.runtime.getModel(-2);
  storeV1.runtime.addLabel(stateModelV1, 0, 0, 0, { k: 'ui_page', t: 'str', v: 'test' });
  storeV1.setRoutePath('/__test__');
  storeV1.consumeOnce();
  const callsV1 = [];
  const hostV1 = createHost(storeV1, callsV1);
  const rendererV1 = createRenderer({ host: hostV1 });

  let astV1 = storeV1.getUiAst();
  assert(astV1 && astV1.type === 'Root', 'editor_v1_ast: missing Root');
  const noteV1 = findNodeById(astV1, 'txt_direct_mutation_blocked');
  const btnCreateNext = findNodeById(astV1, 'btn_create_next_model');
  const btnApplyAdd = findNodeById(astV1, 'btn_apply_add');
  const selTargetModel = findNodeById(astV1, 'sel_target_model');
  assert(noteV1, 'editor_v1_ast: missing direct mutation warning');
  assert(!btnCreateNext, 'editor_v1_ast: legacy submodel_create button must be removed');
  assert(btnApplyAdd && selTargetModel, 'editor_v1_ast: missing nodes');
  assert(btnApplyAdd.props && btnApplyAdd.props.disabled !== true, 'editor_v1_controls_enabled_by_default');
  results.push('editor_v1_controls_enabled_by_default: PASS');
  results.push('editor_v1_no_submodel_create_button: PASS');
  assert(
    selTargetModel.props
      && selTargetModel.props.options
      && selTargetModel.props.options.$label
      && selTargetModel.props.options.$label.k === 'editor_model_options_json',
    'editor_v1_model_selector_uses_state_label'
  );
  rendererV1.dispatchEvent(selTargetModel, { value: -1 });
  storeV1.consumeOnce();
  assert(
    stateModelV1
      && storeV1.runtime.getCell(stateModelV1, 0, 0, 0).labels.get('selected_model_id')
      && storeV1.runtime.getCell(stateModelV1, 0, 0, 0).labels.get('selected_model_id').v === -1,
    'editor_v1_model_selector_updates_state'
  );
  results.push('editor_v1_model_selector_uses_state_label: PASS');
  results.push('editor_v1_model_selector_updates_state: PASS');

  const localTypedCell = storeV1.runtime.getCell(stateModelV1, 10, 10, 10);
  const localTypedTarget = (k) => ({ model_id: -2, p: 10, r: 10, c: 10, k });

  sendMailbox(storeV1, mailboxEnvelope({
    event_id: 500,
    action: 'label_add',
    op_id: 'op_500',
    target: localTypedTarget('count'),
    value: { t: 'int', v: '123' },
  }));
  storeV1.consumeOnce();
  assert(localTypedCell.labels.get('count') && localTypedCell.labels.get('count').v === 123, 'editor_v1_typed_int_ok');
  results.push('editor_v1_typed_int_ok: PASS');

  sendMailbox(storeV1, mailboxEnvelope({
    event_id: 501,
    action: 'label_add',
    op_id: 'op_501',
    target: localTypedTarget('count_bad'),
    value: { t: 'int', v: '1.2' },
  }));
  storeV1.consumeOnce();
  assert(getErrorCode(storeV1) === 'invalid_target' && getErrorDetail(storeV1) === 'invalid_int', 'editor_v1_typed_int_invalid_int');
  results.push('editor_v1_typed_int_invalid_int: PASS');

  sendMailbox(storeV1, mailboxEnvelope({
    event_id: 502,
    action: 'label_add',
    op_id: 'op_502',
    target: localTypedTarget('flag'),
    value: { t: 'bool', v: 'true' },
  }));
  storeV1.consumeOnce();
  assert(localTypedCell.labels.get('flag') && localTypedCell.labels.get('flag').v === true, 'editor_v1_typed_bool_ok');
  results.push('editor_v1_typed_bool_ok: PASS');

  sendMailbox(storeV1, mailboxEnvelope({
    event_id: 503,
    action: 'label_add',
    op_id: 'op_503',
    target: localTypedTarget('flag_bad'),
    value: { t: 'bool', v: 'yes' },
  }));
  storeV1.consumeOnce();
  assert(getErrorCode(storeV1) === 'invalid_target' && getErrorDetail(storeV1) === 'invalid_bool', 'editor_v1_typed_bool_invalid_bool');
  results.push('editor_v1_typed_bool_invalid_bool: PASS');

  sendMailbox(storeV1, mailboxEnvelope({
    event_id: 504,
    action: 'label_add',
    op_id: 'op_504',
    target: localTypedTarget('obj'),
    value: { t: 'json', v: '{"a":1}' },
  }));
  storeV1.consumeOnce();
  assert(localTypedCell.labels.get('obj') && JSON.stringify(localTypedCell.labels.get('obj').v) === JSON.stringify({ a: 1 }), 'editor_v1_typed_json_ok');
  results.push('editor_v1_typed_json_ok: PASS');

  sendMailbox(storeV1, mailboxEnvelope({
    event_id: 505,
    action: 'label_add',
    op_id: 'op_505',
    target: localTypedTarget('obj_bad'),
    value: { t: 'json', v: '{' },
  }));
  storeV1.consumeOnce();
  assert(getErrorCode(storeV1) === 'invalid_target' && getErrorDetail(storeV1) === 'invalid_json', 'editor_v1_typed_json_invalid_json');
  results.push('editor_v1_typed_json_invalid_json: PASS');

  sendMailbox(storeV1, mailboxEnvelope({
    event_id: 507,
    action: 'label_add',
    op_id: 'op_507',
    target: localTypedTarget('event_payload'),
    value: { t: 'event', v: { action: 'submit' } },
  }));
  storeV1.consumeOnce();
  assert(
    localTypedCell.labels.get('event_payload')
      && localTypedCell.labels.get('event_payload').t === 'event'
      && localTypedCell.labels.get('event_payload').v
      && localTypedCell.labels.get('event_payload').v.action === 'submit',
    'editor_v1_typed_event_ok'
  );
  results.push('editor_v1_typed_event_ok: PASS');

  sendMailbox(storeV1, mailboxEnvelope({
    event_id: 508,
    action: 'label_add',
    op_id: 'op_508',
    target: localTypedTarget('event_payload'),
    value: { t: 'event', v: null },
  }));
  storeV1.consumeOnce();
  assert(localTypedCell.labels.get('event_payload') && localTypedCell.labels.get('event_payload').v === null, 'editor_v1_typed_event_null_ok');
  results.push('editor_v1_typed_event_null_ok: PASS');

  sendMailbox(storeV1, mailboxEnvelope({
    event_id: 509,
    action: 'label_add',
    op_id: 'op_509',
    target: { model_id: 1, p: 0, r: 0, c: 0, k: 'count' },
    value: { t: 'int', v: '1' },
  }));
  storeV1.consumeOnce();
  assert(getErrorCode(storeV1) === 'direct_model_mutation_disabled', 'editor_v1_business_direct_mutation_rejected');
  results.push('editor_v1_business_direct_mutation_rejected: PASS');

  // Static upload page branch exists and reflects upload prerequisites.
  storeV1.runtime.addLabel(stateModelV1, 0, 0, 0, { k: 'ui_page', t: 'str', v: 'static' });
  storeV1.setRoutePath('/static');
  storeV1.consumeOnce();
  let astStatic = storeV1.getUiAst();
  const cardStatic = findNodeById(astStatic, 'card_static_upload');
  const fileStatic = findNodeById(astStatic, 'file_static_upload');
  const btnStaticUpload = findNodeById(astStatic, 'btn_static_upload');
  assert(cardStatic, 'editor_v1_static_page_missing');
  assert(fileStatic, 'editor_v1_static_file_input_missing');
  assert(btnStaticUpload, 'editor_v1_static_upload_button_missing');
  assert(
    btnStaticUpload.props
      && btnStaticUpload.props.disabled
      && btnStaticUpload.props.disabled.$label
      && btnStaticUpload.props.disabled.$label.k === 'static_upload_disabled',
    'editor_v1_static_upload_uses_state_label'
  );

  storeV1.runtime.addLabel(stateModelV1, 0, 0, 0, { k: 'static_project_name', t: 'str', v: 'demo-static' });
  storeV1.runtime.addLabel(stateModelV1, 0, 0, 0, { k: 'static_media_uri', t: 'str', v: 'mxc://example.org/uploaded' });
  storeV1.consumeOnce();
  astStatic = storeV1.getUiAst();
  const btnStaticUploadReady = findNodeById(astStatic, 'btn_static_upload');
  assert(btnStaticUploadReady, 'editor_v1_static_upload_button_missing_after_media');
  assert(
    btnStaticUploadReady.props
      && btnStaticUploadReady.props.disabled
      && btnStaticUploadReady.props.disabled.$label
      && btnStaticUploadReady.props.disabled.$label.k === 'static_upload_disabled',
    'editor_v1_static_upload_binding_persisted'
  );
  results.push('editor_v1_static_page_present: PASS');
  results.push('editor_v1_static_upload_uses_state_label: PASS');
  results.push('editor_v1_static_upload_binding_persisted: PASS');

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
