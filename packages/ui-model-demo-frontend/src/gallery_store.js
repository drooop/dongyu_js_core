import { reactive } from 'vue';
import { ModelTableRuntime } from '../../worker-base/src/index.mjs';
import { createLocalBusAdapter } from './local_bus_adapter.js';
import { buildGalleryAst } from './gallery_model.js';
import { GALLERY_MAILBOX_MODEL_ID, GALLERY_STATE_MODEL_ID, WAVE_C_SUBMODEL_ID } from './model_ids.js';
import { setHashPath } from './router.js';

function ensureModel(runtime, { id, name, type }) {
  if (runtime.getModel(id)) return runtime.getModel(id);
  return runtime.createModel({ id, name, type });
}

function ensureLabel(runtime, model, p, r, c, label) {
  const cell = runtime.getCell(model, p, r, c);
  if (cell.labels.has(label.k)) return;
  runtime.addLabel(model, p, r, c, label);
}
function readRuntimeLabelValue(runtime, ref) {
  const modelId = ref && typeof ref.model_id === 'number' ? ref.model_id : 0;
  const model = runtime.getModel(modelId);
  if (!model) return undefined;
  const cell = runtime.getCell(model, ref.p, ref.r, ref.c);
  const label = cell.labels.get(ref.k);
  return label ? label.v : undefined;
}

