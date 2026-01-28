import { reactive } from 'vue';
import { ModelTableRuntime } from '../../worker-base/src/index.mjs';
import { createLocalBusAdapter } from './local_bus_adapter.js';

const EDITOR_MODEL_ID = 99;
const EDITOR_STATE_MODEL_ID = 98;

function getSnapshotModel(snapshot, modelId) {
  if (!snapshot || !snapshot.models) return null;
  return snapshot.models[modelId] || snapshot.models[String(modelId)] || null;
}

function getSnapshotLabelValue(snapshot, ref) {
  const modelId = ref && typeof ref.model_id === 'number' ? ref.model_id : 0;
  const model = getSnapshotModel(snapshot, modelId);
  if (!model || !model.cells) return undefined;
  const key = `${ref.p},${ref.r},${ref.c}`;
  const cell = model.cells[key];
  if (!cell || !cell.labels) return undefined;
  const label = cell.labels[ref.k];
  if (!label) return undefined;
  return label.v;
}

function parseSafeInt(value) {
  if (typeof value === 'number' && Number.isSafeInteger(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length === 0) return null;
    if (!/^-?\d+$/.test(trimmed)) return null;
    const parsed = Number(trimmed);
    if (!Number.isSafeInteger(parsed)) return null;
    return parsed;
  }
  return null;
}

export function buildEditorAstV0() {
  return {
    id: 'root',
    type: 'Root',
    children: [
      {
        id: 'layout',
        type: 'Container',
        props: { layout: 'column', gap: 12 },
        children: [
          {
            id: 'card_actions',
            type: 'Card',
            props: { title: 'Actions' },
            children: [
              {
                id: 'btn_create_model1',
                type: 'Button',
                props: { label: 'Create Model 1' },
                bind: {
                  write: {
                    action: 'submodel_create',
                    value_ref: { t: 'json', v: { id: 1, name: 'M1', type: 'main' } },
                  },
                },
              },
              {
                id: 'btn_add_title',
                type: 'Button',
                props: { label: 'Add title' },
                bind: {
                  write: {
                    action: 'label_add',
                    target_ref: { model_id: 1, p: 0, r: 0, c: 0, k: 'title' },
                    value_ref: { t: 'str', v: 'Hello' },
                  },
                },
              },
              {
                id: 'input_update_title',
                type: 'Input',
                bind: {
                  read: { model_id: 1, p: 0, r: 0, c: 0, k: 'title' },
                  write: {
                    action: 'label_update',
                    target_ref: { model_id: 1, p: 0, r: 0, c: 0, k: 'title' },
                  },
                },
              },
              {
                id: 'btn_remove_title',
                type: 'Button',
                props: { label: 'Remove title' },
                bind: {
                  write: {
                    action: 'label_remove',
                    target_ref: { model_id: 1, p: 0, r: 0, c: 0, k: 'title' },
                  },
                },
              },
              {
                id: 'btn_clear_cell',
                type: 'Button',
                props: { label: 'Clear cell(0,0,0)' },
                bind: {
                  write: {
                    action: 'cell_clear',
                    target_ref: { model_id: 1, p: 0, r: 0, c: 0 },
                  },
                },
              },
            ],
          },
          {
            id: 'card_status',
            type: 'Card',
            props: { title: 'Mailbox' },
            children: [
              {
                id: 'txt_last_op',
                type: 'Text',
                bind: { read: { model_id: 99, p: 0, r: 0, c: 1, k: 'ui_event_last_op_id' } },
              },
              {
                id: 'txt_error',
                type: 'CodeBlock',
                bind: { read: { model_id: 99, p: 0, r: 0, c: 1, k: 'ui_event_error' } },
              },
            ],
          },
          {
            id: 'card_snapshot',
            type: 'Card',
            props: { title: 'Snapshot' },
            children: [
              {
                id: 'snapshot_json',
                type: 'CodeBlock',
                bind: { read: { model_id: 99, p: 0, r: 1, c: 0, k: 'snapshot_json' } },
              },
            ],
          },
          {
            id: 'card_eventlog',
            type: 'Card',
            props: { title: 'Event Log' },
            children: [
              {
                id: 'event_log',
                type: 'CodeBlock',
                bind: { read: { model_id: 99, p: 0, r: 1, c: 1, k: 'event_log' } },
              },
            ],
          },
        ],
      },
    ],
  };
}

