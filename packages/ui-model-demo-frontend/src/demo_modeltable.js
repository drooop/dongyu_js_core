import { reactive } from 'vue';
import { ModelTableRuntime } from '../../worker-base/src/index.mjs';
import { createLocalBusAdapter } from './local_bus_adapter.js';
import { createLocalStoragePersister } from './local_persistence.js';
import homeCatalogPatch from '../../worker-base/system-models/home_catalog_ui.json' with { type: 'json' };
import docsCatalogPatch from '../../worker-base/system-models/docs_catalog_ui.json' with { type: 'json' };
import staticCatalogPatch from '../../worker-base/system-models/static_catalog_ui.json' with { type: 'json' };
import navCatalogPatch from '../../worker-base/system-models/nav_catalog_ui.json' with { type: 'json' };
import workspaceCatalogPatch from '../../worker-base/system-models/workspace_catalog_ui.json' with { type: 'json' };
import slidingFlowShellPatch from '../../worker-base/system-models/sliding_flow_shell_ui.json' with { type: 'json' };
import workspacePositiveModelsPatch from '../../worker-base/system-models/workspace_positive_models.json' with { type: 'json' };
import docPageFilltableExampleMinimalPatch from '../../worker-base/system-models/doc_page_filltable_example_minimal.json' with { type: 'json' };
import slideAppProviderDocsUiPatch from '../../worker-base/system-models/slide_app_provider_docs_ui.json' with { type: 'json' };
import runtimeHierarchyMountsPatch from '../../worker-base/system-models/runtime_hierarchy_mounts.json' with { type: 'json' };
import editorTestCatalogPatch from '../../worker-base/system-models/editor_test_catalog_ui.json' with { type: 'json' };
import promptCatalogPatch from '../../worker-base/system-models/prompt_catalog_ui.json' with { type: 'json' };
import matrixDebugSurfacePatch from '../../worker-base/system-models/matrix_debug_surface.json' with { type: 'json' };
import cognitionSceneModelPatch from '../../worker-base/system-models/cognition_scene_model.json' with { type: 'json' };
import cognitionLifecycleModelPatch from '../../worker-base/system-models/cognition_lifecycle_model.json' with { type: 'json' };
import { buildAstFromSchema } from './ui_schema_projection.js';
import { buildAstFromCellwiseModel } from './ui_cellwise_projection.js';
import { resolvePageAsset } from './page_asset_resolver.js';
import { resolveRouteUiAst } from './route_ui_projection.js';
import { buildBusDispatchLabel, buildBusEventV2, normalizeBusEventV2ValueToPinPayload } from './bus_event_v2.js';
import {
  deriveEditorModelOptions,
  deriveHomeEditDialogTitle,
  deriveHomeMissingModelText,
  deriveHomeSelectedLabelText,
  deriveSlideGalleryView,
  deriveSlidingFlowShellProjectionLabels,
  deriveSlidingFlowShellState,
  deriveMatrixDebugView,
  deriveHomeTableRows,
  deriveStaticUploadReady,
  deriveWorkspaceSelected,
} from './editor_page_state_derivers.js';

import {
  DOC_PAGE_FILLTABLE_MINIMAL_MODEL_ID,
  EDITOR_MAILBOX_MODEL_ID as EDITOR_MODEL_ID,
  EDITOR_STATE_MODEL_ID,
  FLOW_SHELL_DEFAULT_TAB,
  FLOW_SHELL_TAB_LABEL,
  GALLERY_MAILBOX_MODEL_ID,
  GALLERY_CATALOG_MODEL_ID,
  GALLERY_STATE_MODEL_ID,
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

const MAILBOX_EVENT_KEY = 'bus_event';

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

function shouldResetHomeSelectionFromEnvelope(envelope) {
  const payload = envelope && typeof envelope === 'object' ? envelope.payload : null;
  const target = payload && typeof payload === 'object' ? payload.target : null;
  const value = payload && typeof payload === 'object' ? payload.value : null;
  return payload && payload.action === 'label_update'
    && target
    && target.model_id === EDITOR_STATE_MODEL_ID
    && target.p === 0
    && target.r === 0
    && target.c === 0
    && target.k === 'ui_page'
    && String(value && Object.prototype.hasOwnProperty.call(value, 'v') ? value.v : '').trim().toLowerCase() === 'home';
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
    const deletable = rootLabels.deletable ? rootLabels.deletable.v === true : false;
    const slideCapable = rootLabels.slide_capable ? rootLabels.slide_capable.v === true : false;
    const slideSurfaceType = rootLabels.slide_surface_type && typeof rootLabels.slide_surface_type.v === 'string'
      ? rootLabels.slide_surface_type.v
      : '';
    addOrReplace({
      model_id: modelId,
      name,
      source,
      deletable,
      delete_disabled: !deletable,
      slide_capable: slideCapable,
      slide_surface_type: slideSurfaceType,
    });
  }
  derived.sort((a, b) => a.model_id - b.model_id);
  return derived;
}

