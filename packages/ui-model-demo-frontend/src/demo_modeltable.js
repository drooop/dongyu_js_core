import { reactive } from 'vue';
import { ModelTableRuntime } from '../../worker-base/src/index.mjs';
import { createLocalBusAdapter } from './local_bus_adapter.js';
import { createLocalStoragePersister } from './local_persistence.js';
import homeCatalogPatch from '../../worker-base/system-models/home_catalog_ui.json' with { type: 'json' };
import docsCatalogPatch from '../../worker-base/system-models/docs_catalog_ui.json' with { type: 'json' };
import staticCatalogPatch from '../../worker-base/system-models/static_catalog_ui.json' with { type: 'json' };
import navCatalogPatch from '../../worker-base/system-models/nav_catalog_ui.json' with { type: 'json' };
import workspaceCatalogPatch from '../../worker-base/system-models/workspace_catalog_ui.json' with { type: 'json' };
import editorTestCatalogPatch from '../../worker-base/system-models/editor_test_catalog_ui.json' with { type: 'json' };
import promptCatalogPatch from '../../worker-base/system-models/prompt_catalog_ui.json' with { type: 'json' };
import matrixDebugSurfacePatch from '../../worker-base/system-models/matrix_debug_surface.json' with { type: 'json' };
import { buildAstFromSchema } from './ui_schema_projection.js';
import { resolvePageAsset } from './page_asset_resolver.js';
import { resolveRouteUiAst } from './route_ui_projection.js';
import {
  deriveEditorModelOptions,
  deriveHomeEditDialogTitle,
  deriveHomeMissingModelText,
  deriveHomeSelectedLabelText,
  deriveHomeTableRows,
  deriveStaticUploadReady,
  deriveWorkspaceSelected,
} from './editor_page_state_derivers.js';

