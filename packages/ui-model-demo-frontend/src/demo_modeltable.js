import { reactive } from 'vue';
import { ModelTableRuntime } from '../../worker-base/src/index.mjs';
import { createLocalBusAdapter } from './local_bus_adapter.js';
import { createLocalStoragePersister } from './local_persistence.js';

import {
  EDITOR_MAILBOX_MODEL_ID as EDITOR_MODEL_ID,
  EDITOR_STATE_MODEL_ID,
  GALLERY_MAILBOX_MODEL_ID,
  SYSTEM_MODEL_ID,
} from './model_ids.js';

function ensureModel(runtime, { id, name, type }) {
  const existing = runtime.getModel(id);
  if (existing) return existing;
  return runtime.createModel({ id, name, type });
}

function ensureLabel(runtime, model, p, r, c, label) {
  const cell = runtime.getCell(model, p, r, c);
  if (cell.labels.has(label.k)) return;
  runtime.addLabel(model, p, r, c, label);
}

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
  const controlsDisabled = false;
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
              {
                id: 'pin_demo_divider',
                type: 'Text',
                props: { text: 'PIN Demo (server mode)' },
              },
              {
                id: 'pin_demo_host',
                type: 'Input',
                props: { placeholder: 'mqtt host' },
                bind: {
                  read: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'pin_demo_host' },
                  write: { action: 'label_update', target_ref: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'pin_demo_host' } },
                },
              },
              {
                id: 'pin_demo_port',
                type: 'NumberInput',
                bind: {
                  read: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'pin_demo_port' },
                  write: { action: 'label_update', target_ref: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'pin_demo_port' } },
                },
              },
              {
                id: 'pin_demo_client_id',
                type: 'Input',
                props: { placeholder: 'client_id' },
                bind: {
                  read: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'pin_demo_client_id' },
                  write: { action: 'label_update', target_ref: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'pin_demo_client_id' } },
                },
              },
              {
                id: 'pin_demo_pin',
                type: 'Input',
                props: { placeholder: 'pin name' },
                bind: {
                  read: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'pin_demo_pin' },
                  write: { action: 'label_update', target_ref: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'pin_demo_pin' } },
                },
              },
              {
                id: 'pin_demo_in_json',
                type: 'Input',
                props: { placeholder: 'IN payload (json)' },
                bind: {
                  read: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'pin_demo_in_json' },
                  write: { action: 'label_update', target_ref: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'pin_demo_in_json' } },
                },
              },
              {
                id: 'pin_demo_out_json',
                type: 'Input',
                props: { placeholder: 'OUT payload (json)' },
                bind: {
                  read: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'pin_demo_out_json' },
                  write: { action: 'label_update', target_ref: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'pin_demo_out_json' } },
                },
              },
              {
                id: 'pin_demo_set_config',
                type: 'Button',
                props: { label: 'Set MQTT config', disabled: controlsDisabled },
                bind: {
                  write: {
                    action: 'label_add',
                    target_ref: { model_id: SYSTEM_MODEL_ID, p: 0, r: 0, c: 0, k: 'run_pin_demo_set_mqtt_config' },
                    value_ref: { t: 'str', v: '1' },
                  },
                },
              },
              {
                id: 'pin_demo_start',
                type: 'Button',
                props: { label: 'Start MQTT loop', disabled: controlsDisabled },
                bind: {
                  write: {
                    action: 'label_add',
                    target_ref: { model_id: SYSTEM_MODEL_ID, p: 0, r: 0, c: 0, k: 'run_pin_demo_start_mqtt_loop' },
                    value_ref: { t: 'str', v: '1' },
                  },
                },
              },
              {
                id: 'pin_demo_declare_in',
                type: 'Button',
                props: { label: 'Declare PIN_IN', disabled: controlsDisabled },
                bind: {
                  write: {
                    action: 'label_add',
                    target_ref: { model_id: SYSTEM_MODEL_ID, p: 0, r: 0, c: 0, k: 'run_pin_demo_declare_pin_in' },
                    value_ref: { t: 'str', v: '1' },
                  },
                },
              },
              {
                id: 'pin_demo_declare_out',
                type: 'Button',
                props: { label: 'Declare PIN_OUT', disabled: controlsDisabled },
                bind: {
                  write: {
                    action: 'label_add',
                    target_ref: { model_id: SYSTEM_MODEL_ID, p: 0, r: 0, c: 0, k: 'run_pin_demo_declare_pin_out' },
                    value_ref: { t: 'str', v: '1' },
                  },
                },
              },
              {
                id: 'pin_demo_inject_in',
                type: 'Button',
                props: { label: 'Inject IN', disabled: controlsDisabled },
                bind: {
                  write: {
                    action: 'label_add',
                    target_ref: { model_id: SYSTEM_MODEL_ID, p: 0, r: 0, c: 0, k: 'run_pin_demo_inject_in' },
                    value_ref: { t: 'str', v: '1' },
                  },
                },
              },
          {
            id: 'pin_demo_send_out',
            type: 'Button',
            props: { label: 'Send OUT', disabled: controlsDisabled },
                bind: {
                  write: {
                    action: 'label_add',
                    target_ref: { model_id: SYSTEM_MODEL_ID, p: 0, r: 0, c: 0, k: 'run_pin_demo_send_out' },
                    value_ref: { t: 'str', v: '1' },
                  },
                },
              },
            ],
          },
          // Debug panels intentionally omitted from UI (Snapshot/Mailbox/Event Log).
        ],
      },
    ],
  };
}

