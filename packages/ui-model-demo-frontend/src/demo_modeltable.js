import { reactive } from 'vue';
import { ModelTableRuntime } from '../../worker-base/src/index.mjs';
import { createLocalBusAdapter } from './local_bus_adapter.js';

function buildEditorAst() {
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
  runtime.createModel({ id: 99, name: 'editor_mailbox', type: 'ui' });

  const snapshot = reactive(runtime.snapshot());
  const eventLog = [];
  const adapter = createLocalBusAdapter({ runtime, eventLog });

  function refreshSnapshot() {
    const next = runtime.snapshot();
    snapshot.models = next.models;
    snapshot.v1nConfig = next.v1nConfig;
  }

  function setMailboxValue(envelopeOrNull) {
    const model = runtime.getModel(99);
    runtime.addLabel(model, 0, 0, 1, { k: 'ui_event', t: 'event', v: envelopeOrNull });
  }

  function updateDerived() {
    const snap = runtime.snapshot();
    const safeModels = {};
    const snapModels = snap && snap.models ? snap.models : {};
    for (const [id, model] of Object.entries(snapModels)) {
      if (String(id) === '99') continue;
      safeModels[id] = model;
    }

    adapter.updateUiDerived({
      uiAst: buildEditorAst(),
      snapshotJson: JSON.stringify({ models: safeModels, v1nConfig: snap ? snap.v1nConfig : undefined }, null, 2),
      eventLogJson: JSON.stringify(eventLog, null, 2),
    });
  }

  function getUiAst() {
    const model = runtime.getModel(99);
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

    const model = runtime.getModel(99);
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
  };
}

export function buildDemoAstSample() {
  return buildEditorAst();
}