export function createGalleryStore(options) {
  const runtime = options && options.runtime ? options.runtime : new ModelTableRuntime();
  const snapshot = options && options.snapshot ? options.snapshot : reactive(runtime.snapshot());
  const refreshSnapshot = options && typeof options.refreshSnapshot === 'function'
    ? options.refreshSnapshot
    : () => {
      const next = runtime.snapshot();
      snapshot.models = next.models;
      snapshot.v1nConfig = next.v1nConfig;
    };

  ensureModel(runtime, { id: GALLERY_MAILBOX_MODEL_ID, name: 'gallery_mailbox', type: 'ui' });
  const stateModel = ensureModel(runtime, { id: GALLERY_STATE_MODEL_ID, name: 'gallery_state', type: 'ui' });

  const adapter = createLocalBusAdapter({ runtime, eventLog: null, mode: 'v1', mailboxModelId: GALLERY_MAILBOX_MODEL_ID, editorStateModelId: GALLERY_STATE_MODEL_ID });

  function setMailboxValue(envelopeOrNull) {
    const model = runtime.getModel(GALLERY_MAILBOX_MODEL_ID);
    runtime.addLabel(model, 0, 0, 1, { k: 'ui_event', t: 'event', v: envelopeOrNull });
  }

  function updateDerived() {
    adapter.updateUiDerived({
      uiAst: buildGalleryAst(),
      snapshotJson: '',
      eventLogJson: '',
    });
  }

  function getUiAst() {
    const model = runtime.getModel(GALLERY_MAILBOX_MODEL_ID);
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

    const model = runtime.getModel(GALLERY_MAILBOX_MODEL_ID);
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

    // Wave C: if a submodel was created via `submodel_create`, seed its fragment + state.
    {
      const model = runtime.getModel(WAVE_C_SUBMODEL_ID);
      if (model) {
        const fragCell = runtime.getCell(model, 0, 0, 0);
        const hasFrag = fragCell.labels.has('ui_fragment_v0');
        if (!hasFrag) {
          // Seed a simple fragment that binds to submodel-local state labels.
          ensureLabel(runtime, model, 0, 1, 0, { k: 'instance_text', t: 'str', v: `hello from submodel ${WAVE_C_SUBMODEL_ID}` });
          ensureLabel(runtime, model, 0, 0, 0, {
            k: 'ui_fragment_v0',
            t: 'json',
            v: {
              id: 'submodel_fragment_root',
              type: 'Card',
              props: { title: `Submodel Instance (${WAVE_C_SUBMODEL_ID})` },
              children: [
                {
                  id: 'submodel_fragment_desc',
                  type: 'Text',
                  props: { type: 'info', text: `This fragment lives in model ${WAVE_C_SUBMODEL_ID}.` },
                },
                {
                  id: 'submodel_fragment_input',
                  type: 'Input',
                  props: { placeholder: 'Edit submodel-local text' },
                  bind: {
                    read: { model_id: WAVE_C_SUBMODEL_ID, p: 0, r: 1, c: 0, k: 'instance_text' },
                    write: {
                      action: 'label_update',
                      target_ref: { model_id: WAVE_C_SUBMODEL_ID, p: 0, r: 1, c: 0, k: 'instance_text' },
                    },
                  },
                },
                {
                  id: 'submodel_fragment_value',
                  type: 'Text',
                  props: { type: 'info', text: '' },
                  bind: { read: { model_id: WAVE_C_SUBMODEL_ID, p: 0, r: 1, c: 0, k: 'instance_text' } },
                },
              ],
            },
          });
        }
      }
    }

    const navTo = readRuntimeLabelValue(runtime, { model_id: GALLERY_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'nav_to' });
    if (typeof navTo === 'string' && navTo.trim().length > 0) {
      setHashPath(navTo);
      runtime.rmLabel(stateModel, 0, 0, 0, 'nav_to');
    }

    updateDerived();
    refreshSnapshot();
    return result;
  }

  ensureLabel(runtime, stateModel, 0, 0, 0, { k: 'nav_to', t: 'str', v: '' });

  // Wave A defaults (first render should be populated).
  ensureLabel(runtime, stateModel, 0, 1, 0, { k: 'checkbox_demo', t: 'bool', v: false });
  ensureLabel(runtime, stateModel, 0, 2, 0, { k: 'radio_demo', t: 'str', v: 'alpha' });
  ensureLabel(runtime, stateModel, 0, 3, 0, { k: 'slider_demo', t: 'int', v: 42 });

  // Wave B defaults.
  ensureLabel(runtime, stateModel, 0, 4, 0, { k: 'wave_b_datepicker', t: 'str', v: '2026-01-31' });
  ensureLabel(runtime, stateModel, 0, 5, 0, { k: 'wave_b_timepicker', t: 'str', v: '09:30' });
  ensureLabel(runtime, stateModel, 0, 6, 0, { k: 'wave_b_tabs', t: 'str', v: 'alpha' });
  ensureLabel(runtime, stateModel, 0, 7, 0, { k: 'dialog_open', t: 'bool', v: false });
  ensureLabel(runtime, stateModel, 0, 8, 0, { k: 'wave_b_pagination_currentPage', t: 'int', v: 1 });
  ensureLabel(runtime, stateModel, 0, 8, 1, { k: 'wave_b_pagination_pageSize', t: 'int', v: 10 });

  // Wave C defaults.
  ensureLabel(runtime, stateModel, 0, 9, 0, { k: 'wave_c_shared_text', t: 'str', v: 'shared fragment text' });
  ensureLabel(runtime, stateModel, 0, 9, 1, {
    k: 'wave_c_fragment_static',
    t: 'json',
    v: {
      id: 'wave_c_static_fragment',
      type: 'Card',
      props: { title: 'Static Fragment (shared)' },
      children: [
        { id: 'wave_c_static_desc', type: 'Text', props: { type: 'info', text: 'Two Includes reference the same fragment label.' } },
        {
          id: 'wave_c_static_input',
          type: 'Input',
          props: { placeholder: 'Edit shared text' },
          bind: {
            read: { model_id: GALLERY_STATE_MODEL_ID, p: 0, r: 9, c: 0, k: 'wave_c_shared_text' },
            write: {
              action: 'label_update',
              target_ref: { model_id: GALLERY_STATE_MODEL_ID, p: 0, r: 9, c: 0, k: 'wave_c_shared_text' },
            },
          },
        },
        {
          id: 'wave_c_static_value',
          type: 'Text',
          props: { type: 'info', text: '' },
          bind: { read: { model_id: GALLERY_STATE_MODEL_ID, p: 0, r: 9, c: 0, k: 'wave_c_shared_text' } },
        },
      ],
    },
  });

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
  };
}