function resolveDefaultWorkspaceAppId(apps) {
  if (!Array.isArray(apps) || apps.length === 0) return 0;
  const firstSlideCapable = apps.find((app) => app && app.slide_capable === true && Number.isInteger(app.model_id) && app.model_id > 0);
  if (firstSlideCapable) return firstSlideCapable.model_id;
  const firstPositive = apps.find((app) => app && Number.isInteger(app.model_id) && app.model_id > 0);
  return firstPositive ? firstPositive.model_id : apps[0].model_id;
}

function resolveWorkspaceSelection(apps, selectedValue, defaultSelected) {
  const selected = Number.isInteger(selectedValue) ? selectedValue : parseSafeInt(selectedValue);
  if (Number.isInteger(selected) && Array.isArray(apps) && apps.some((app) => app && app.model_id === selected)) {
    return selected;
  }
  return defaultSelected;
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

  applyUiPatch(runtime, navCatalogPatch);
  applyUiPatch(runtime, homeCatalogPatch);
  applyUiPatch(runtime, docsCatalogPatch);
  applyUiPatch(runtime, staticCatalogPatch);
  applyUiPatch(runtime, workspaceCatalogPatch);
  applyUiPatch(runtime, slidingFlowShellPatch);
  applyUiPatch(runtime, workspacePositiveModelsPatch);
  applyUiPatch(runtime, docPageFilltableExampleMinimalPatch);
  applyUiPatch(runtime, slideAppProviderDocsUiPatch);
  applyUiPatch(runtime, runtimeHierarchyMountsPatch);
  applyUiPatch(runtime, editorTestCatalogPatch);
  applyUiPatch(runtime, matrixDebugSurfacePatch);
  applyUiPatch(runtime, cognitionSceneModelPatch);
  applyUiPatch(runtime, cognitionLifecycleModelPatch);
  applyUiPatch(runtime, promptCatalogPatch);

  ensureLabel(runtime, stateModel, 0, 0, 0, { k: 'selected_model_id', t: 'str', v: '0' });
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
  ensureLabel(runtime, stateModel, 0, 0, 0, { k: 'docs_render_markdown', t: 'str', v: '' });
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
  ensureLabel(runtime, stateModel, 0, 0, 0, { k: FLOW_SHELL_TAB_LABEL, t: 'str', v: FLOW_SHELL_DEFAULT_TAB });
  for (const label of deriveSlidingFlowShellProjectionLabels(null, null)) {
    ensureLabel(runtime, stateModel, 0, 0, 0, label);
  }
  ensureLabel(runtime, stateModel, 0, 0, 0, { k: 'matrix_debug_subject_selected', t: 'str', v: 'trace' });
  ensureLabel(runtime, stateModel, 0, 0, 0, { k: 'matrix_debug_subjects_json', t: 'json', v: [] });
  ensureLabel(runtime, stateModel, 0, 0, 0, { k: 'matrix_debug_readiness_text', t: 'str', v: '' });
  ensureLabel(runtime, stateModel, 0, 0, 0, { k: 'matrix_debug_subject_summary_text', t: 'str', v: '' });
  ensureLabel(runtime, stateModel, 0, 0, 0, { k: 'matrix_debug_trace_summary_text', t: 'str', v: '' });
  ensureLabel(runtime, stateModel, 0, 0, 0, { k: 'matrix_debug_summary_text', t: 'str', v: '' });
  ensureLabel(runtime, stateModel, 0, 0, 0, { k: 'matrix_debug_status_text', t: 'str', v: '' });

  const snapshot = reactive(runtime.snapshot());
  const eventLog = [];
  const routeState = reactive({ path: '/' });
  const adapter = createLocalBusAdapter({ runtime, eventLog, mode: adapterMode, mailboxModelId: EDITOR_MODEL_ID, editorStateModelId: EDITOR_STATE_MODEL_ID });

  function reconcileHomeSelectionState(force = false) {
    const stateModelLive = runtime.getModel(EDITOR_STATE_MODEL_ID);
    if (!stateModelLive) return;
    const uiPage = String(runtime.getLabelValue(stateModelLive, 0, 0, 0, 'ui_page') ?? '').trim().toLowerCase();
    if (uiPage !== 'home') return;
    const selectedModelId = runtime.getLabelValue(stateModelLive, 0, 0, 0, 'selected_model_id');
    if (!force && String(selectedModelId ?? '') === '0') return;
    overwriteLabel(runtime, stateModelLive, 0, 0, 0, { k: 'selected_model_id', t: 'str', v: '0' });
  }

  function refreshSnapshot() {
    const next = runtime.snapshot();
    snapshot.models = next.models;
    snapshot.v1nConfig = next.v1nConfig;
  }

  function setMailboxValue(envelopeOrNull) {
    const model = runtime.getModel(EDITOR_MODEL_ID);
    runtime.addLabel(model, 0, 0, 1, { k: MAILBOX_EVENT_KEY, t: 'event', v: envelopeOrNull });
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
      const validWorkspaceApp = resolveWorkspaceSelection(
        workspaceApps,
        runtime.getLabelValue(stateModelLive, 0, 0, 0, 'ws_app_selected'),
        resolveDefaultWorkspaceAppId(workspaceApps),
      );
      overwriteLabel(runtime, stateModelLive, 0, 0, 0, { k: 'ws_app_selected', t: 'int', v: Number(validWorkspaceApp) });
      overwriteLabel(runtime, stateModelLive, 0, 0, 0, { k: 'ws_app_next_id', t: 'int', v: resolveNextWorkspaceModelId(runtime) });
      const matrixDebug = deriveMatrixDebugView(snap, EDITOR_STATE_MODEL_ID);
      overwriteLabel(runtime, stateModelLive, 0, 0, 0, { k: 'matrix_debug_subjects_json', t: 'json', v: matrixDebug.subjects });
      overwriteLabel(runtime, stateModelLive, 0, 0, 0, { k: 'matrix_debug_subject_selected', t: 'str', v: matrixDebug.selected });
      overwriteLabel(runtime, stateModelLive, 0, 0, 0, { k: 'matrix_debug_readiness_text', t: 'str', v: matrixDebug.readinessText });
      overwriteLabel(runtime, stateModelLive, 0, 0, 0, { k: 'matrix_debug_subject_summary_text', t: 'str', v: matrixDebug.subjectSummaryText });
      overwriteLabel(runtime, stateModelLive, 0, 0, 0, { k: 'matrix_debug_trace_summary_text', t: 'str', v: matrixDebug.traceSummaryText });
      const flowSnap = runtime.snapshot();
      const flowWorkspace = deriveWorkspaceSelected(flowSnap, EDITOR_STATE_MODEL_ID, buildAstFromSchema);
      const flowState = deriveSlidingFlowShellState(flowSnap, EDITOR_STATE_MODEL_ID);
      for (const label of deriveSlidingFlowShellProjectionLabels(flowState, flowWorkspace)) {
        overwriteLabel(runtime, stateModelLive, 0, 0, 0, label);
      }
    }
    const galleryStateModel = runtime.getModel(GALLERY_STATE_MODEL_ID);
    if (galleryStateModel) {
      const slideGallery = deriveSlideGalleryView(snap, GALLERY_STATE_MODEL_ID);
      overwriteLabel(runtime, galleryStateModel, 0, 13, 0, { k: 'gallery_slide_summary_text', t: 'str', v: slideGallery.summaryText });
      overwriteLabel(runtime, galleryStateModel, 0, 14, 0, { k: 'gallery_slide_registry_count_text', t: 'str', v: slideGallery.registryCountText });
      overwriteLabel(runtime, galleryStateModel, 0, 15, 0, { k: 'gallery_slide_models_text', t: 'str', v: slideGallery.modelsText });
      overwriteLabel(runtime, galleryStateModel, 0, 16, 0, { k: 'gallery_slide_creator_status_text', t: 'str', v: slideGallery.creatorStatusText });
      overwriteLabel(runtime, galleryStateModel, 0, 17, 0, { k: 'gallery_slide_last_created_text', t: 'str', v: slideGallery.lastCreatedText });
      overwriteLabel(runtime, galleryStateModel, 0, 18, 0, { k: 'gallery_slide_docs_text', t: 'str', v: slideGallery.docsText });
      overwriteLabel(runtime, galleryStateModel, 0, 19, 0, { k: 'gallery_slide_evidence_local_text', t: 'str', v: slideGallery.localEvidenceText });
      overwriteLabel(runtime, galleryStateModel, 0, 20, 0, { k: 'gallery_slide_evidence_remote_text', t: 'str', v: slideGallery.remoteEvidenceText });
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
      projectCellwiseModel: buildAstFromCellwiseModel,
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
    if (label.p === 0 && label.r === 0 && label.c === 0 && label.k === 'bus_in_event' && label.v && typeof label.v === 'object') {
      const envelope = label.v;
      if (envelope.type !== 'bus_event_v2') {
        throw new Error('invalid_envelope');
      }
      const busInKey = typeof envelope.bus_in_key === 'string' ? envelope.bus_in_key.trim() : '';
      if (!busInKey) {
        throw new Error('invalid_envelope');
      }
      const model0 = runtime.getModel(0);
      const busPayload = normalizeBusEventV2ValueToPinPayload(envelope.value, envelope.meta);
      if (!Array.isArray(busPayload)) {
        throw new Error('invalid_bus_payload');
      }
      const addResult = runtime.addLabel(model0, 0, 0, 0, {
        k: busInKey,
        t: 'pin.bus.in',
        v: busPayload,
      });
      if (!addResult || !addResult.applied) {
        throw new Error('invalid_bus_payload');
      }
      updateDerived();
      refreshSnapshot();
      return;
    }
    if (label.p !== 0 || label.r !== 0 || label.c !== 1) {
      throw new Error('event_mailbox_mismatch');
    }

    const model = runtime.getModel(EDITOR_MODEL_ID);
    const cell = runtime.getCell(model, 0, 0, 1);
    const current = cell.labels.get(MAILBOX_EVENT_KEY);
    if (current && current.v !== null && current.v !== undefined) {
      throw new Error('event_mailbox_full');
    }

    setMailboxValue(label.v);
    refreshSnapshot();
  }

  function dispatchRmLabel(labelRef) {
    if (!labelRef || labelRef.p !== 0 || labelRef.r !== 0 || labelRef.c !== 1) {
      return;
    }
    setMailboxValue(null);
    refreshSnapshot();
  }

  function consumeOnce() {
    const mailboxModel = runtime.getModel(EDITOR_MODEL_ID);
    const mailboxCell = runtime.getCell(mailboxModel, 0, 0, 1);
    const pendingEnvelope = mailboxCell.labels.get(MAILBOX_EVENT_KEY)?.v ?? null;
    const result = adapter.consumeOnce();
    if (shouldResetHomeSelectionFromEnvelope(pendingEnvelope)) {
      reconcileHomeSelectionState(true);
    }
    updateDerived();
    refreshSnapshot();
    return result;
  }

  setMailboxValue(null);
  reconcileHomeSelectionState(true);
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
    buildDispatchLabel: buildBusDispatchLabel,
    buildUiEventV2: buildBusEventV2,
  };
}

export function buildDemoAstSample() {
  const store = createDemoStore({ uiMode: 'v1', adapterMode: 'v1' });
  return store.getUiAst();
}
