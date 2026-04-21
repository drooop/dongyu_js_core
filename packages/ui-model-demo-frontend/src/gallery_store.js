import { reactive } from 'vue';
import { ModelTableRuntime } from '../../worker-base/src/index.mjs';
import { createLocalBusAdapter } from './local_bus_adapter.js';
import { getSnapshotLabelValue } from './snapshot_utils.js';
import { buildAstFromCellwiseModel } from './ui_cellwise_projection.js';
import { buildBusDispatchLabel, buildBusEventV2 } from './bus_event_v2.js';
import galleryCatalogPatch from '../../worker-base/system-models/gallery_catalog_ui.json' with { type: 'json' };
import {
  EDITOR_STATE_MODEL_ID,
  GALLERY_CATALOG_MODEL_ID,
  GALLERY_MAILBOX_MODEL_ID,
  GALLERY_STATE_MODEL_ID,
  MATRIX_DEBUG_MODEL_ID,
  MODEL_100_ID,
  SLIDE_CREATOR_APP_MODEL_ID,
  SLIDE_CREATOR_TRUTH_MODEL_ID,
  SLIDE_IMPORTER_APP_MODEL_ID,
  SLIDE_IMPORTER_TRUTH_MODEL_ID,
  THREE_SCENE_APP_MODEL_ID,
  THREE_SCENE_CHILD_MODEL_ID,
  THREE_SCENE_CREATE_ENTITY_ACTION,
  THREE_SCENE_DELETE_ENTITY_ACTION,
  THREE_SCENE_SELECT_ENTITY_ACTION,
  THREE_SCENE_UPDATE_ENTITY_ACTION,
  UI_EXAMPLE_CHILD_MODEL_ID,
  UI_EXAMPLE_PAGE_ASSET_MODEL_ID,
  UI_EXAMPLE_PARENT_MODEL_ID,
  UI_EXAMPLE_PROMOTE_CHILD_ACTION,
  UI_EXAMPLE_SCHEMA_MODEL_ID,
} from './model_ids.js';
import { setHashPath } from './router.js';

const MAILBOX_EVENT_KEY = 'bus_event';

function freezeArray(items) {
  return Object.freeze([...items]);
}

function freezeObject(entries) {
  return Object.freeze(entries);
}

export const GALLERY_PAGE_ASSET_REF = freezeObject({
  model_id: GALLERY_CATALOG_MODEL_ID,
  p: 0,
  r: 1,
  c: 0,
  k: 'page_asset_v0',
});

export const GALLERY_MODE_ALIGNMENT = freezeObject({
  local: 'shared_runtime_gallery_mailbox',
  remote: 'shared_snapshot_dispatch',
  standalone: 'standalone_local_runtime',
});

const MATRIX_DEBUG_ACTIONS = freezeArray([
  'matrix_debug_refresh',
  'matrix_debug_clear_trace',
  'matrix_debug_summarize',
]);

const CANONICAL_EXAMPLE_MODEL_IDS = freezeArray([
  UI_EXAMPLE_SCHEMA_MODEL_ID,
  UI_EXAMPLE_PAGE_ASSET_MODEL_ID,
  UI_EXAMPLE_PARENT_MODEL_ID,
  UI_EXAMPLE_CHILD_MODEL_ID,
]);

const THREE_SCENE_MODEL_IDS = freezeArray([
  THREE_SCENE_APP_MODEL_ID,
  THREE_SCENE_CHILD_MODEL_ID,
]);

const THREE_SCENE_ACTIONS = freezeArray([
  THREE_SCENE_CREATE_ENTITY_ACTION,
  THREE_SCENE_SELECT_ENTITY_ACTION,
  THREE_SCENE_UPDATE_ENTITY_ACTION,
  THREE_SCENE_DELETE_ENTITY_ACTION,
]);

export const GALLERY_INTEGRATION_CONTRACT = freezeObject({
  matrixDebug: freezeObject({
    model_id: MATRIX_DEBUG_MODEL_ID,
    actions: MATRIX_DEBUG_ACTIONS,
  }),
  slideMainline: freezeObject({
    model_ids: [
      MODEL_100_ID,
      SLIDE_IMPORTER_APP_MODEL_ID,
      SLIDE_IMPORTER_TRUTH_MODEL_ID,
      SLIDE_CREATOR_APP_MODEL_ID,
      SLIDE_CREATOR_TRUTH_MODEL_ID,
    ],
    actions: freezeArray(['slide_app_import', 'slide_app_create']),
  }),
  canonicalExamples: freezeObject({
    model_ids: CANONICAL_EXAMPLE_MODEL_IDS,
    actions: freezeArray([UI_EXAMPLE_PROMOTE_CHILD_ACTION]),
  }),
  threeScene: freezeObject({
    model_ids: THREE_SCENE_MODEL_IDS,
    actions: THREE_SCENE_ACTIONS,
  }),
});