export function buildEditorAstV1(snapshot) {
  const models = (snapshot && snapshot.models) ? snapshot.models : {};
  const modelOptions = Object.values(models)
    .map((m) => ({ id: m && typeof m.id === 'number' ? m.id : parseSafeInt(m && m.id), name: m && m.name ? String(m.name) : '' }))
    .filter((m) => Number.isInteger(m.id) && m.id !== 0 && m.id !== EDITOR_MODEL_ID && m.id !== EDITOR_STATE_MODEL_ID)
    .sort((a, b) => a.id - b.id)
    .map((m) => ({ label: `${m.id}${m.name ? ` (${m.name})` : ''}`, value: m.id }));

  const selectedModelRaw = getSnapshotLabelValue(snapshot, { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'selected_model_id' });
  const selectedModelId = parseSafeInt(selectedModelRaw);
  const targetModel = selectedModelId === null ? null : getSnapshotModel(snapshot, selectedModelId);
  const targetExists = Boolean(targetModel);

  const draftP = parseSafeInt(getSnapshotLabelValue(snapshot, { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'draft_p' })) ?? 0;
  const draftR = parseSafeInt(getSnapshotLabelValue(snapshot, { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'draft_r' })) ?? 0;
  const draftC = parseSafeInt(getSnapshotLabelValue(snapshot, { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'draft_c' })) ?? 0;
  const draftK = String(getSnapshotLabelValue(snapshot, { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'draft_k' }) ?? '').trim();
  const draftT = String(getSnapshotLabelValue(snapshot, { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'draft_t' }) ?? 'str');

  const draftText = String(getSnapshotLabelValue(snapshot, { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'draft_v_text' }) ?? '');
  const draftInt = getSnapshotLabelValue(snapshot, { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'draft_v_int' });
  const draftBool = getSnapshotLabelValue(snapshot, { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'draft_v_bool' });

  const valueT = ['str', 'int', 'bool', 'json'].includes(draftT) ? draftT : 'str';
  let valueV = draftText;
  if (valueT === 'int') {
    valueV = typeof draftInt === 'number' ? draftInt : parseSafeInt(draftInt) ?? 0;
  } else if (valueT === 'bool') {
    if (draftBool === true || draftBool === false) {
      valueV = draftBool;
    } else if (typeof draftBool === 'string') {
      const trimmed = draftBool.trim();
      if (trimmed === 'true') valueV = true;
      else if (trimmed === 'false') valueV = false;
      else valueV = Boolean(draftBool);
    } else {
      valueV = Boolean(draftBool);
    }
  } else if (valueT === 'json') {
    valueV = draftText;
  }

  const controlsDisabled = !targetExists;
  const labelActionsDisabled = controlsDisabled || draftK.length === 0;
  const valueTextDisabled = valueT === 'int' || valueT === 'bool';
  const valueIntDisabled = valueT !== 'int';
  const valueBoolDisabled = valueT !== 'bool';

  const labelRows = [];
  if (targetModel && targetModel.cells) {
    const cellKey = `${draftP},${draftR},${draftC}`;
    const cell = targetModel.cells[cellKey];
    const labels = cell && cell.labels ? cell.labels : {};
    for (const [k, lv] of Object.entries(labels)) {
      labelRows.push({ k, t: lv && lv.t ? String(lv.t) : '', v: stringify(lv && Object.prototype.hasOwnProperty.call(lv, 'v') ? lv.v : undefined) });
    }
    labelRows.sort((a, b) => a.k.localeCompare(b.k));
  }

  const nextId = (() => {
    let max = 0;
    for (const m of Object.values(models)) {
      const id = m && typeof m.id === 'number' ? m.id : parseSafeInt(m && m.id);
      if (!Number.isInteger(id)) continue;
      if (id === EDITOR_MODEL_ID || id === EDITOR_STATE_MODEL_ID) continue;
      if (id > max) max = id;
    }
    return Math.max(1, max + 1);
  })();

  const missingModelText = selectedModelId !== null && !targetExists
    ? `Selected model ${selectedModelId} missing. Create it first.`
    : '';

  return {
    id: 'root_v1',
    type: 'Root',
    children: [
      {
        id: 'layout',
        type: 'Container',
        props: { layout: 'column', gap: 12 },
        children: [
          {
            id: 'card_editor',
            type: 'Card',
            props: { title: 'ModelTable Editor' },
            children: [
              {
                id: 'txt_missing_model',
                type: 'Text',
                props: { type: 'danger' },
                bind: missingModelText ? undefined : undefined,
                ...(missingModelText ? { props: { type: 'danger', text: missingModelText } } : {}),
              },
              {
                id: 'form_controls',
                type: 'Form',
                children: [
                  {
                    id: 'fi_model',
                    type: 'FormItem',
                    props: { label: 'Target model' },
                    children: [
                      {
                        id: 'sel_target_model',
                        type: 'Select',
                        props: { options: modelOptions, placeholder: 'Select model' },
                        bind: {
                          read: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'selected_model_id' },
                          write: { action: 'label_update', target_ref: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'selected_model_id' } },
                        },
                      },
                      {
                        id: 'btn_create_next_model',
                        type: 'Button',
                        props: { label: `Create model ${nextId}` },
                        bind: {
                          write: {
                            action: 'submodel_create',
                            value_ref: { t: 'json', v: { id: nextId, name: `M${nextId}`, type: 'main' } },
                          },
                        },
                      },
                    ],
                  },
                  {
                    id: 'fi_coords',
                    type: 'FormItem',
                    props: { label: 'Cell (p,r,c)' },
                    children: [
                      {
                        id: 'num_p',
                        type: 'NumberInput',
                        props: { disabled: controlsDisabled },
                        bind: {
                          read: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'draft_p' },
                          write: { action: 'label_update', target_ref: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'draft_p' } },
                        },
                      },
                      {
                        id: 'num_r',
                        type: 'NumberInput',
                        props: { disabled: controlsDisabled },
                        bind: {
                          read: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'draft_r' },
                          write: { action: 'label_update', target_ref: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'draft_r' } },
                        },
                      },
                      {
                        id: 'num_c',
                        type: 'NumberInput',
                        props: { disabled: controlsDisabled },
                        bind: {
                          read: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'draft_c' },
                          write: { action: 'label_update', target_ref: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'draft_c' } },
                        },
                      },
                    ],
                  },
                  {
                    id: 'fi_key',
                    type: 'FormItem',
                    props: { label: 'Label key (k)' },
                    children: [
                      {
                        id: 'input_k',
                        type: 'Input',
                        props: { disabled: controlsDisabled },
                        bind: {
                          read: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'draft_k' },
                          write: { action: 'label_update', target_ref: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'draft_k' } },
                        },
                      },
                    ],
                  },
                  {
                    id: 'fi_type',
                    type: 'FormItem',
                    props: { label: 'Type (t)' },
                    children: [
                      {
                        id: 'sel_t',
                        type: 'Select',
                        props: {
                          disabled: controlsDisabled,
                          options: [
                            { label: 'str', value: 'str' },
                            { label: 'int', value: 'int' },
                            { label: 'bool', value: 'bool' },
                            { label: 'json', value: 'json' },
                          ],
                        },
                        bind: {
                          read: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'draft_t' },
                          write: { action: 'label_update', target_ref: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'draft_t' } },
                        },
                      },
                    ],
                  },
                  {
                    id: 'fi_value',
                    type: 'FormItem',
                    props: { label: 'Value (v)' },
                    children: [
                      {
                        id: 'input_v_text',
                        type: 'Input',
                        props: { disabled: controlsDisabled || valueTextDisabled },
                        bind: {
                          read: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'draft_v_text' },
                          write: { action: 'label_update', target_ref: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'draft_v_text' } },
                        },
                      },
                      {
                        id: 'num_v_int',
                        type: 'NumberInput',
                        props: { disabled: controlsDisabled || valueIntDisabled },
                        bind: {
                          read: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'draft_v_int' },
                          write: { action: 'label_update', target_ref: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'draft_v_int' } },
                        },
                      },
                      {
                        id: 'switch_v_bool',
                        type: 'Switch',
                        props: { disabled: controlsDisabled || valueBoolDisabled },
                        bind: {
                          read: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'draft_v_bool' },
                          write: { action: 'label_update', target_ref: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'draft_v_bool' } },
                        },
                      },
                    ],
                  },
                  {
                    id: 'fi_actions',
                    type: 'FormItem',
                    props: { label: 'Actions' },
                    children: [
                      {
                        id: 'btn_apply_add',
                        type: 'Button',
                        props: { label: 'Add label', disabled: labelActionsDisabled },
                        bind: {
                          write: {
                            action: 'label_add',
                            target_ref: { model_id: selectedModelId ?? 1, p: draftP, r: draftR, c: draftC, k: draftK || 'title' },
                            value_ref: { t: valueT, v: valueV },
                          },
                        },
                      },
                      {
                        id: 'btn_apply_update',
                        type: 'Button',
                        props: { label: 'Update label', disabled: labelActionsDisabled },
                        bind: {
                          write: {
                            action: 'label_update',
                            target_ref: { model_id: selectedModelId ?? 1, p: draftP, r: draftR, c: draftC, k: draftK || 'title' },
                            value_ref: { t: valueT, v: valueV },
                          },
                        },
                      },
                      {
                        id: 'btn_apply_remove',
                        type: 'Button',
                        props: { label: 'Remove label', disabled: labelActionsDisabled },
                        bind: {
                          write: {
                            action: 'label_remove',
                            target_ref: { model_id: selectedModelId ?? 1, p: draftP, r: draftR, c: draftC, k: draftK || 'title' },
                          },
                        },
                      },
                      {
                        id: 'btn_apply_clear',
                        type: 'Button',
                        props: { label: 'Clear cell', disabled: controlsDisabled },
                        bind: {
                          write: {
                            action: 'cell_clear',
                            target_ref: { model_id: selectedModelId ?? 1, p: draftP, r: draftR, c: draftC },
                          },
                        },
                      },
                    ],
                  },
                ],
              },
              {
                id: 'card_cell',
                type: 'Card',
                props: { title: 'Cell labels' },
                children: [
                  {
                    id: 'tbl_labels',
                    type: 'Table',
                    props: { data: labelRows },
                    children: [
                      { id: 'col_k', type: 'TableColumn', props: { label: 'k', prop: 'k' } },
                      { id: 'col_t', type: 'TableColumn', props: { label: 't', prop: 't' } },
                      { id: 'col_v', type: 'TableColumn', props: { label: 'v', prop: 'v' } },
                    ],
                  },
                ],
              },
            ],
          },
          {
            id: 'card_status',
            type: 'Card',
            props: { title: 'Mailbox' },
            children: [
              { id: 'txt_last_op', type: 'Text', bind: { read: { model_id: EDITOR_MODEL_ID, p: 0, r: 0, c: 1, k: 'ui_event_last_op_id' } } },
              { id: 'txt_error', type: 'CodeBlock', bind: { read: { model_id: EDITOR_MODEL_ID, p: 0, r: 0, c: 1, k: 'ui_event_error' } } },
            ],
          },
          {
            id: 'card_snapshot',
            type: 'Card',
            props: { title: 'Snapshot' },
            children: [
              { id: 'snapshot_json', type: 'CodeBlock', bind: { read: { model_id: EDITOR_MODEL_ID, p: 0, r: 1, c: 0, k: 'snapshot_json' } } },
            ],
          },
          {
            id: 'card_eventlog',
            type: 'Card',
            props: { title: 'Event Log' },
            children: [
              { id: 'event_log', type: 'CodeBlock', bind: { read: { model_id: EDITOR_MODEL_ID, p: 0, r: 1, c: 1, k: 'event_log' } } },
            ],
          },
        ],
      },
    ],
  };
}