import {
  EDITOR_MAILBOX_MODEL_ID as EDITOR_MODEL_ID,
  EDITOR_STATE_MODEL_ID,
  GALLERY_MAILBOX_MODEL_ID,
  GALLERY_CATALOG_MODEL_ID,
  MATRIX_DEBUG_MODEL_ID,
  PROMPT_CATALOG_MODEL_ID,
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

function overwriteLabel(runtime, model, p, r, c, label) {
  const cell = runtime.getCell(model, p, r, c);
  if (cell.labels.has(label.k)) {
    runtime.rmLabel(model, p, r, c, label.k);
  }
  runtime.addLabel(model, p, r, c, label);
}

function applyUiPatch(runtime, patch) {
  const result = runtime.applyPatch(patch, { allowCreateModel: true, trustedBootstrap: true });
  if (result && result.rejected > 0) {
    // bootstrap patches may re-run on persisted runtimes; keep applied records and ignore duplicate rejects
  }
}

function stringify(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch (_) {
    return String(value);
  }
}

function getMaxPositiveModelId(runtime) {
  let maxModelId = 0;
  for (const id of runtime.models.keys()) {
    if (Number.isInteger(id) && id > maxModelId) {
      maxModelId = id;
    }
  }
  return maxModelId;
}

function resolveNextWorkspaceModelId(runtime) {
  return Math.max(1001, getMaxPositiveModelId(runtime) + 1);
}

function normalizeIntValue(value, fallback) {
  if (Number.isInteger(value)) return value;
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isInteger(parsed) ? parsed : fallback;
}

function deriveWorkspaceRegistry(runtime) {
  const derived = [];
  const seen = new Set();
  const excludedModelIds = new Set([
    EDITOR_MODEL_ID,
    EDITOR_STATE_MODEL_ID,
    SYSTEM_MODEL_ID,
    GALLERY_MAILBOX_MODEL_ID,
  ]);

  const addOrReplace = (entry) => {
    if (!entry || !Number.isInteger(entry.model_id)) return;
    if (entry.model_id === 0 || excludedModelIds.has(entry.model_id)) return;
    const existing = derived.find((item) => item.model_id === entry.model_id);
    if (existing) {
      Object.assign(existing, entry);
      return;
    }
    derived.push(entry);
    seen.add(entry.model_id);
  };

  const snap = runtime.snapshot();
  const models = snap && snap.models ? snap.models : {};
  for (const [idText, modelSnap] of Object.entries(models)) {
    const modelId = Number(idText);
    if (!Number.isInteger(modelId) || modelId === 0 || seen.has(modelId) || excludedModelIds.has(modelId)) continue;
    const rootLabels = modelSnap && modelSnap.cells && modelSnap.cells['0,0,0'] && modelSnap.cells['0,0,0'].labels
      ? modelSnap.cells['0,0,0'].labels
      : {};
    if (rootLabels.ws_deleted && rootLabels.ws_deleted.v === true) continue;
    const hasAppSignals = modelId > 0
      ? Boolean(rootLabels.app_name || rootLabels.dual_bus_model || (modelSnap && modelSnap.cells && modelSnap.cells['1,0,0']))
      : Boolean(rootLabels.app_name);
    if (!hasAppSignals) continue;
    const name = rootLabels.app_name && typeof rootLabels.app_name.v === 'string' && rootLabels.app_name.v.trim()
      ? rootLabels.app_name.v
      : (modelSnap && typeof modelSnap.name === 'string' && modelSnap.name.trim()
        ? modelSnap.name
        : `App ${modelId}`);
    const source = rootLabels.source_worker && typeof rootLabels.source_worker.v === 'string'
      ? rootLabels.source_worker.v
      : '';
    addOrReplace({ model_id: modelId, name, source });
  }
  derived.sort((a, b) => a.model_id - b.model_id);
  return derived;
}

function resolveDefaultWorkspaceAppId(apps) {
  if (!Array.isArray(apps) || apps.length === 0) return 0;
  if (apps.some((app) => app && app.model_id === MATRIX_DEBUG_MODEL_ID)) {
    return MATRIX_DEBUG_MODEL_ID;
  }
  if (apps.some((app) => app && app.model_id === GALLERY_CATALOG_MODEL_ID)) {
    return GALLERY_CATALOG_MODEL_ID;
  }
  const firstPositive = apps.find((app) => app && Number.isInteger(app.model_id) && app.model_id > 0);
  return firstPositive ? firstPositive.model_id : apps[0].model_id;
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

  const stateRoot = runtime.getCell(stateModel, 0, 0, 0);
  if (!stateRoot.labels.has('ui_page_catalog_json')) {
    applyUiPatch(runtime, navCatalogPatch);
  }
  applyUiPatch(runtime, homeCatalogPatch);
  applyUiPatch(runtime, docsCatalogPatch);
  applyUiPatch(runtime, staticCatalogPatch);
  applyUiPatch(runtime, workspaceCatalogPatch);
  applyUiPatch(runtime, editorTestCatalogPatch);
  applyUiPatch(runtime, matrixDebugSurfacePatch);
  if (!runtime.getModel(PROMPT_CATALOG_MODEL_ID)) {
    applyUiPatch(runtime, promptCatalogPatch);
  }

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
  ensureLabel(runtime, stateModel, 0, 0, 0, { k: 'editor_model_options_json', t: 'json', v: [] });
  ensureLabel(runtime, stateModel, 0, 0, 0, { k: 'home_table_rows_json', t: 'json', v: [] });
  ensureLabel(runtime, stateModel, 0, 0, 0, { k: 'home_missing_model_text', t: 'str', v: '' });
  ensureLabel(runtime, stateModel, 0, 0, 0, { k: 'home_selected_label_text', t: 'str', v: '' });
  ensureLabel(runtime, stateModel, 0, 0, 0, { k: 'home_status_text', t: 'str', v: '' });
  ensureLabel(runtime, stateModel, 0, 0, 0, { k: 'home_form_mode', t: 'str', v: 'edit' });
  ensureLabel(runtime, stateModel, 0, 0, 0, { k: 'home_edit_dialog_title', t: 'str', v: 'Edit Label' });
  ensureLabel(runtime, stateModel, 0, 0, 0, { k: 'home_delete_confirm_open', t: 'bool', v: false });
  ensureLabel(runtime, stateModel, 0, 0, 0, { k: 'home_delete_confirm_text', t: 'str', v: '' });
  ensureLabel(runtime, stateModel, 0, 0, 0, { k: 'home_delete_target_json', t: 'json', v: null });
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
  ensureLabel(runtime, stateModel, 0, 0, 0, { k: 'static_media_uri', t: 'str', v: '' });
  ensureLabel(runtime, stateModel, 0, 0, 0, { k: 'static_media_name', t: 'str', v: '' });
  ensureLabel(runtime, stateModel, 0, 0, 0, { k: 'static_zip_b64', t: 'str', v: '' });
  ensureLabel(runtime, stateModel, 0, 0, 0, { k: 'static_html_b64', t: 'str', v: '' });
  ensureLabel(runtime, stateModel, 0, 0, 0, { k: 'static_status', t: 'str', v: '' });
  ensureLabel(runtime, stateModel, 0, 0, 0, { k: 'static_projects_json', t: 'json', v: [] });

  // Workspace (sliding UI) state labels for local mode.
  ensureLabel(runtime, stateModel, 0, 0, 0, { k: 'ws_app_selected', t: 'int', v: 0 });
  ensureLabel(runtime, stateModel, 0, 0, 0, { k: 'ws_app_next_id', t: 'int', v: 1001 });
  ensureLabel(runtime, stateModel, 0, 0, 0, { k: 'ws_apps_registry', t: 'json', v: [] });

  const snapshot = reactive(runtime.snapshot());
  const eventLog = [];
  const routeState = reactive({ path: '/' });
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
    const stateModelLive = runtime.getModel(EDITOR_STATE_MODEL_ID);
    if (stateModelLive) {
      overwriteLabel(runtime, stateModelLive, 0, 0, 0, { k: 'editor_model_options_json', t: 'json', v: deriveEditorModelOptions(snap, EDITOR_STATE_MODEL_ID) });
      overwriteLabel(runtime, stateModelLive, 0, 0, 0, { k: 'home_table_rows_json', t: 'json', v: deriveHomeTableRows(snap, EDITOR_STATE_MODEL_ID) });
      overwriteLabel(runtime, stateModelLive, 0, 0, 0, { k: 'home_missing_model_text', t: 'str', v: deriveHomeMissingModelText(snap, EDITOR_STATE_MODEL_ID) });
      overwriteLabel(runtime, stateModelLive, 0, 0, 0, { k: 'home_selected_label_text', t: 'str', v: deriveHomeSelectedLabelText(snap, EDITOR_STATE_MODEL_ID) });
      overwriteLabel(runtime, stateModelLive, 0, 0, 0, { k: 'home_edit_dialog_title', t: 'str', v: deriveHomeEditDialogTitle(snap, EDITOR_STATE_MODEL_ID) });
      const workspaceApps = deriveWorkspaceRegistry(runtime);
      overwriteLabel(runtime, stateModelLive, 0, 0, 0, { k: 'ws_apps_registry', t: 'json', v: workspaceApps });
      const selectedWorkspaceApp = normalizeIntValue(
        runtime.getLabelValue(stateModelLive, 0, 0, 0, 'ws_app_selected'),
        resolveDefaultWorkspaceAppId(workspaceApps),
      );
      const validWorkspaceApp = workspaceApps.some((app) => app && app.model_id === selectedWorkspaceApp)
        ? selectedWorkspaceApp
        : resolveDefaultWorkspaceAppId(workspaceApps);
      overwriteLabel(runtime, stateModelLive, 0, 0, 0, { k: 'ws_app_selected', t: 'int', v: Number(validWorkspaceApp) });
      overwriteLabel(runtime, stateModelLive, 0, 0, 0, { k: 'ws_app_next_id', t: 'int', v: resolveNextWorkspaceModelId(runtime) });
    }

    const nextSnap = runtime.snapshot();
    const safeModels = {};
    const snapModels = nextSnap && nextSnap.models ? nextSnap.models : {};
    for (const [id, model] of Object.entries(snapModels)) {
      if (String(id) === String(EDITOR_MODEL_ID)) continue;
      if (String(id) === String(EDITOR_STATE_MODEL_ID)) continue;
      safeModels[id] = model;
    }

    const resolved = resolvePageAsset(nextSnap, {
      projectSchemaModel: buildAstFromSchema,
    });

    adapter.updateUiDerived({
      uiAst: resolved.ast,
      snapshotJson: JSON.stringify({ models: safeModels, v1nConfig: nextSnap ? nextSnap.v1nConfig : undefined }, null, 2),
      eventLogJson: JSON.stringify(eventLog, null, 2),
    });
  }

  function getUiAst() {
    const resolved = resolveRouteUiAst(snapshot, routeState.path, { projectSchemaModel: buildAstFromSchema });
    return resolved && resolved.ast && typeof resolved.ast === 'object' ? resolved.ast : null;
  }

  function setRoutePath(routePath) {
    routeState.path = typeof routePath === 'string' && routePath.trim().length > 0 ? routePath : '/';
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
    setRoutePath,
    dispatchAddLabel,
    dispatchRmLabel,
    consumeOnce,
    stringify,
    uiMode,
    adapterMode,
  };
}

export function buildDemoAstSample() {
  const store = createDemoStore({ uiMode: 'v1', adapterMode: 'v1' });
  return store.getUiAst();
}