const GALLERY_UPSTREAM_ACTIONS = new Set([
  ...MATRIX_DEBUG_ACTIONS,
  UI_EXAMPLE_PROMOTE_CHILD_ACTION,
  ...THREE_SCENE_ACTIONS,
]);

function ensureModel(runtime, { id, name, type }) {
  if (runtime.getModel(id)) return runtime.getModel(id);
  return runtime.createModel({ id, name, type });
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

function resolveSourceMode(options) {
  const sourceStore = options && options.sourceStore ? options.sourceStore : null;
  if (sourceStore && sourceStore.runtime) {
    return GALLERY_MODE_ALIGNMENT.local;
  }
  if (sourceStore) {
    return GALLERY_MODE_ALIGNMENT.remote;
  }
  if (options && options.runtime) {
    return GALLERY_MODE_ALIGNMENT.local;
  }
  return GALLERY_MODE_ALIGNMENT.standalone;
}

export function createGalleryStore(options) {
  const sourceMode = resolveSourceMode(options);
  const sourceStore = options && options.sourceStore ? options.sourceStore : null;
  const runtime = sourceMode === GALLERY_MODE_ALIGNMENT.remote
    ? null
    : (options && options.runtime ? options.runtime : (sourceStore && sourceStore.runtime ? sourceStore.runtime : new ModelTableRuntime()));
  const snapshot = options && options.snapshot
    ? options.snapshot
    : (sourceStore && sourceStore.snapshot ? sourceStore.snapshot : reactive(runtime.snapshot()));
  const refreshSnapshot = options && typeof options.refreshSnapshot === 'function'
    ? options.refreshSnapshot
    : (sourceStore && typeof sourceStore.refreshSnapshot === 'function'
      ? sourceStore.refreshSnapshot
      : () => {
        if (!runtime) return;
        const next = runtime.snapshot();
        snapshot.models = next.models;
        snapshot.v1nConfig = next.v1nConfig;
      });
  const delegateDispatchAddLabel = options && typeof options.dispatchAddLabel === 'function'
    ? options.dispatchAddLabel
    : (sourceStore && typeof sourceStore.dispatchAddLabel === 'function' ? sourceStore.dispatchAddLabel : null);
  const delegateDispatchRmLabel = options && typeof options.dispatchRmLabel === 'function'
    ? options.dispatchRmLabel
    : (sourceStore && typeof sourceStore.dispatchRmLabel === 'function' ? sourceStore.dispatchRmLabel : null);
  const delegateConsumeOnce = options && typeof options.consumeOnce === 'function'
    ? options.consumeOnce
    : (sourceStore && typeof sourceStore.consumeOnce === 'function' ? sourceStore.consumeOnce : null);
  const routeState = reactive({ path: '/gallery' });
  let pendingConsumer = 'gallery';

  let stateModel = null;
  let adapter = null;

  if (runtime) {
    ensureModel(runtime, { id: GALLERY_MAILBOX_MODEL_ID, name: 'gallery_mailbox', type: 'ui' });
    ensureGalleryAssets(runtime);
    stateModel = runtime.getModel(GALLERY_STATE_MODEL_ID);
    adapter = createLocalBusAdapter({
      runtime,
      eventLog: null,
      mode: 'v1',
      mailboxModelId: GALLERY_MAILBOX_MODEL_ID,
      editorStateModelId: GALLERY_STATE_MODEL_ID,
    });
  }

  function setMailboxValue(envelopeOrNull) {
    if (!runtime) return;
    const model = runtime.getModel(GALLERY_MAILBOX_MODEL_ID);
    runtime.addLabel(model, 0, 0, 1, { k: MAILBOX_EVENT_KEY, t: 'event', v: envelopeOrNull });
  }

  function getUiAst() {
    const cellwise = buildAstFromCellwiseModel(snapshot, GALLERY_CATALOG_MODEL_ID);
    if (cellwise && typeof cellwise === 'object') return cellwise;
    const raw = getSnapshotLabelValue(snapshot, GALLERY_PAGE_ASSET_REF);
    return raw && typeof raw === 'object' ? raw : null;
  }

  function shouldUseGalleryLocalPath(label) {
    if (sourceMode !== GALLERY_MODE_ALIGNMENT.local) return true;
    if (!label || label.t !== 'event') return true;
    const envelope = label.v && typeof label.v === 'object' ? label.v : null;
    const payload = envelope && envelope.payload && typeof envelope.payload === 'object' ? envelope.payload : null;
    const action = payload && typeof payload.action === 'string' ? payload.action : '';
    const target = payload && payload.target && typeof payload.target === 'object' ? payload.target : null;
    const targetModelId = target && Number.isInteger(target.model_id) ? target.model_id : null;

    if (action === 'label_update' || action === 'label_add' || action === 'label_remove' || action === 'cell_clear') {
      return targetModelId === GALLERY_STATE_MODEL_ID;
    }
    return !GALLERY_UPSTREAM_ACTIONS.has(action);
  }

  function setRoutePath(routePath) {
    routeState.path = typeof routePath === 'string' && routePath.trim().length > 0 ? routePath : '/gallery';
    return routeState.path;
  }

  function dispatchAddLabel(label) {
    if (sourceMode === GALLERY_MODE_ALIGNMENT.remote) {
      if (typeof delegateDispatchAddLabel !== 'function') {
        throw new Error('gallery_remote_dispatch_missing');
      }
      pendingConsumer = 'source';
      return delegateDispatchAddLabel(label);
    }

    if (
      sourceMode === GALLERY_MODE_ALIGNMENT.local
      && !shouldUseGalleryLocalPath(label)
      && typeof delegateDispatchAddLabel === 'function'
    ) {
      pendingConsumer = 'source';
      return delegateDispatchAddLabel(label);
    }

    if (!label || label.t !== 'event') {
      throw new Error('non_event_write');
    }
    if (label.p === 0 && label.r === 0 && label.c === 0 && label.k === 'bus_in_event' && label.v && typeof label.v === 'object') {
      const envelope = label.v;
      if (envelope.type !== 'bus_event_v2') {
        throw new Error('invalid_envelope');
      }
      const busInKey = typeof envelope.bus_in_key === 'string' ? envelope.bus_in_key.trim() : '';
      const value = envelope.value;
      if (value && typeof value === 'object' && typeof value.action === 'string') {
        const legacyEnvelope = {
          event_id: Date.now(),
          type: value.action,
          source: 'ui_renderer',
          ts: 0,
          payload: {
            action: value.action,
            meta: envelope.meta || { op_id: `legacy_${Date.now()}` },
            target: value.target,
            value: value.value,
            ...(value.pin ? { pin: value.pin } : {}),
          },
        };
        setMailboxValue(legacyEnvelope);
        refreshSnapshot();
        pendingConsumer = 'gallery';
        return undefined;
      }
      if (!busInKey) {
        throw new Error('invalid_envelope');
      }
      const model0 = runtime.getModel(0);
      runtime.addLabel(model0, 0, 0, 0, { k: busInKey, t: 'pin.bus.in', v: envelope.value ?? null });
      refreshSnapshot();
      pendingConsumer = 'gallery';
      return undefined;
    }
    if (label.p !== 0 || label.r !== 0 || label.c !== 1) {
      throw new Error('event_mailbox_mismatch');
    }

    const model = runtime.getModel(GALLERY_MAILBOX_MODEL_ID);
    const cell = runtime.getCell(model, 0, 0, 1);
    const current = cell.labels.get(MAILBOX_EVENT_KEY);
    if (current && current.v !== null && current.v !== undefined) {
      throw new Error('event_mailbox_full');
    }

    setMailboxValue(label.v);
    refreshSnapshot();
    pendingConsumer = 'gallery';
    return undefined;
  }

  function dispatchRmLabel(labelRef) {
    if (sourceMode === GALLERY_MODE_ALIGNMENT.remote) {
      if (typeof delegateDispatchRmLabel !== 'function') return undefined;
      return delegateDispatchRmLabel(labelRef);
    }

    if (sourceMode === GALLERY_MODE_ALIGNMENT.local && pendingConsumer === 'source' && typeof delegateDispatchRmLabel === 'function') {
      return delegateDispatchRmLabel(labelRef);
    }

    if (!labelRef || labelRef.p !== 0 || labelRef.r !== 0 || labelRef.c !== 1) {
      return undefined;
    }
    setMailboxValue(null);
    refreshSnapshot();
    return undefined;
  }

  function consumeOnce() {
    if (sourceMode === GALLERY_MODE_ALIGNMENT.remote) {
      if (typeof delegateConsumeOnce === 'function') {
        return delegateConsumeOnce();
      }
      return { consumed: false };
    }

    if (sourceMode === GALLERY_MODE_ALIGNMENT.local && pendingConsumer === 'source' && typeof delegateConsumeOnce === 'function') {
      const result = delegateConsumeOnce();
      refreshSnapshot();
      pendingConsumer = 'gallery';
      return result;
    }

    const result = adapter.consumeOnce();

    const navTo = readRuntimeLabelValue(runtime, { model_id: GALLERY_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'nav_to' });
    if (typeof navTo === 'string' && navTo.trim().length > 0) {
      setHashPath(navTo);
      runtime.rmLabel(stateModel, 0, 0, 0, 'nav_to');
    }

    ensureWorkspaceGalleryEntry(runtime);
    refreshSnapshot();
    pendingConsumer = 'gallery';
    return result;
  }

  if (runtime) {
    setMailboxValue(null);
    ensureWorkspaceGalleryEntry(runtime);
    refreshSnapshot();
  }

  return {
    runtime,
    snapshot,
    refreshSnapshot,
    getUiAst,
    setRoutePath,
    dispatchAddLabel,
    dispatchRmLabel,
    consumeOnce,
    sourceMode,
    buildDispatchLabel: buildBusDispatchLabel,
    buildUiEventV2: buildBusEventV2,
  };
}