export function buildEditorAstV1(snapshot) {
  const uiPage = String(getSnapshotLabelValue(snapshot, { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'ui_page' }) ?? '').trim().toLowerCase();
  const models = (snapshot && snapshot.models) ? snapshot.models : {};
  const modelOptions = Object.values(models)
    .map((m) => ({ id: m && typeof m.id === 'number' ? m.id : parseSafeInt(m && m.id), name: m && m.name ? String(m.name) : '' }))
    .filter((m) => Number.isInteger(m.id) && m.id !== 0)
    .sort((a, b) => a.id - b.id)
    .map((m) => ({ label: `${m.id}${m.name ? ` (${m.name})` : ''}`, value: m.id }));

  const modelQuery = String(getSnapshotLabelValue(snapshot, { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'dt_filter_model_query' }) ?? '').trim().toLowerCase();
  const modelOptionsFiltered = modelQuery
    ? modelOptions.filter((opt) => String(opt.label || '').toLowerCase().includes(modelQuery))
    : modelOptions;

  const selectedModelRaw = getSnapshotLabelValue(snapshot, { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'selected_model_id' });
  const selectedModelId = parseSafeInt(selectedModelRaw);
  const targetModel = selectedModelId === null ? null : getSnapshotModel(snapshot, selectedModelId);
  const targetExists = Boolean(targetModel);

  const tableFilterP = parseSafeInt(getSnapshotLabelValue(snapshot, { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'dt_filter_p' }));
  const tableFilterR = parseSafeInt(getSnapshotLabelValue(snapshot, { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'dt_filter_r' }));
  const tableFilterC = parseSafeInt(getSnapshotLabelValue(snapshot, { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'dt_filter_c' }));
  const tableFilterKtv = String(getSnapshotLabelValue(snapshot, { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'dt_filter_ktv' }) ?? '').trim().toLowerCase();

  const docsQuery = String(getSnapshotLabelValue(snapshot, { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'docs_query' }) ?? '').trim();
  const docsSelectedPath = String(getSnapshotLabelValue(snapshot, { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'docs_selected_path' }) ?? '').trim();
  const docsStatus = String(getSnapshotLabelValue(snapshot, { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'docs_status' }) ?? '').trim();
  const docsTree = getSnapshotLabelValue(snapshot, { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'docs_tree_json' });
  const docsResults = getSnapshotLabelValue(snapshot, { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'docs_search_results_json' });
  const docsHtml = String(getSnapshotLabelValue(snapshot, { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'docs_render_html' }) ?? '');

  const staticProjectName = String(getSnapshotLabelValue(snapshot, { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'static_project_name' }) ?? '').trim();
  const staticUploadKind = String(getSnapshotLabelValue(snapshot, { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'static_upload_kind' }) ?? 'zip').trim();
  const staticStatus = String(getSnapshotLabelValue(snapshot, { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'static_status' }) ?? '').trim();
  const staticProjects = getSnapshotLabelValue(snapshot, { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'static_projects_json' });

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

  const isMailboxModel = selectedModelId === EDITOR_MODEL_ID || selectedModelId === GALLERY_MAILBOX_MODEL_ID;
  const controlsDisabled = !targetExists || isMailboxModel;
  const labelActionsDisabled = controlsDisabled || draftK.length === 0;
  const valueTextDisabled = valueT === 'int' || valueT === 'bool';
  const valueIntDisabled = valueT !== 'int';
  const valueBoolDisabled = valueT !== 'bool';
  const pinDemoDisabled = false;

  const editOpen = Boolean(getSnapshotLabelValue(snapshot, { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'dt_edit_open' }));
  const editModelId = parseSafeInt(getSnapshotLabelValue(snapshot, { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'dt_edit_model_id' }));
  const editP = parseSafeInt(getSnapshotLabelValue(snapshot, { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'dt_edit_p' })) ?? 0;
  const editR = parseSafeInt(getSnapshotLabelValue(snapshot, { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'dt_edit_r' })) ?? 0;
  const editC = parseSafeInt(getSnapshotLabelValue(snapshot, { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'dt_edit_c' })) ?? 0;
  const editK = String(getSnapshotLabelValue(snapshot, { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'dt_edit_k' }) ?? '').trim();
  const editT = String(getSnapshotLabelValue(snapshot, { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'dt_edit_t' }) ?? 'str');
  const editText = String(getSnapshotLabelValue(snapshot, { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'dt_edit_v_text' }) ?? '');
  const editInt = getSnapshotLabelValue(snapshot, { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'dt_edit_v_int' });
  const editBool = getSnapshotLabelValue(snapshot, { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'dt_edit_v_bool' });

  const editValueT = ['str', 'int', 'bool', 'json'].includes(editT) ? editT : 'str';
  let editValueV = editText;
  if (editValueT === 'int') {
    editValueV = typeof editInt === 'number' ? editInt : (parseSafeInt(editInt) ?? 0);
  } else if (editValueT === 'bool') {
    if (editBool === true || editBool === false) editValueV = editBool;
    else if (typeof editBool === 'string') {
      const trimmed = editBool.trim();
      if (trimmed === 'true') editValueV = true;
      else if (trimmed === 'false') editValueV = false;
      else editValueV = false;
    } else {
      editValueV = false;
    }
  } else if (editValueT === 'json') {
    editValueV = editText;
  }

  if (uiPage === 'pin') {
    return {
      id: 'root_pin',
      type: 'Root',
      children: [
        {
          id: 'layout',
          type: 'Container',
          props: { layout: 'column', gap: 12 },
          children: [
            {
              id: 'card_pin_demo',
              type: 'Card',
              props: { title: 'PIN Demo' },
              children: [
                {
                  id: 'form_pin_demo',
                  type: 'Form',
                  children: [
                    {
                      id: 'fi_pin_demo_host',
                      type: 'FormItem',
                      props: { label: 'MQTT host' },
                      children: [
                        {
                          id: 'input_pin_demo_host',
                          type: 'Input',
                          bind: {
                            read: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'pin_demo_host' },
                            write: { action: 'label_update', target_ref: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'pin_demo_host' } },
                          },
                        },
                      ],
                    },
                    {
                      id: 'fi_pin_demo_port',
                      type: 'FormItem',
                      props: { label: 'MQTT port' },
                      children: [
                        {
                          id: 'num_pin_demo_port',
                          type: 'NumberInput',
                          bind: {
                            read: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'pin_demo_port' },
                            write: { action: 'label_update', target_ref: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'pin_demo_port' } },
                          },
                        },
                      ],
                    },
                    {
                      id: 'fi_pin_demo_client_id',
                      type: 'FormItem',
                      props: { label: 'client_id' },
                      children: [
                        {
                          id: 'input_pin_demo_client_id',
                          type: 'Input',
                          bind: {
                            read: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'pin_demo_client_id' },
                            write: { action: 'label_update', target_ref: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'pin_demo_client_id' } },
                          },
                        },
                      ],
                    },
                    {
                      id: 'fi_pin_demo_pin',
                      type: 'FormItem',
                      props: { label: 'pin' },
                      children: [
                        {
                          id: 'input_pin_demo_pin',
                          type: 'Input',
                          bind: {
                            read: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'pin_demo_pin' },
                            write: { action: 'label_update', target_ref: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'pin_demo_pin' } },
                          },
                        },
                      ],
                    },
                    {
                      id: 'fi_pin_demo_in_json',
                      type: 'FormItem',
                      props: { label: 'IN json' },
                      children: [
                        {
                          id: 'input_pin_demo_in_json',
                          type: 'Input',
                          bind: {
                            read: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'pin_demo_in_json' },
                            write: { action: 'label_update', target_ref: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'pin_demo_in_json' } },
                          },
                        },
                      ],
                    },
                    {
                      id: 'fi_pin_demo_out_json',
                      type: 'FormItem',
                      props: { label: 'OUT json' },
                      children: [
                        {
                          id: 'input_pin_demo_out_json',
                          type: 'Input',
                          bind: {
                            read: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'pin_demo_out_json' },
                            write: { action: 'label_update', target_ref: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'pin_demo_out_json' } },
                          },
                        },
                      ],
                    },
                    {
                      id: 'fi_pin_demo_actions',
                      type: 'FormItem',
                      props: { label: 'Actions' },
                      children: [
                        {
                          id: 'btn_pin_demo_set_cfg',
                          type: 'Button',
                          props: { label: 'Set MQTT config', disabled: pinDemoDisabled },
                          bind: {
                            write: {
                              action: 'label_add',
                              target_ref: { model_id: SYSTEM_MODEL_ID, p: 0, r: 0, c: 0, k: 'run_pin_demo_set_mqtt_config' },
                              value_ref: { t: 'str', v: '1' },
                            },
                          },
                        },
                        {
                          id: 'btn_pin_demo_start',
                          type: 'Button',
                          props: { label: 'Start MQTT loop', disabled: pinDemoDisabled },
                          bind: {
                            write: {
                              action: 'label_add',
                              target_ref: { model_id: SYSTEM_MODEL_ID, p: 0, r: 0, c: 0, k: 'run_pin_demo_start_mqtt_loop' },
                              value_ref: { t: 'str', v: '1' },
                            },
                          },
                        },
                        {
                          id: 'btn_pin_demo_declare_in',
                          type: 'Button',
                          props: { label: 'Declare PIN_IN', disabled: pinDemoDisabled },
                          bind: {
                            write: {
                              action: 'label_add',
                              target_ref: { model_id: SYSTEM_MODEL_ID, p: 0, r: 0, c: 0, k: 'run_pin_demo_declare_pin_in' },
                              value_ref: { t: 'str', v: '1' },
                            },
                          },
                        },
                        {
                          id: 'btn_pin_demo_declare_out',
                          type: 'Button',
                          props: { label: 'Declare PIN_OUT', disabled: pinDemoDisabled },
                          bind: {
                            write: {
                              action: 'label_add',
                              target_ref: { model_id: SYSTEM_MODEL_ID, p: 0, r: 0, c: 0, k: 'run_pin_demo_declare_pin_out' },
                              value_ref: { t: 'str', v: '1' },
                            },
                          },
                        },
                        {
                          id: 'btn_pin_demo_inject_in',
                          type: 'Button',
                          props: { label: 'Inject IN', disabled: pinDemoDisabled },
                          bind: {
                            write: {
                              action: 'label_add',
                              target_ref: { model_id: SYSTEM_MODEL_ID, p: 0, r: 0, c: 0, k: 'run_pin_demo_inject_in' },
                              value_ref: { t: 'str', v: '1' },
                            },
                          },
                        },
                        {
                          id: 'btn_pin_demo_send_out',
                          type: 'Button',
                          props: { label: 'Send OUT', disabled: pinDemoDisabled },
                          bind: {
                            write: {
                              action: 'label_add',
                              target_ref: { model_id: SYSTEM_MODEL_ID, p: 0, r: 0, c: 0, k: 'run_pin_demo_send_out' },
                              value_ref: { t: 'str', v: '1' },
                            },
                          },
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
  }

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

  function stringifyOneLine(value) {
    if (value === undefined) return '';
    if (value === null) return 'null';
    if (typeof value === 'string') return value;
    try {
      return JSON.stringify(value);
    } catch (_) {
      return String(value);
    }
  }

  function truncate(text, maxLen) {
    const s = typeof text === 'string' ? text : String(text);
    const n = Number.isInteger(maxLen) && maxLen > 0 ? maxLen : 120;
    if (s.length <= n) return s;
    return `${s.slice(0, Math.max(0, n - 1))}…`;
  }

  const tableRows = [];
  if (targetModel && targetModel.cells) {
    for (const [cellKey, cell] of Object.entries(targetModel.cells)) {
      const parts = String(cellKey).split(',');
      if (parts.length !== 3) continue;
      const p = parseSafeInt(parts[0]);
      const r = parseSafeInt(parts[1]);
      const c = parseSafeInt(parts[2]);
      if (!Number.isInteger(p) || !Number.isInteger(r) || !Number.isInteger(c)) continue;
      if (tableFilterP !== null && p !== tableFilterP) continue;
      if (tableFilterR !== null && r !== tableFilterR) continue;
      if (tableFilterC !== null && c !== tableFilterC) continue;
      const labels = cell && cell.labels ? cell.labels : {};
      for (const [k, lv] of Object.entries(labels)) {
        const t = lv && lv.t ? String(lv.t) : '';
        const vRaw = lv && Object.prototype.hasOwnProperty.call(lv, 'v') ? lv.v : undefined;
        const vText = stringifyOneLine(vRaw);

        if (tableFilterKtv) {
          const hay = `${String(k).toLowerCase()}|${t.toLowerCase()}|${String(vText).toLowerCase()}`;
          if (!hay.includes(tableFilterKtv)) continue;
        }

        const modelIdEditable = Number.isInteger(selectedModelId) && selectedModelId !== 0;
        tableRows.push({
          row_id: `${selectedModelId ?? ''}:${p},${r},${c}:${k}`,
          model_id: selectedModelId ?? 0,
          model_id_is_editable: !modelIdEditable,
          p,
          r,
          c,
          k: String(k),
          t,
          v_preview: truncate(vText, 120),
        });
      }
    }
    tableRows.sort((a, b) => {
      if (a.p !== b.p) return a.p - b.p;
      if (a.r !== b.r) return a.r - b.r;
      if (a.c !== b.c) return a.c - b.c;
      return a.k.localeCompare(b.k);
    });
  }

  const missingModelText = selectedModelId !== null && !targetExists
    ? `Selected model ${selectedModelId} missing. Create it first.`
    : '';

  if (uiPage === 'home') {
    return {
      id: 'root_home',
      type: 'Root',
      children: [
        {
          id: 'layout',
          type: 'Container',
          props: { layout: 'column', gap: 12 },
          children: [
            {
              id: 'card_home_filters',
              type: 'Card',
              props: { title: 'DataTable' },
              children: [
                {
                  id: 'form_home_filters',
                  type: 'Form',
                  children: [
                    {
                      id: 'fi_home_model',
                      type: 'FormItem',
                      props: { label: 'Model' },
                      children: [
                        {
                          id: 'row_home_model',
                          type: 'Container',
                          props: { layout: 'row', wrap: true, size: 8, style: { alignItems: 'center' } },
                          children: [
                            {
                              id: 'input_home_model_query',
                              type: 'Input',
                              props: { placeholder: 'id or name contains...', style: { width: '220px' } },
                              bind: {
                                read: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'dt_filter_model_query' },
                                write: { action: 'label_update', target_ref: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'dt_filter_model_query' } },
                              },
                            },
                            {
                              id: 'sel_home_target_model',
                              type: 'Select',
                              props: { options: modelOptionsFiltered, placeholder: 'Select model', style: { width: '260px' } },
                              bind: {
                                read: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'selected_model_id' },
                                write: { action: 'label_update', target_ref: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'selected_model_id' } },
                              },
                            },
                            {
                              id: 'btn_home_refresh',
                              type: 'Button',
                              props: { label: 'Refresh', disabled: false },
                              bind: {
                                write: {
                                  action: 'datatable_refresh',
                                  target_ref: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'dt_filter_model_query' },
                                },
                              },
                            },
                          ],
                        },
                      ],
                    },
                    {
                      id: 'fi_home_filters',
                      type: 'FormItem',
                      props: { label: 'Filter' },
                      children: [
                        {
                          id: 'row_home_filters',
                          type: 'Container',
                          props: { layout: 'row', wrap: true, size: 8, style: { alignItems: 'center' } },
                          children: [
                            {
                              id: 'input_home_p',
                              type: 'Input',
                              props: { placeholder: 'p', style: { width: '90px' } },
                              bind: {
                                read: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'dt_filter_p' },
                                write: { action: 'label_update', target_ref: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'dt_filter_p' } },
                              },
                            },
                            {
                              id: 'input_home_r',
                              type: 'Input',
                              props: { placeholder: 'r', style: { width: '90px' } },
                              bind: {
                                read: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'dt_filter_r' },
                                write: { action: 'label_update', target_ref: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'dt_filter_r' } },
                              },
                            },
                            {
                              id: 'input_home_c',
                              type: 'Input',
                              props: { placeholder: 'c', style: { width: '90px' } },
                              bind: {
                                read: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'dt_filter_c' },
                                write: { action: 'label_update', target_ref: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'dt_filter_c' } },
                              },
                            },
                            {
                              id: 'input_home_ktv',
                              type: 'Input',
                              props: { placeholder: 'k|t|v substring...', style: { width: '260px' } },
                              bind: {
                                read: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'dt_filter_ktv' },
                                write: { action: 'label_update', target_ref: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'dt_filter_ktv' } },
                              },
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
            missingModelText
              ? { id: 'txt_home_missing_model', type: 'Text', props: { type: 'danger', text: missingModelText } }
              : null,
            {
              id: 'card_home_table',
              type: 'Card',
              props: { title: 'Rows' },
              children: [
                {
                  id: 'tbl_home_cells',
                  type: 'Table',
                  props: { data: tableRows, border: true, stripe: true, size: 'small', height: 520, rowKey: 'row_id' },
                  children: [
                    { id: 'col_home_p', type: 'TableColumn', props: { label: 'p', prop: 'p', width: 70 } },
                    { id: 'col_home_r', type: 'TableColumn', props: { label: 'r', prop: 'r', width: 70 } },
                    { id: 'col_home_c', type: 'TableColumn', props: { label: 'c', prop: 'c', width: 70 } },
                    { id: 'col_home_k', type: 'TableColumn', props: { label: 'k', prop: 'k', minWidth: 180 } },
                    { id: 'col_home_t', type: 'TableColumn', props: { label: 't', prop: 't', width: 90 } },
                    { id: 'col_home_v', type: 'TableColumn', props: { label: 'v', prop: 'v_preview', minWidth: 360 } },
                    {
                      id: 'col_home_actions',
                      type: 'TableColumn',
                      props: { label: 'Actions', width: 260, fixed: 'right' },
                      children: [
                        {
                          id: 'btn_home_use_row',
                          type: 'Button',
                          props: { label: 'Use', type: 'primary', link: true },
                          bind: {
                            write: {
                              action: 'datatable_select_row',
                              target_ref: {
                                model_id: { $ref: 'row.model_id' },
                                p: { $ref: 'row.p' },
                                r: { $ref: 'row.r' },
                                c: { $ref: 'row.c' },
                                k: { $ref: 'row.k' },
                              },
                            },
                          },
                        },
                        {
                          id: 'btn_home_edit_row',
                          type: 'Button',
                          props: {
                            label: 'Edit',
                            type: 'primary',
                            link: true,
                            disabled: { $ref: 'row.model_id_is_editable' },
                          },
                          bind: {
                            write: {
                              action: 'datatable_edit_row',
                              target_ref: {
                                model_id: { $ref: 'row.model_id' },
                                p: { $ref: 'row.p' },
                                r: { $ref: 'row.r' },
                                c: { $ref: 'row.c' },
                                k: { $ref: 'row.k' },
                              },
                            },
                          },
                        },
                        {
                          id: 'btn_home_view_row',
                          type: 'Button',
                          props: { label: 'View', type: 'primary', link: true },
                          bind: {
                            write: {
                              action: 'datatable_view_detail',
                              target_ref: {
                                model_id: { $ref: 'row.model_id' },
                                p: { $ref: 'row.p' },
                                r: { $ref: 'row.r' },
                                c: { $ref: 'row.c' },
                                k: { $ref: 'row.k' },
                              },
                            },
                          },
                        },
                        {
                          id: 'btn_home_rm_row',
                          type: 'Button',
                          props: {
                            label: 'Remove',
                            type: 'danger',
                            link: true,
                            disabled: { $ref: 'row.model_id_is_editable' },
                          },
                          bind: {
                            write: {
                              action: 'datatable_remove_label',
                              target_ref: {
                                model_id: { $ref: 'row.model_id' },
                                p: { $ref: 'row.p' },
                                r: { $ref: 'row.r' },
                                c: { $ref: 'row.c' },
                                k: { $ref: 'row.k' },
                              },
                            },
                          },
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ].filter(Boolean),
        },

        // Reuse existing detail drawer + edit dialog for row actions.
        {
          id: 'drawer_detail',
          type: 'Drawer',
          props: { title: { $ref: 'dt_detail_title' }, size: '40%' },
          bind: {
            read: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'dt_detail_open' },
            write: { action: 'label_update', target_ref: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'dt_detail_open' } },
          },
          children: [
            {
              id: 'txt_detail',
              type: 'Text',
              props: { text: { $ref: 'dt_detail_text' }, style: { whiteSpace: 'pre-wrap', wordBreak: 'break-word' } },
            },
          ],
        },
        {
          id: 'dialog_edit',
          type: 'Dialog',
          props: { title: 'Edit label', width: '680px' },
          bind: {
            read: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'dt_edit_open' },
            write: { action: 'label_update', target_ref: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'dt_edit_open' } },
          },
          children: [
            {
              id: 'txt_edit_target',
              type: 'Text',
              props: { type: 'info', text: `target: ${editModelId ?? ''} (${editP},${editR},${editC}) ${editK}` },
            },
            {
              id: 'form_edit',
              type: 'Form',
              children: [
                {
                  id: 'fi_edit_t',
                  type: 'FormItem',
                  props: { label: 'Type (t)' },
                  children: [
                    {
                      id: 'sel_edit_t',
                      type: 'Select',
                      props: {
                        options: [
                          { label: 'str', value: 'str' },
                          { label: 'int', value: 'int' },
                          { label: 'bool', value: 'bool' },
                          { label: 'json', value: 'json' },
                        ],
                      },
                      bind: {
                        read: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'dt_edit_t' },
                        write: { action: 'label_update', target_ref: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'dt_edit_t' } },
                      },
                    },
                  ],
                },
                {
                  id: 'fi_edit_v',
                  type: 'FormItem',
                  props: { label: 'Value (v)' },
                  children: [
                    {
                      id: 'input_edit_v_text',
                      type: 'Input',
                      props: { disabled: editValueT === 'int' || editValueT === 'bool' },
                      bind: {
                        read: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'dt_edit_v_text' },
                        write: { action: 'label_update', target_ref: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'dt_edit_v_text' } },
                      },
                    },
                    {
                      id: 'num_edit_v_int',
                      type: 'NumberInput',
                      props: { disabled: editValueT !== 'int' },
                      bind: {
                        read: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'dt_edit_v_int' },
                        write: { action: 'label_update', target_ref: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'dt_edit_v_int' } },
                      },
                    },
                    {
                      id: 'switch_edit_v_bool',
                      type: 'Switch',
                      props: { disabled: editValueT !== 'bool' },
                      bind: {
                        read: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'dt_edit_v_bool' },
                        write: { action: 'label_update', target_ref: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'dt_edit_v_bool' } },
                      },
                    },
                  ],
                },
              ],
            },
            {
              id: 'btn_edit_save',
              type: 'Button',
              props: { type: 'primary', label: 'Save', disabled: editModelId === null || editK.length === 0 },
              bind: {
                write: {
                  action: 'label_update',
                  target_ref: { model_id: editModelId ?? 1, p: editP, r: editR, c: editC, k: editK || 'title' },
                  value_ref: { t: editValueT, v: editValueV },
                },
              },
            },
          ],
        },
      ],
    };
  }

  if (uiPage === 'docs') {
    const treeData = Array.isArray(docsTree) ? docsTree : [];
    const resultRows = Array.isArray(docsResults) ? docsResults : [];
    const docsEmptyHint = (treeData.length === 0 && !docsStatus)
      ? 'Docs index is empty. If you are running Vite dev (mode=local), switch to remote: ?mode=remote&server=http://127.0.0.1:9000'
      : '';
    return {
      id: 'root_docs',
      type: 'Root',
      children: [
        {
          id: 'layout',
          type: 'Container',
          props: { layout: 'row', gap: 12, style: { alignItems: 'flex-start' } },
          children: [
            {
              id: 'card_docs_left',
              type: 'Card',
              props: { title: 'Docs' },
              children: [
                {
                  id: 'form_docs_controls',
                  type: 'Form',
                  children: [
                    {
                      id: 'fi_docs_query',
                      type: 'FormItem',
                      props: { label: 'Search' },
                      children: [
                        {
                          id: 'input_docs_query',
                          type: 'Input',
                          props: { placeholder: 'name | content substring...' },
                          bind: {
                            read: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'docs_query' },
                            write: { action: 'label_update', target_ref: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'docs_query' } },
                          },
                        },
                        {
                          id: 'btn_docs_search',
                          type: 'Button',
                          props: { type: 'primary', label: 'Search', disabled: docsQuery.length === 0 },
                          bind: {
                            write: {
                              action: 'docs_search',
                              target_ref: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'docs_query' },
                            },
                          },
                        },
                        {
                          id: 'btn_docs_refresh',
                          type: 'Button',
                          props: { label: 'Refresh index' },
                          bind: {
                            write: {
                              action: 'docs_refresh_tree',
                              target_ref: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'docs_tree_json' },
                            },
                          },
                        },
                      ],
                    },
                    {
                      id: 'fi_docs_selected',
                      type: 'FormItem',
                      props: { label: 'Selected' },
                      children: [
                        { id: 'txt_docs_selected', type: 'Text', props: { type: 'info', text: docsSelectedPath || '(none)' } },
                        {
                          id: 'btn_docs_open',
                          type: 'Button',
                          props: { type: 'primary', label: 'Open', disabled: docsSelectedPath.length === 0 },
                          bind: {
                            write: {
                              action: 'docs_open_doc',
                              target_ref: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'docs_selected_path' },
                            },
                          },
                        },
                      ],
                    },
                    {
                      id: 'fi_docs_tree',
                      type: 'FormItem',
                      props: { label: 'Index' },
                      children: [
                        {
                          id: 'tree_docs',
                          type: 'Tree',
                          props: {
                            data: treeData,
                            nodeKey: 'path',
                            props: { label: 'label', children: 'children' },
                            highlightCurrent: true,
                            defaultExpandAll: true,
                            expandOnClickNode: true,
                            emptyText: '(empty)',
                            style: { width: '360px', maxHeight: '520px', overflow: 'auto' },
                          },
                          bind: {
                            change: {
                              action: 'label_update',
                              target_ref: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'docs_selected_path' },
                            },
                          },
                        },
                      ],
                    },
                    docsEmptyHint
                      ? { id: 'txt_docs_empty_hint', type: 'Text', props: { type: 'warning', text: docsEmptyHint } }
                      : null,
                    {
                      id: 'fi_docs_results',
                      type: 'FormItem',
                      props: { label: 'Results' },
                      children: [
                        {
                          id: 'tbl_docs_results',
                          type: 'Table',
                          props: { data: resultRows, border: true, stripe: true, size: 'small', height: 240, rowKey: 'path' },
                          children: [
                            { id: 'col_docs_path', type: 'TableColumn', props: { label: 'path', prop: 'path', minWidth: 220 } },
                            { id: 'col_docs_hit', type: 'TableColumn', props: { label: 'hit', prop: 'hit', minWidth: 140 } },
                            { id: 'col_docs_snip', type: 'TableColumn', props: { label: 'snippet', prop: 'snippet', minWidth: 240 } },
                            {
                              id: 'col_docs_actions',
                              type: 'TableColumn',
                              props: { label: 'Actions', width: 120, fixed: 'right' },
                              children: [
                                {
                                  id: 'btn_docs_use_row',
                                  type: 'Button',
                                  props: { label: 'Use', type: 'primary', link: true },
                                  bind: {
                                    write: {
                                      action: 'label_update',
                                      target_ref: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'docs_selected_path' },
                                      value_ref: { t: 'str', v: { $ref: 'row.path' } },
                                    },
                                  },
                                },
                              ],
                            },
                          ],
                        },
                      ],
                    },
                    docsStatus
                      ? { id: 'txt_docs_status', type: 'Text', props: { type: 'info', text: docsStatus } }
                      : null,
                  ].filter(Boolean),
                },
              ],
            },
            {
              id: 'card_docs_right',
              type: 'Card',
              props: { title: 'Content' },
              children: [
                {
                  id: 'html_docs',
                  type: 'Html',
                  props: {
                    html: docsHtml,
                    style: { maxWidth: '800px' },
                  },
                },
              ],
            },
          ],
        },
      ],
    };
  }

  if (uiPage === 'static') {
    const projects = Array.isArray(staticProjects) ? staticProjects : [];
    const staticEmptyHint = (projects.length === 0 && !staticStatus)
      ? 'No projects listed. If you are running Vite dev (mode=local), switch to remote: ?mode=remote&server=http://127.0.0.1:9000'
      : '';
    return {
      id: 'root_static',
      type: 'Root',
      children: [
        {
          id: 'layout',
          type: 'Container',
          props: { layout: 'column', gap: 12 },
          children: [
            {
              id: 'card_static_upload',
              type: 'Card',
              props: { title: 'Static Projects' },
              children: [
                {
                  id: 'form_static',
                  type: 'Form',
                  children: [
                    {
                      id: 'fi_static_name',
                      type: 'FormItem',
                      props: { label: 'Project name' },
                      children: [
                        {
                          id: 'input_static_name',
                          type: 'Input',
                          props: { placeholder: 'e.g. my-site' },
                          bind: {
                            read: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'static_project_name' },
                            write: { action: 'label_update', target_ref: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'static_project_name' } },
                          },
                        },
                      ],
                    },
                    {
                      id: 'fi_static_kind',
                      type: 'FormItem',
                      props: { label: 'Upload kind' },
                      children: [
                        {
                          id: 'rg_static_kind',
                          type: 'RadioGroup',
                          props: {
                            options: [
                              { label: 'Zip (folder project)', value: 'zip' },
                              { label: 'Single HTML', value: 'html' },
                            ],
                          },
                          bind: {
                            read: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'static_upload_kind' },
                            write: { action: 'label_update', target_ref: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'static_upload_kind' } },
                          },
                        },
                      ],
                    },
                    {
                      id: 'fi_static_zip',
                      type: 'FormItem',
                      props: { label: 'Upload' },
                      children: [
                        staticUploadKind === 'html'
                          ? {
                            id: 'file_static_html',
                            type: 'FileInput',
                            props: { accept: '.html,.htm', label: 'Select a single .html file (saved as index.html)' },
                            bind: {
                              write: {
                                action: 'label_update',
                                target_ref: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'static_html_b64' },
                              },
                            },
                          }
                          : {
                            id: 'file_static_zip',
                            type: 'FileInput',
                            props: { accept: '.zip', label: 'Zip your folder (must include index.html at root)' },
                            bind: {
                              write: {
                                action: 'label_update',
                                target_ref: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'static_zip_b64' },
                              },
                            },
                          },
                      ],
                    },
                    {
                      id: 'fi_static_actions',
                      type: 'FormItem',
                      props: { label: 'Actions' },
                      children: [
                        {
                          id: 'btn_static_upload',
                          type: 'Button',
                          props: { type: 'primary', label: 'Upload', disabled: staticProjectName.length === 0 },
                          bind: {
                            write: {
                              action: 'static_project_upload',
                              target_ref: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'static_zip_b64' },
                            },
                          },
                        },
                        {
                          id: 'btn_static_refresh',
                          type: 'Button',
                          props: { label: 'Refresh list' },
                          bind: {
                            write: {
                              action: 'static_project_list',
                              target_ref: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'static_projects_json' },
                            },
                          },
                        },
                      ],
                    },
                    staticStatus
                      ? { id: 'txt_static_status', type: 'Text', props: { type: 'info', text: staticStatus } }
                      : null,
                    staticEmptyHint
                      ? { id: 'txt_static_empty_hint', type: 'Text', props: { type: 'warning', text: staticEmptyHint } }
                      : null,
                  ].filter(Boolean),
                },
              ],
            },
            {
              id: 'card_static_list',
              type: 'Card',
              props: { title: 'Projects' },
              children: [
                {
                  id: 'tbl_static_projects',
                  type: 'Table',
                  props: { data: projects, border: true, stripe: true, size: 'small', height: 520, rowKey: 'name' },
                  children: [
                    { id: 'col_static_name', type: 'TableColumn', props: { label: 'name', prop: 'name', minWidth: 180 } },
                    {
                      id: 'col_static_url',
                      type: 'TableColumn',
                      props: { label: 'url', minWidth: 320 },
                      children: [
                        {
                          id: 'link_static_url',
                          type: 'Link',
                          props: {
                            href: { $ref: 'row.url' },
                            text: { $ref: 'row.url' },
                            target: '_blank',
                          },
                        },
                      ],
                    },
                    { id: 'col_static_updated', type: 'TableColumn', props: { label: 'updated', prop: 'updated_at', minWidth: 180 } },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
  }

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
        id: 'fi_model_query',
        type: 'FormItem',
        props: { label: 'Model query' },
        children: [
          {
            id: 'input_model_query',
            type: 'Input',
            props: { placeholder: 'id or name contains...' },
            bind: {
              read: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'dt_filter_model_query' },
              write: { action: 'label_update', target_ref: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'dt_filter_model_query' } },
            },
          },
        ],
      },
      {
        id: 'fi_model',
        type: 'FormItem',
        props: { label: 'Target model' },
        children: [
          {
            id: 'sel_target_model',
            type: 'Select',
            props: { options: modelOptionsFiltered, placeholder: 'Select model' },
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
        id: 'fi_dt_filters',
        type: 'FormItem',
        props: { label: 'Table filter (p,r,c)' },
        children: [
          {
            id: 'input_dt_p',
            type: 'Input',
            props: { placeholder: 'p (empty=all)' },
            bind: {
              read: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'dt_filter_p' },
              write: { action: 'label_update', target_ref: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'dt_filter_p' } },
            },
          },
          {
            id: 'input_dt_r',
            type: 'Input',
            props: { placeholder: 'r (empty=all)' },
            bind: {
              read: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'dt_filter_r' },
              write: { action: 'label_update', target_ref: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'dt_filter_r' } },
            },
          },
          {
            id: 'input_dt_c',
            type: 'Input',
            props: { placeholder: 'c (empty=all)' },
            bind: {
              read: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'dt_filter_c' },
              write: { action: 'label_update', target_ref: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'dt_filter_c' } },
            },
          },
        ],
      },
      {
        id: 'fi_dt_refresh',
        type: 'FormItem',
        props: { label: 'Refresh' },
        children: [
          {
            id: 'btn_dt_refresh',
            type: 'Button',
            props: { label: 'Refresh table', disabled: false },
            bind: {
              write: {
                action: 'datatable_refresh',
                // unused; required by envelope shape
                target_ref: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'dt_filter_model_query' },
              },
            },
          },
          {
            id: 'sw_pause_sse',
            type: 'Switch',
            props: { activeText: 'Pause SSE', inactiveText: 'Live SSE' },
            bind: {
              read: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'dt_pause_sse' },
              write: { action: 'label_update', target_ref: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'dt_pause_sse' } },
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
                  {
                    id: 'fi_cellab',
                    type: 'FormItem',
                    props: { label: 'CellA/CellB' },
                    children: [
                      {
                        id: 'input_cellab_payload',
                        type: 'Input',
                        props: { placeholder: 'A payload (json string)' },
                        bind: {
                          read: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'cellab_payload_json' },
                          write: { action: 'label_update', target_ref: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'cellab_payload_json' } },
                        },
                      },
                      {
                        id: 'btn_add_cellA',
                        type: 'Button',
                        props: { label: 'ADD_CellA', disabled: false },
                        bind: {
                          write: {
                            action: 'cellab_add_cellA',
                            // unused by server handler; required by renderer envelope shape
                            target_ref: { model_id: 1, p: 1, r: 1, c: 1, k: 'intent.v0' },
                          },
                        },
                      },
                      {
                        id: 'btn_add_cellB',
                        type: 'Button',
                        props: { label: 'ADD_CellB', disabled: false },
                        bind: {
                          write: {
                            action: 'cellab_add_cellB',
                            // unused by server handler; required by renderer envelope shape
                            target_ref: { model_id: 1, p: 3, r: 3, c: 3, k: 'intent.v0' },
                          },
                        },
                      },
                    ],
                  },
                  {
                    id: 'fi_pin_demo',
                    type: 'FormItem',
                    props: { label: 'PIN Demo (server mode)' },
                    children: [
                      {
                        id: 'pin_demo_host',
                        type: 'Input',
                        props: { placeholder: 'mqtt host' },
                        bind: {
                          read: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'pin_demo_host' },
                          write: { action: 'label_update', target_ref: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'pin_demo_host' } },
                        },
                      },
                      {
                        id: 'pin_demo_port',
                        type: 'NumberInput',
                        bind: {
                          read: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'pin_demo_port' },
                          write: { action: 'label_update', target_ref: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'pin_demo_port' } },
                        },
                      },
                      {
                        id: 'pin_demo_client_id',
                        type: 'Input',
                        props: { placeholder: 'client_id' },
                        bind: {
                          read: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'pin_demo_client_id' },
                          write: { action: 'label_update', target_ref: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'pin_demo_client_id' } },
                        },
                      },
                      {
                        id: 'pin_demo_pin',
                        type: 'Input',
                        props: { placeholder: 'pin name' },
                        bind: {
                          read: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'pin_demo_pin' },
                          write: { action: 'label_update', target_ref: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'pin_demo_pin' } },
                        },
                      },
                      {
                        id: 'pin_demo_in_json',
                        type: 'Input',
                        props: { placeholder: 'IN payload (json)' },
                        bind: {
                          read: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'pin_demo_in_json' },
                          write: { action: 'label_update', target_ref: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'pin_demo_in_json' } },
                        },
                      },
                      {
                        id: 'pin_demo_out_json',
                        type: 'Input',
                        props: { placeholder: 'OUT payload (json)' },
                        bind: {
                          read: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'pin_demo_out_json' },
                          write: { action: 'label_update', target_ref: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'pin_demo_out_json' } },
                        },
                      },
                      {
                        id: 'pin_demo_set_config',
                        type: 'Button',
                        props: { label: 'Set MQTT config', disabled: pinDemoDisabled },
                bind: {
                  write: {
                    action: 'label_add',
                    target_ref: { model_id: SYSTEM_MODEL_ID, p: 0, r: 0, c: 0, k: 'run_pin_demo_set_mqtt_config' },
                    value_ref: { t: 'str', v: '1' },
                  },
                },
              },
                      {
                        id: 'pin_demo_start',
                        type: 'Button',
                        props: { label: 'Start MQTT loop', disabled: pinDemoDisabled },
                bind: {
                  write: {
                    action: 'label_add',
                    target_ref: { model_id: SYSTEM_MODEL_ID, p: 0, r: 0, c: 0, k: 'run_pin_demo_start_mqtt_loop' },
                    value_ref: { t: 'str', v: '1' },
                  },
                },
              },
                      {
                        id: 'pin_demo_declare_in',
                        type: 'Button',
                        props: { label: 'Declare PIN_IN', disabled: pinDemoDisabled },
                bind: {
                  write: {
                    action: 'label_add',
                    target_ref: { model_id: SYSTEM_MODEL_ID, p: 0, r: 0, c: 0, k: 'run_pin_demo_declare_pin_in' },
                    value_ref: { t: 'str', v: '1' },
                  },
                },
              },
                      {
                        id: 'pin_demo_declare_out',
                        type: 'Button',
                        props: { label: 'Declare PIN_OUT', disabled: pinDemoDisabled },
                bind: {
                  write: {
                    action: 'label_add',
                    target_ref: { model_id: SYSTEM_MODEL_ID, p: 0, r: 0, c: 0, k: 'run_pin_demo_declare_pin_out' },
                    value_ref: { t: 'str', v: '1' },
                  },
                },
              },
                      {
                        id: 'pin_demo_inject_in',
                        type: 'Button',
                        props: { label: 'Inject IN', disabled: pinDemoDisabled },
                bind: {
                  write: {
                    action: 'label_add',
                    target_ref: { model_id: SYSTEM_MODEL_ID, p: 0, r: 0, c: 0, k: 'run_pin_demo_inject_in' },
                    value_ref: { t: 'str', v: '1' },
                  },
                },
              },
                      {
                        id: 'pin_demo_send_out',
                        type: 'Button',
                        props: { label: 'Send OUT', disabled: pinDemoDisabled },
                bind: {
                  write: {
                    action: 'label_add',
                    target_ref: { model_id: SYSTEM_MODEL_ID, p: 0, r: 0, c: 0, k: 'run_pin_demo_send_out' },
                    value_ref: { t: 'str', v: '1' },
                  },
                },
              },
                    ],
                  },
                ],
              },
          // Debug panels intentionally omitted from UI (Snapshot/Mailbox/Event Log).
        ],
      },
      {
        id: 'card_datatable',
        type: 'Card',
        props: { title: 'DataTable (selected model)' },
        children: [
          {
            id: 'tbl_cells',
            type: 'Table',
            props: { data: tableRows, border: true, stripe: true, size: 'small', height: 420, rowKey: 'row_id' },
            children: [
              { id: 'col_p', type: 'TableColumn', props: { label: 'p', prop: 'p', width: 70 } },
              { id: 'col_r', type: 'TableColumn', props: { label: 'r', prop: 'r', width: 70 } },
              { id: 'col_c', type: 'TableColumn', props: { label: 'c', prop: 'c', width: 70 } },
              { id: 'col_k', type: 'TableColumn', props: { label: 'k', prop: 'k', minWidth: 160 } },
              { id: 'col_t', type: 'TableColumn', props: { label: 't', prop: 't', width: 90 } },
              {
                id: 'col_v',
                type: 'TableColumn',
                props: { label: 'v', minWidth: 320 },
                children: [
                  {
                    id: 'v_preview',
                    type: 'Text',
                    props: {
                      text: { $ref: 'row.v_preview' },
                      style: {
                        display: 'inline-block',
                        maxWidth: '360px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        verticalAlign: 'middle',
                      },
                    },
                  },
                ],
              },
              {
                id: 'col_actions',
                type: 'TableColumn',
                props: { label: 'Actions', width: 220, fixed: 'right' },
                children: [
                  {
                    id: 'btn_use_row',
                    type: 'Button',
                    props: { label: 'Use', type: 'primary', link: true },
                    bind: {
                      write: {
                        action: 'datatable_select_row',
                        target_ref: {
                          model_id: { $ref: 'row.model_id' },
                          p: { $ref: 'row.p' },
                          r: { $ref: 'row.r' },
                          c: { $ref: 'row.c' },
                          k: { $ref: 'row.k' },
                        },
                      },
                    },
                  },
                  {
                    id: 'btn_edit_row',
                    type: 'Button',
                    props: { label: 'Edit', type: 'primary', link: true },
                    bind: {
                      write: {
                        action: 'datatable_edit_row',
                        target_ref: {
                          model_id: { $ref: 'row.model_id' },
                          p: { $ref: 'row.p' },
                          r: { $ref: 'row.r' },
                          c: { $ref: 'row.c' },
                          k: { $ref: 'row.k' },
                        },
                      },
                    },
                  },
                  {
                    id: 'btn_view_row',
                    type: 'Button',
                    props: { label: 'View', type: 'primary', link: true },
                    bind: {
                      write: {
                        action: 'datatable_view_detail',
                        target_ref: {
                          model_id: { $ref: 'row.model_id' },
                          p: { $ref: 'row.p' },
                          r: { $ref: 'row.r' },
                          c: { $ref: 'row.c' },
                          k: { $ref: 'row.k' },
                        },
                      },
                    },
                  },
                  {
                    id: 'btn_rm_row',
                    type: 'Button',
                    props: { label: 'Remove', type: 'danger', link: true },
                    bind: {
                      write: {
                        action: 'datatable_remove_label',
                        target_ref: {
                          model_id: { $ref: 'row.model_id' },
                          p: { $ref: 'row.p' },
                          r: { $ref: 'row.r' },
                          c: { $ref: 'row.c' },
                          k: { $ref: 'row.k' },
                        },
                      },
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'drawer_detail',
        type: 'Drawer',
        props: { title: 'Value details', size: '60%' },
        bind: {
          read: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'dt_detail_open' },
          write: { action: 'label_update', target_ref: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'dt_detail_open' } },
        },
        children: [
          { id: 'detail_title', type: 'Text', bind: { read: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'dt_detail_title' } } },
          {
            id: 'detail_body',
            type: 'CodeBlock',
            props: { style: { whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 } },
            bind: { read: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'dt_detail_text' } },
          },
        ],
      },

      {
        id: 'dialog_edit',
        type: 'Dialog',
        props: { title: 'Edit label', width: '680px' },
        bind: {
          read: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'dt_edit_open' },
          write: { action: 'label_update', target_ref: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'dt_edit_open' } },
        },
        children: [
          {
            id: 'txt_edit_target',
            type: 'Text',
            props: { type: 'info', text: `target: ${editModelId ?? ''} (${editP},${editR},${editC}) ${editK}` },
          },
          {
            id: 'form_edit',
            type: 'Form',
            children: [
              {
                id: 'fi_edit_t',
                type: 'FormItem',
                props: { label: 'Type (t)' },
                children: [
                  {
                    id: 'sel_edit_t',
                    type: 'Select',
                    props: {
                      options: [
                        { label: 'str', value: 'str' },
                        { label: 'int', value: 'int' },
                        { label: 'bool', value: 'bool' },
                        { label: 'json', value: 'json' },
                      ],
                    },
                    bind: {
                      read: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'dt_edit_t' },
                      write: { action: 'label_update', target_ref: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'dt_edit_t' } },
                    },
                  },
                ],
              },
              {
                id: 'fi_edit_v',
                type: 'FormItem',
                props: { label: 'Value (v)' },
                children: [
                  {
                    id: 'input_edit_v_text',
                    type: 'Input',
                    props: { disabled: editValueT === 'int' || editValueT === 'bool' },
                    bind: {
                      read: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'dt_edit_v_text' },
                      write: { action: 'label_update', target_ref: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'dt_edit_v_text' } },
                    },
                  },
                  {
                    id: 'num_edit_v_int',
                    type: 'NumberInput',
                    props: { disabled: editValueT !== 'int' },
                    bind: {
                      read: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'dt_edit_v_int' },
                      write: { action: 'label_update', target_ref: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'dt_edit_v_int' } },
                    },
                  },
                  {
                    id: 'switch_edit_v_bool',
                    type: 'Switch',
                    props: { disabled: editValueT !== 'bool' },
                    bind: {
                      read: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'dt_edit_v_bool' },
                      write: { action: 'label_update', target_ref: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'dt_edit_v_bool' } },
                    },
                  },
                ],
              },
            ],
          },
          {
            id: 'btn_edit_save',
            type: 'Button',
            props: { type: 'primary', label: 'Save', disabled: editModelId === null || editK.length === 0 },
            bind: {
              write: {
                action: 'label_update',
                target_ref: { model_id: editModelId ?? 1, p: editP, r: editR, c: editC, k: editK || 'title' },
                value_ref: { t: editValueT, v: editValueV },
              },
            },
          },
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
  const options = arguments.length > 0 ? arguments[0] : undefined;
  const runtime = options && options.runtime ? options.runtime : new ModelTableRuntime();
  const uiMode = arguments.length > 0 && arguments[0] && arguments[0].uiMode ? arguments[0].uiMode : 'v1';
  const adapterMode = arguments.length > 0 && arguments[0] && arguments[0].adapterMode ? arguments[0].adapterMode : 'v1';

  if (options && options.persist && !options.runtime && typeof window !== 'undefined' && window.localStorage) {
    const persister = createLocalStoragePersister({
      storageKey: options.storageKey || 'dy_modeltable_local_v1',
      ignoreModelIds: new Set([EDITOR_MODEL_ID, GALLERY_MAILBOX_MODEL_ID]),
    });
    runtime.setPersistence(persister);
    persister.loadIntoRuntime(runtime);
  }

  ensureModel(runtime, { id: EDITOR_MODEL_ID, name: 'editor_mailbox', type: 'ui' });
  const stateModel = ensureModel(runtime, { id: EDITOR_STATE_MODEL_ID, name: 'editor_state', type: 'ui' });
  ensureModel(runtime, { id: SYSTEM_MODEL_ID, name: 'system', type: 'system' });
  ensureModel(runtime, { id: 1, name: 'M1', type: 'main' });

  ensureLabel(runtime, stateModel, 0, 0, 0, { k: 'selected_model_id', t: 'str', v: '1' });
  ensureLabel(runtime, stateModel, 0, 0, 0, { k: 'ui_page', t: 'str', v: 'home' });
  ensureLabel(runtime, stateModel, 0, 0, 0, { k: 'draft_p', t: 'str', v: '0' });
  ensureLabel(runtime, stateModel, 0, 0, 0, { k: 'draft_r', t: 'str', v: '0' });
  ensureLabel(runtime, stateModel, 0, 0, 0, { k: 'draft_c', t: 'str', v: '0' });
  ensureLabel(runtime, stateModel, 0, 0, 0, { k: 'draft_k', t: 'str', v: 'title' });
  ensureLabel(runtime, stateModel, 0, 0, 0, { k: 'draft_t', t: 'str', v: 'str' });
  ensureLabel(runtime, stateModel, 0, 0, 0, { k: 'draft_v_text', t: 'str', v: 'Hello' });
  ensureLabel(runtime, stateModel, 0, 0, 0, { k: 'draft_v_int', t: 'int', v: 0 });
  ensureLabel(runtime, stateModel, 0, 0, 0, { k: 'draft_v_bool', t: 'bool', v: false });

  ensureLabel(runtime, stateModel, 0, 0, 0, { k: 'dt_filter_model_query', t: 'str', v: '' });
  ensureLabel(runtime, stateModel, 0, 0, 0, { k: 'dt_filter_p', t: 'str', v: '' });
  ensureLabel(runtime, stateModel, 0, 0, 0, { k: 'dt_filter_r', t: 'str', v: '' });
  ensureLabel(runtime, stateModel, 0, 0, 0, { k: 'dt_filter_c', t: 'str', v: '' });
  ensureLabel(runtime, stateModel, 0, 0, 0, { k: 'dt_filter_ktv', t: 'str', v: '' });
  ensureLabel(runtime, stateModel, 0, 0, 0, { k: 'dt_pause_sse', t: 'bool', v: false });
  ensureLabel(runtime, stateModel, 0, 0, 0, { k: 'dt_detail_open', t: 'bool', v: false });
  ensureLabel(runtime, stateModel, 0, 0, 0, { k: 'dt_detail_title', t: 'str', v: '' });
  ensureLabel(runtime, stateModel, 0, 0, 0, { k: 'dt_detail_text', t: 'str', v: '' });

  ensureLabel(runtime, stateModel, 0, 0, 0, { k: 'dt_edit_open', t: 'bool', v: false });
  ensureLabel(runtime, stateModel, 0, 0, 0, { k: 'dt_edit_model_id', t: 'str', v: '' });
  ensureLabel(runtime, stateModel, 0, 0, 0, { k: 'dt_edit_p', t: 'str', v: '' });
  ensureLabel(runtime, stateModel, 0, 0, 0, { k: 'dt_edit_r', t: 'str', v: '' });
  ensureLabel(runtime, stateModel, 0, 0, 0, { k: 'dt_edit_c', t: 'str', v: '' });
  ensureLabel(runtime, stateModel, 0, 0, 0, { k: 'dt_edit_k', t: 'str', v: '' });
  ensureLabel(runtime, stateModel, 0, 0, 0, { k: 'dt_edit_t', t: 'str', v: 'str' });
  ensureLabel(runtime, stateModel, 0, 0, 0, { k: 'dt_edit_v_text', t: 'str', v: '' });
  ensureLabel(runtime, stateModel, 0, 0, 0, { k: 'dt_edit_v_int', t: 'int', v: 0 });
  ensureLabel(runtime, stateModel, 0, 0, 0, { k: 'dt_edit_v_bool', t: 'bool', v: false });

  ensureLabel(runtime, stateModel, 0, 0, 0, { k: 'pin_demo_host', t: 'str', v: '127.0.0.1' });
  ensureLabel(runtime, stateModel, 0, 0, 0, { k: 'pin_demo_port', t: 'int', v: 1883 });
  ensureLabel(runtime, stateModel, 0, 0, 0, { k: 'pin_demo_client_id', t: 'str', v: 'pin-demo' });
  ensureLabel(runtime, stateModel, 0, 0, 0, { k: 'pin_demo_pin', t: 'str', v: 'demo' });
  ensureLabel(runtime, stateModel, 0, 0, 0, { k: 'pin_demo_in_json', t: 'str', v: '{"value":1}' });
  ensureLabel(runtime, stateModel, 0, 0, 0, { k: 'pin_demo_out_json', t: 'str', v: '{"value":2}' });

  ensureLabel(runtime, stateModel, 0, 0, 0, { k: 'cellab_payload_json', t: 'str', v: '{"hello":1}' });

  // Docs page state.
  ensureLabel(runtime, stateModel, 0, 0, 0, { k: 'docs_query', t: 'str', v: '' });
  ensureLabel(runtime, stateModel, 0, 0, 0, { k: 'docs_selected_path', t: 'str', v: '' });
  ensureLabel(runtime, stateModel, 0, 0, 0, { k: 'docs_status', t: 'str', v: '' });
  ensureLabel(runtime, stateModel, 0, 0, 0, { k: 'docs_tree_json', t: 'json', v: [] });
  ensureLabel(runtime, stateModel, 0, 0, 0, { k: 'docs_search_results_json', t: 'json', v: [] });
  ensureLabel(runtime, stateModel, 0, 0, 0, { k: 'docs_render_html', t: 'str', v: '' });

  // Static projects page state.
  ensureLabel(runtime, stateModel, 0, 0, 0, { k: 'static_project_name', t: 'str', v: '' });
  ensureLabel(runtime, stateModel, 0, 0, 0, { k: 'static_upload_kind', t: 'str', v: 'zip' });
  ensureLabel(runtime, stateModel, 0, 0, 0, { k: 'static_zip_b64', t: 'str', v: '' });
  ensureLabel(runtime, stateModel, 0, 0, 0, { k: 'static_html_b64', t: 'str', v: '' });
  ensureLabel(runtime, stateModel, 0, 0, 0, { k: 'static_status', t: 'str', v: '' });
  ensureLabel(runtime, stateModel, 0, 0, 0, { k: 'static_projects_json', t: 'json', v: [] });

  const snapshot = reactive(runtime.snapshot());
  const eventLog = [];
  const adapter = createLocalBusAdapter({ runtime, eventLog, mode: adapterMode, mailboxModelId: EDITOR_MODEL_ID, editorStateModelId: EDITOR_STATE_MODEL_ID });

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
    refreshSnapshot,
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