function stringify(value) {
  if (value === undefined) return '';
  if (value === null) return 'null';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch (_) {
    return String(value);
  }
}

export function createDemoStore() {
  const runtime = new ModelTableRuntime();
  const uiMode = arguments.length > 0 && arguments[0] && arguments[0].uiMode ? arguments[0].uiMode : 'v1';
  const adapterMode = arguments.length > 0 && arguments[0] && arguments[0].adapterMode ? arguments[0].adapterMode : 'v1';

  runtime.createModel({ id: EDITOR_MODEL_ID, name: 'editor_mailbox', type: 'ui' });
  const stateModel = runtime.createModel({ id: EDITOR_STATE_MODEL_ID, name: 'editor_state', type: 'ui' });
  runtime.addLabel(stateModel, 0, 0, 0, { k: 'selected_model_id', t: 'str', v: '1' });
  runtime.addLabel(stateModel, 0, 0, 0, { k: 'draft_p', t: 'str', v: '0' });
  runtime.addLabel(stateModel, 0, 0, 0, { k: 'draft_r', t: 'str', v: '0' });
  runtime.addLabel(stateModel, 0, 0, 0, { k: 'draft_c', t: 'str', v: '0' });
  runtime.addLabel(stateModel, 0, 0, 0, { k: 'draft_k', t: 'str', v: 'title' });
  runtime.addLabel(stateModel, 0, 0, 0, { k: 'draft_t', t: 'str', v: 'str' });
  runtime.addLabel(stateModel, 0, 0, 0, { k: 'draft_v_text', t: 'str', v: 'Hello' });
  runtime.addLabel(stateModel, 0, 0, 0, { k: 'draft_v_int', t: 'int', v: 0 });
  runtime.addLabel(stateModel, 0, 0, 0, { k: 'draft_v_bool', t: 'bool', v: false });

  const snapshot = reactive(runtime.snapshot());
  const eventLog = [];
  const adapter = createLocalBusAdapter({ runtime, eventLog, mode: adapterMode });

  function refreshSnapshot() {
    const next = runtime.snapshot();
    snapshot.models = next.models;
    snapshot.v1nConfig = next.v1nConfig;
  }

  function setMailboxValue(envelopeOrNull) {
    const model = runtime.getModel(EDITOR_MODEL_ID);
    runtime.addLabel(model, 0, 0, 1, { k: 'ui_event', t: 'event', v: envelopeOrNull });
  }

  function updateDerived() {
    const snap = runtime.snapshot();
    const safeModels = {};
    const snapModels = snap && snap.models ? snap.models : {};
    for (const [id, model] of Object.entries(snapModels)) {
      if (String(id) === String(EDITOR_MODEL_ID)) continue;
      if (String(id) === String(EDITOR_STATE_MODEL_ID)) continue;
      safeModels[id] = model;
    }

    adapter.updateUiDerived({
      uiAst: uiMode === 'v0' ? buildEditorAstV0() : buildEditorAstV1(snap),
      snapshotJson: JSON.stringify({ models: safeModels, v1nConfig: snap ? snap.v1nConfig : undefined }, null, 2),
      eventLogJson: JSON.stringify(eventLog, null, 2),
    });
  }

  function getUiAst() {
    const model = runtime.getModel(EDITOR_MODEL_ID);
    const cell = runtime.getCell(model, 0, 0, 0);
    const label = cell.labels.get('ui_ast_v0');
    return label ? label.v : null;
  }

  function dispatchAddLabel(label) {
    if (!label || label.t !== 'event') {
      throw new Error('non_event_write');
    }
    if (label.p !== 0 || label.r !== 0 || label.c !== 1 || label.k !== 'ui_event') {
      throw new Error('event_mailbox_mismatch');
    }

    const model = runtime.getModel(EDITOR_MODEL_ID);
    const cell = runtime.getCell(model, 0, 0, 1);
    const current = cell.labels.get('ui_event');
    if (current && current.v !== null && current.v !== undefined) {
      throw new Error('event_mailbox_full');
    }

    setMailboxValue(label.v);
    refreshSnapshot();
  }

  function dispatchRmLabel(labelRef) {
    if (!labelRef || labelRef.p !== 0 || labelRef.r !== 0 || labelRef.c !== 1 || labelRef.k !== 'ui_event') {
      return;
    }
    setMailboxValue(null);
    refreshSnapshot();
  }

  function consumeOnce() {
    const result = adapter.consumeOnce();
    updateDerived();
    refreshSnapshot();
    return result;
  }

  setMailboxValue(null);
  updateDerived();
  refreshSnapshot();

  return {
    runtime,
    snapshot,
    getUiAst,
    dispatchAddLabel,
    dispatchRmLabel,
    consumeOnce,
    stringify,
    uiMode,
    adapterMode,
  };
}

export function buildDemoAstSample() {
  return buildEditorAstV1({ models: {} });
}
