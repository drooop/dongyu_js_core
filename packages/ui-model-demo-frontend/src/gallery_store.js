import { reactive } from 'vue';
import { ModelTableRuntime } from '../../worker-base/src/index.mjs';
import { createLocalBusAdapter } from './local_bus_adapter.js';
import { getSnapshotLabelValue } from './snapshot_utils.js';
import galleryCatalogPatch from '../../worker-base/system-models/gallery_catalog_ui.json' with { type: 'json' };
import { EDITOR_STATE_MODEL_ID, GALLERY_CATALOG_MODEL_ID, GALLERY_MAILBOX_MODEL_ID, GALLERY_STATE_MODEL_ID } from './model_ids.js';
import { setHashPath } from './router.js';

const GALLERY_PAGE_ASSET_REF = { model_id: GALLERY_CATALOG_MODEL_ID, p: 0, r: 1, c: 0, k: 'page_asset_v0' };

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

function ensureGalleryAssets(runtime) {
  if (!runtime.getModel(GALLERY_CATALOG_MODEL_ID) || !runtime.getModel(GALLERY_STATE_MODEL_ID)) {
    const result = runtime.applyPatch(galleryCatalogPatch, { allowCreateModel: true, trustedBootstrap: true });
    if (result && result.rejected > 0) {
      throw new Error('gallery_asset_patch_rejected');
    }
  }
}

function ensureWorkspaceGalleryEntry(runtime) {
  const stateModel = runtime.getModel(EDITOR_STATE_MODEL_ID);
  if (!stateModel) return;
  const cell = runtime.getCell(stateModel, 0, 0, 0);
  const current = cell.labels.get('ws_apps_registry');
  const list = current && Array.isArray(current.v) ? [...current.v] : [];
  if (!list.some((entry) => entry && entry.model_id === GALLERY_CATALOG_MODEL_ID)) {
    list.push({ model_id: GALLERY_CATALOG_MODEL_ID, name: 'Gallery', source: 'system' });
    list.sort((a, b) => (a.model_id || 0) - (b.model_id || 0));
    runtime.addLabel(stateModel, 0, 0, 0, { k: 'ws_apps_registry', t: 'json', v: list });
  }
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
  ensureGalleryAssets(runtime);
  const stateModel = runtime.getModel(GALLERY_STATE_MODEL_ID);

  const adapter = createLocalBusAdapter({ runtime, eventLog: null, mode: 'v1', mailboxModelId: GALLERY_MAILBOX_MODEL_ID, editorStateModelId: GALLERY_STATE_MODEL_ID });

  function setMailboxValue(envelopeOrNull) {
    const model = runtime.getModel(GALLERY_MAILBOX_MODEL_ID);
    runtime.addLabel(model, 0, 0, 1, { k: 'ui_event', t: 'event', v: envelopeOrNull });
  }

  function getUiAst() {
    const raw = getSnapshotLabelValue(snapshot, GALLERY_PAGE_ASSET_REF);
    return raw && typeof raw === 'object' ? raw : null;
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

    const navTo = readRuntimeLabelValue(runtime, { model_id: GALLERY_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'nav_to' });
    if (typeof navTo === 'string' && navTo.trim().length > 0) {
      setHashPath(navTo);
      runtime.rmLabel(stateModel, 0, 0, 0, 'nav_to');
    }

    ensureWorkspaceGalleryEntry(runtime);
    refreshSnapshot();
    return result;
  }

  setMailboxValue(null);
  ensureWorkspaceGalleryEntry(runtime);
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
