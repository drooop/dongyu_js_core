import { reactive } from 'vue';
import { getSnapshotModel, getSnapshotLabelValue, parseSafeInt } from './snapshot_utils.js';
import { buildAstFromSchema } from './ui_schema_projection.js';
import { resolveRouteUiAst } from './route_ui_projection.js';
import { buildBusDispatchLabel, buildBusEventV2 } from './bus_event_v2.js';
import { createProjectionStore } from './projection_store.js';
import {
  DESKTOP_FOREGROUND_APP_LABEL,
  DESKTOP_TASK_STACK_LABEL,
  deriveDesktopTaskStack,
  normalizeDesktopForegroundApp,
} from './desktop_app_state.js';

const BUS_EVENT_ENDPOINT_PATH = '/bus_event';
const UI_EVENT_ENDPOINT_PATH = '/ui_event';

function cloneSnapshotJson(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function parseCellKey(cellKey) {
  const parts = String(cellKey || '').split(',').map((part) => Number.parseInt(part, 10));
  if (parts.length !== 3 || parts.some((part) => !Number.isInteger(part))) return { p: 0, r: 0, c: 0 };
  return { p: parts[0], r: parts[1], c: parts[2] };
}

function ensurePatchModel(snapshot, modelId) {
  const modelKey = String(modelId);
  if (!snapshot.models[modelKey]) {
    snapshot.models[modelKey] = { id: Number.isInteger(Number(modelKey)) ? Number(modelKey) : modelId, cells: {} };
  }
  if (!snapshot.models[modelKey].cells) snapshot.models[modelKey].cells = {};
  return snapshot.models[modelKey];
}

function ensurePatchCell(model, cellKey) {
  if (!model.cells[cellKey]) {
    model.cells[cellKey] = { ...parseCellKey(cellKey), labels: {} };
  }
  if (!model.cells[cellKey].labels) model.cells[cellKey].labels = {};
  return model.cells[cellKey];
}

export function applyClientSnapshotPatch(baseSnapshot, patch) {
  if (!patch || patch.patch_kind !== 'json_replace_v1' || !Array.isArray(patch.ops)) {
    throw new Error('invalid_snapshot_patch');
  }
  const next = cloneSnapshotJson(baseSnapshot && baseSnapshot.models ? baseSnapshot : { models: {}, v1nConfig: {} });
  if (!next.models) next.models = {};
  for (const op of patch.ops) {
    if (!op || typeof op.op !== 'string') throw new Error('invalid_snapshot_patch_op');
    if (op.op === 'replace_v1n_config') {
      next.v1nConfig = cloneSnapshotJson(op.value);
      continue;
    }
    const modelKey = String(op.model_id);
    if (op.op === 'delete_model') {
      delete next.models[modelKey];
      continue;
    }
    if (op.op === 'replace_model') {
      next.models[modelKey] = cloneSnapshotJson(op.value);
      continue;
    }
    const model = ensurePatchModel(next, op.model_id);
    const cellKey = String(op.cell_key || '');
    if (!cellKey) throw new Error('invalid_snapshot_patch_cell');
    if (op.op === 'delete_cell') {
      delete model.cells[cellKey];
      continue;
    }
    if (op.op === 'replace_cell') {
      model.cells[cellKey] = cloneSnapshotJson(op.value);
      continue;
    }
    const labelKey = String(op.label_key || '');
    if (!labelKey) throw new Error('invalid_snapshot_patch_label');
    const cell = ensurePatchCell(model, cellKey);
    if (op.op === 'delete_label') {
      delete cell.labels[labelKey];
      continue;
    }
    if (op.op === 'replace_label') {
      cell.labels[labelKey] = cloneSnapshotJson(op.value);
      continue;
    }
    throw new Error(`unsupported_snapshot_patch_op:${op.op}`);
  }
  if (!Object.prototype.hasOwnProperty.call(next, 'v1nConfig')) next.v1nConfig = {};
  return next;
}

export function createRemoteStore(options) {
  const defaultBaseUrl = (typeof window !== 'undefined' && window.location) ? window.location.origin : 'http://127.0.0.1:9000';
  const baseUrl = options && options.baseUrl ? String(options.baseUrl).replace(/\/$/, '') : defaultBaseUrl;
  const authStore = options && options.authStore ? options.authStore : null;
  const snapshot = reactive({ models: {}, v1nConfig: { local_mqtt: null, global_mqtt: null } });
  const projectionStore = createProjectionStore();
  const overlayStore = reactive(new Map());
  const pendingUiStateById = reactive(new Map());

  const EDITOR_MODEL_ID = -1;
  const EDITOR_STATE_MODEL_ID = -2;
  const MGMT_BUS_CONSOLE_MODEL_ID = 1036;
  const MGMT_BUS_CONSOLE_LOCAL_STATE_KEYS = new Set([
    'selected_subject',
    'selected_subject_id',
    'selected_event_id',
    'subject_filter',
    'timeline_filter',
    'timeline_sort',
    'inspector_tab',
    'composer_draft',
    'composer_action',
    'target_user_id',
    'last_refresh_requested_at',
    'last_ui_error',
  ]);

  let pauseSse = false;
  let pendingSseSnapshot = null;
  let runtimeActivationPromise = null;
  const routeState = reactive({ path: '/' });
  const pendingLocalStateByKey = new Map();
  let deferredSnapshotFallbackTimer = null;
  let deferredSnapshotFallbackContext = '';
  let deferredSnapshotFallbackExpectedOpId = '';
  let lastSnapshotBusEventOpId = '';
  let currentSnapshotSeq = 0;
  let eventSource = null;
  let eventSourceUrl = '';
  const visibleModelIds = new Set();
  const snapshotFallbackDelayMs = Number.isFinite(options && options.snapshotFallbackDelayMs)
    ? Math.max(0, Number(options.snapshotFallbackDelayMs))
    : 300;

  function visibleModelIdList() {
    return [...visibleModelIds].filter((modelId) => Number.isInteger(modelId)).sort((a, b) => a - b);
  }

  function normalizeVisibleModelId(modelId) {
    if (Number.isInteger(modelId)) return modelId;
    const parsed = Number.parseInt(String(modelId ?? '').trim(), 10);
    return Number.isInteger(parsed) ? parsed : null;
  }

  function buildSnapshotUrl({ profile = 'bootstrap', modelIds = null } = {}) {
    const query = new URLSearchParams();
    query.set('profile', profile);
    const ids = Array.isArray(modelIds) ? modelIds : visibleModelIdList();
    const key = profile === 'visible' ? 'model_id' : 'visible_model_id';
    for (const modelId of ids) {
      if (Number.isInteger(modelId)) query.append(key, String(modelId));
    }
    return `${baseUrl}/snapshot?${query.toString()}`;
  }

  function buildStreamUrl() {
    const query = new URLSearchParams();
    query.set('profile', 'bootstrap');
    for (const modelId of visibleModelIdList()) {
      query.append('visible_model_id', String(modelId));
    }
    return `${baseUrl}/stream?${query.toString()}`;
  }

  function hasSnapshotModel(modelId) {
    const normalized = normalizeVisibleModelId(modelId);
    if (!Number.isInteger(normalized)) return false;
    return Boolean(snapshot.models && snapshot.models[String(normalized)]);
  }

  function getVisibleSubscriptionState() {
    return {
      visibleModelIds: visibleModelIdList(),
      expectedStreamUrl: buildStreamUrl(),
      eventSourceUrl,
      eventSourceReadyState: eventSource && Number.isInteger(eventSource.readyState) ? eventSource.readyState : null,
    };
  }

  function labelRefKey(ref) {
    if (!ref || !Number.isInteger(ref.model_id) || !Number.isInteger(ref.p) || !Number.isInteger(ref.r) || !Number.isInteger(ref.c) || typeof ref.k !== 'string') {
      return '';
    }
    return `${ref.model_id}:${ref.p}:${ref.r}:${ref.c}:${ref.k}`;
  }

  function stableValueKey(value) {
    if (value === null || value === undefined) return '__nil__';
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
    try {
      return JSON.stringify(value);
    } catch (_) {
      return String(value);
    }
  }

  function readBusEventLastOpIdFromSnapshot(targetSnapshot) {
    const value = getSnapshotLabelValue(targetSnapshot, {
      model_id: EDITOR_MODEL_ID,
      p: 0,
      r: 0,
      c: 1,
      k: 'bus_event_last_op_id',
    });
    return typeof value === 'string' ? value.trim() : '';
  }

  function readEnvelopeOpId(envelope) {
    const payload = envelope && envelope.payload && typeof envelope.payload === 'object'
      ? envelope.payload
      : null;
    const meta = payload && payload.meta && typeof payload.meta === 'object'
      ? payload.meta
      : (envelope && envelope.meta && typeof envelope.meta === 'object' ? envelope.meta : null);
    const opId = meta && typeof meta.op_id === 'string' ? meta.op_id.trim() : '';
    return opId;
  }

  function nowClientPerfMs() {
    const perf = globalThis && globalThis.performance && typeof globalThis.performance.now === 'function'
      ? globalThis.performance.now()
      : NaN;
    return Number.isFinite(perf) ? perf : Date.now();
  }

  function augmentResponseTiming(data, startedAt, startedPerfMs) {
    if (!data || typeof data !== 'object' || !data.timing || typeof data.timing !== 'object') return data;
    const receivedAt = Date.now();
    const receivedPerfMs = nowClientPerfMs();
    data.timing = {
      ...data.timing,
      client_post_started_at: Number.isFinite(startedAt) ? startedAt : null,
      client_post_started_perf_ms: Number.isFinite(startedPerfMs) ? startedPerfMs : null,
      client_response_received_at: receivedAt,
      client_response_received_perf_ms: receivedPerfMs,
      client_roundtrip_ms: Number.isFinite(startedPerfMs)
        ? Math.max(0, Math.round((receivedPerfMs - startedPerfMs) * 1000) / 1000)
        : null,
    };
    return data;
  }

  function normalizeCommitPolicy(writeTarget, fallback = 'immediate') {
    const persistRaw = writeTarget && typeof writeTarget.persist_policy === 'string'
      ? writeTarget.persist_policy.trim()
      : '';
    if (persistRaw === 'never' || persistRaw === 'submit') return 'on_submit';
    if (persistRaw === 'debounce') return 'on_change';
    if (persistRaw === 'realtime') return 'immediate';
    const raw = writeTarget && typeof writeTarget.commit_policy === 'string'
      ? writeTarget.commit_policy.trim()
      : '';
    if (raw === 'on_change' || raw === 'on_blur' || raw === 'on_submit' || raw === 'immediate') {
      return raw;
    }
    return fallback;
  }

  function inferInteractionMode(writeTarget, fallback = 'immediate') {
    const explicit = writeTarget && typeof writeTarget.interaction_mode === 'string'
      ? writeTarget.interaction_mode.trim()
      : '';
    if (explicit === 'overlay_then_commit' || explicit === 'committed_direct') return explicit;
    const policy = normalizeCommitPolicy(writeTarget, fallback);
    return policy === 'immediate' ? 'committed_direct' : 'overlay_then_commit';
  }

  function inferTypedValue(raw) {
    if (typeof raw === 'boolean') return { t: 'bool', v: raw };
    if (typeof raw === 'number' && Number.isSafeInteger(raw)) return { t: 'int', v: raw };
    if (typeof raw === 'string') return { t: 'str', v: raw };
    return { t: 'json', v: raw };
  }

  function getCommitTargetRef(ref, writeTarget) {
    const explicit = writeTarget && writeTarget.commit_target_ref && typeof writeTarget.commit_target_ref === 'object'
      ? writeTarget.commit_target_ref
      : null;
    if (explicit && labelRefKey(explicit)) return explicit;
    const targetRef = writeTarget && writeTarget.target_ref && typeof writeTarget.target_ref === 'object'
      ? writeTarget.target_ref
      : null;
    if (targetRef && labelRefKey(targetRef)) return targetRef;
    return ref && labelRefKey(ref) ? ref : null;
  }

  function getOverlayEntry(ref) {
    const key = labelRefKey(ref);
    if (!key) return null;
    return overlayStore.get(key) || null;
  }

  function clearOverlayEntry(ref) {
    const key = labelRefKey(ref);
    if (!key) return;
    overlayStore.delete(key);
  }

  function getEffectiveLabelValue(ref) {
    const key = labelRefKey(ref);
    if (key && overlayStore.has(key)) {
      return overlayStore.get(key).value;
    }
    const projected = projectionStore.getLabelValue(ref);
    return projected !== undefined ? projected : getSnapshotLabelValue(snapshot, ref);
  }

  function stageOverlayValue({ ref, value, writeTarget, fallbackCommitPolicy = 'immediate' }) {
    if (!ref || !labelRefKey(ref)) return;
    if (!Number.isInteger(ref.model_id) || ref.model_id === 0 || ref.model_id === EDITOR_MODEL_ID) return;
    if (inferInteractionMode(writeTarget, fallbackCommitPolicy) !== 'overlay_then_commit') return;
    overlayStore.set(labelRefKey(ref), {
      ref,
      value,
      commitPolicy: normalizeCommitPolicy(writeTarget, fallbackCommitPolicy),
      writeTarget: writeTarget || null,
      commitTargetRef: getCommitTargetRef(ref, writeTarget),
      pending: false,
      error: null,
      committedValueKey: null,
      updatedAt: Date.now(),
    });
  }

  function pendingStateKey(stateId) {
    const key = String(stateId || '').trim();
    return key || '';
  }

  function setPendingState(stateId, value) {
    const key = pendingStateKey(stateId);
    if (!key) return null;
    const next = {
      ...(value && typeof value === 'object' ? value : {}),
      pending: Boolean(value && value.pending === true),
      updatedAt: Date.now(),
    };
    pendingUiStateById.set(key, next);
    return next;
  }

  function getPendingState(stateId) {
    const key = pendingStateKey(stateId);
    if (!key) return null;
    return pendingUiStateById.get(key) || null;
  }

  function resolvePendingState(stateId, result = null) {
    const key = pendingStateKey(stateId);
    if (!key) return null;
    const current = pendingUiStateById.get(key) || {};
    const next = {
      ...current,
      pending: false,
      result,
      resolvedAt: Date.now(),
      updatedAt: Date.now(),
    };
    pendingUiStateById.set(key, next);
    return next;
  }

  function clearPendingState(stateId) {
    const key = pendingStateKey(stateId);
    if (!key) return false;
    return pendingUiStateById.delete(key);
  }

  function reconcileOverlayStore() {
    for (const [key, entry] of overlayStore.entries()) {
      if (!entry || !entry.pending || !entry.commitTargetRef) continue;
      const committedValue = getSnapshotLabelValue(snapshot, entry.commitTargetRef);
      if (stableValueKey(committedValue) === entry.committedValueKey) {
        overlayStore.delete(key);
      }
    }
  }

  function computePauseSse(next) {
    const v = getSnapshotLabelValue(next, { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'dt_pause_sse' });
    if (v === true || v === false) return v;
    if (typeof v === 'string') {
      const t = v.trim().toLowerCase();
      if (t === 'true') return true;
      if (t === 'false') return false;
    }
    return false;
  }

  function applySnapshot(next, metadata = {}) {
    if (!next || !next.models) return;
    if (deferredSnapshotFallbackTimer) {
      const nextOpId = readBusEventLastOpIdFromSnapshot(next);
      if (deferredSnapshotFallbackExpectedOpId && nextOpId === deferredSnapshotFallbackExpectedOpId) {
        clearTimeout(deferredSnapshotFallbackTimer);
        deferredSnapshotFallbackTimer = null;
        deferredSnapshotFallbackContext = '';
        deferredSnapshotFallbackExpectedOpId = '';
      }
    }
    lastSnapshotBusEventOpId = readBusEventLastOpIdFromSnapshot(next);
    if (metadata && metadata.snapshot_patch) {
      projectionStore.applySnapshotPatch(metadata.snapshot_patch);
    } else {
      projectionStore.hydrateSnapshot(next, metadata);
    }
    overlayPendingLocalState(next);
    snapshot.models = next.models;
    snapshot.v1nConfig = next.v1nConfig;
    if (Number.isInteger(metadata?.snapshot_seq)) {
      currentSnapshotSeq = metadata.snapshot_seq;
    }
    reconcileOverlayStore();
    pauseSse = computePauseSse(next);
    if (!pauseSse) {
      const pending = pendingSseSnapshot;
      pendingSseSnapshot = null;
      if (pending && pending !== next) {
        if (pending.snapshot) applySnapshot(pending.snapshot, pending.metadata || {});
        else applySnapshot(pending);
      }
    }
  }

  function mergeSnapshotWithCurrentModels(next, options = {}) {
    if (!next || !next.models) return next;
    const preserveExistingModels = Boolean(options && options.preserveExistingModels);
    const mergedModels = { ...(snapshot.models || {}) };
    for (const [modelId, model] of Object.entries(next.models || {})) {
      if (preserveExistingModels && Object.prototype.hasOwnProperty.call(mergedModels, modelId)) continue;
      mergedModels[modelId] = model;
    }
    return {
      ...next,
      models: mergedModels,
      v1nConfig: Object.prototype.hasOwnProperty.call(next, 'v1nConfig') ? next.v1nConfig : snapshot.v1nConfig,
    };
  }

  function forgetSnapshotModel(modelId) {
    const normalized = normalizeVisibleModelId(modelId);
    if (!Number.isInteger(normalized)) return;
    const modelKey = String(normalized);
    if (!snapshot.models || !Object.prototype.hasOwnProperty.call(snapshot.models, modelKey)) return;
    const nextModels = { ...snapshot.models };
    delete nextModels[modelKey];
    snapshot.models = nextModels;
    try {
      projectionStore.applySnapshotPatch({
        patch_kind: 'json_replace_v1',
        snapshot_seq: currentSnapshotSeq,
        ops: [{ op: 'delete_model', model_id: normalized }],
      });
    } catch (err) {
      console.warn('failed to forget stale visible model from projection store', { modelId: normalized, err });
    }
  }

  function applySnapshotPatchEnvelope(patch) {
    if (!patch || patch.patch_kind !== 'json_replace_v1') throw new Error('invalid_snapshot_patch');
    if (!Number.isInteger(patch.snapshot_seq) || !Number.isInteger(patch.base_snapshot_seq)) {
      throw new Error('invalid_snapshot_patch_seq');
    }
    const baseSnapshot = pendingSseSnapshot && pendingSseSnapshot.snapshot
      ? pendingSseSnapshot.snapshot
      : { models: snapshot.models, v1nConfig: snapshot.v1nConfig };
    const baseSnapshotSeq = pendingSseSnapshot && pendingSseSnapshot.metadata && Number.isInteger(pendingSseSnapshot.metadata.snapshot_seq)
      ? pendingSseSnapshot.metadata.snapshot_seq
      : currentSnapshotSeq;
    if (baseSnapshotSeq <= 0 || patch.base_snapshot_seq !== baseSnapshotSeq) {
      throw new Error('snapshot_patch_base_mismatch');
    }
    const next = applyClientSnapshotPatch(baseSnapshot, patch);
    if (pauseSse) {
      const nextPause = computePauseSse(next);
      if (nextPause) {
        pendingSseSnapshot = { snapshot: next, metadata: { snapshot_seq: patch.snapshot_seq } };
        return;
      }
      pendingSseSnapshot = null;
    }
    applySnapshot(next, { snapshot_seq: patch.snapshot_seq, snapshot_patch: patch });
  }

  function notifyAuthFailure(resp, data, returnTo) {
    const error = data && (data.error || data.code) ? (data.error || data.code) : '';
    if (resp && (
      resp.status === 401
      || resp.status === 403
      || error === 'login_required'
      || error === 'not_authenticated'
      || error === 'permission_denied'
      || error === 'matrix_session_missing'
    )) {
      if (authStore && typeof authStore.handleAuthFailure === 'function') {
        authStore.handleAuthFailure({
          error: error || (resp.status === 401 ? 'login_required' : 'permission_denied'),
          returnTo: data && data.returnTo ? data.returnTo : returnTo,
          requiredCapability: data && data.requiredCapability ? data.requiredCapability : '',
        });
      }
      return true;
    }
    return false;
  }

  function canSyncLocalState() {
    if (!authStore || !authStore.state) return true;
    return authStore.state.authenticated === true;
  }

  async function readJsonOrText(resp) {
    const text = await resp.text().catch(() => '');
    if (!text) return { data: {}, detail: '' };
    try {
      return { data: JSON.parse(text), detail: text };
    } catch (_) {
      return { data: {}, detail: text };
    }
  }

  function getUiAst(routePathOverride) {
    const resolved = resolveRouteUiAst(snapshot, routePathOverride || routeState.path, { projectSchemaModel: buildAstFromSchema });
    return resolved && resolved.ast && typeof resolved.ast === 'object' ? resolved.ast : null;
  }

  function setRoutePath(routePath) {
    routeState.path = typeof routePath === 'string' && routePath.trim().length > 0 ? routePath : '/';
  }

  function assertDispatchLabel(label) {
    if (!label || label.t !== 'event') {
      throw new Error('non_event_write');
    }
    const isLegacyMailbox = label.p === 0 && label.r === 0 && label.c === 1;
    const isV2Dispatch = label.p === 0 && label.r === 0 && label.c === 0 && label.k === 'bus_in_event';
    if (!isLegacyMailbox && !isV2Dispatch) {
      throw new Error('event_dispatch_mismatch');
    }
    if (!label.v || typeof label.v !== 'object') {
      throw new Error('invalid_envelope');
    }
  }

  function isNegativeLocalStateTarget(target) {
    const modelId = target && Number.isInteger(target.model_id) ? target.model_id : null;
    if (modelId === null) return false;
    if (
      modelId === MGMT_BUS_CONSOLE_MODEL_ID
      && target.p === 0
      && target.r === 0
      && target.c === 0
      && MGMT_BUS_CONSOLE_LOCAL_STATE_KEYS.has(target.k)
    ) {
      return true;
    }
    return modelId < 0 && modelId !== EDITOR_MODEL_ID;
  }

  function localStateKey(target) {
    return `${target.model_id}:${target.p}:${target.r}:${target.c}:${target.k}`;
  }

  function patchSnapshotLocalStateLabel(target, value, targetSnapshot = snapshot) {
    const modelId = target && Number.isInteger(target.model_id) ? target.model_id : null;
    if (modelId === null) return null;
    if (!target || !Number.isInteger(target.p) || !Number.isInteger(target.r) || !Number.isInteger(target.c) || typeof target.k !== 'string') {
      return null;
    }
    if (!value || typeof value.t !== 'string' || !Object.prototype.hasOwnProperty.call(value, 'v')) {
      return null;
    }

    if (!targetSnapshot.models) targetSnapshot.models = {};
    let model = getSnapshotModel(targetSnapshot, modelId);
    if (!model) {
      targetSnapshot.models[String(modelId)] = { cells: {} };
      model = targetSnapshot.models[String(modelId)];
    }
    if (!model.cells) model.cells = {};
    const cellKey = `${target.p},${target.r},${target.c}`;
    if (!model.cells[cellKey]) model.cells[cellKey] = { labels: {} };
    const cell = model.cells[cellKey];
    if (!cell.labels) cell.labels = {};
    cell.labels[target.k] = { k: target.k, t: value.t, v: value.v };
    projectionStore.applySnapshotPatch({
      patch_kind: 'json_replace_v1',
      snapshot_seq: currentSnapshotSeq,
      base_snapshot_seq: currentSnapshotSeq,
      ops: [{
        op: 'replace_label',
        model_id: target.model_id,
        cell_key: cellKey,
        label_key: target.k,
        value: cell.labels[target.k],
      }],
    });
    return cell;
  }

  function overlayPendingLocalState(next) {
    if (!next || !next.models || pendingLocalStateByKey.size === 0) return;
    for (const [key, entry] of Array.from(pendingLocalStateByKey.entries())) {
      if (!entry?.target || !entry?.value) {
        pendingLocalStateByKey.delete(key);
        continue;
      }
      const committed = getSnapshotLabelValue(next, entry.target);
      if (stableValueKey(committed) === stableValueKey(entry.value.v)) {
        pendingLocalStateByKey.delete(key);
        continue;
      }
      patchSnapshotLocalStateLabel(entry.target, entry.value, next);
    }
  }

  function buildDerivedLocalStateEnvelope(rawEnvelope, target, value, suffix) {
    const payload = rawEnvelope && typeof rawEnvelope === 'object' ? rawEnvelope.payload : null;
    const meta = payload && typeof payload.meta === 'object' && payload.meta ? payload.meta : {};
    const baseOpId = typeof meta.op_id === 'string' && meta.op_id.trim() ? meta.op_id.trim() : `local_${Date.now()}`;
    return {
      event_id: Date.now(),
      type: 'label_update',
      source: rawEnvelope && typeof rawEnvelope.source === 'string' ? rawEnvelope.source : 'ui_renderer',
      ts: rawEnvelope && Number.isFinite(rawEnvelope.ts) ? rawEnvelope.ts : 0,
      payload: {
        action: 'label_update',
        meta: {
          ...meta,
          op_id: `${baseOpId}_${suffix}`,
          derived_from_op_id: baseOpId,
        },
        target,
        value,
      },
    };
  }

  function patchNegativeLocalStateLabel(target, value) {
    const modelId = target && Number.isInteger(target.model_id) ? target.model_id : null;
    if (!isNegativeLocalStateTarget(target)) return [];
    const cell = patchSnapshotLocalStateLabel(target, value, snapshot);
    if (!cell) return [];
    if (modelId === EDITOR_STATE_MODEL_ID && target.k === DESKTOP_FOREGROUND_APP_LABEL) {
      const currentStack = cell.labels[DESKTOP_TASK_STACK_LABEL]?.v;
      const nextStack = deriveDesktopTaskStack(currentStack, value.v);
      cell.labels[DESKTOP_TASK_STACK_LABEL] = {
        k: DESKTOP_TASK_STACK_LABEL,
        t: 'json',
        v: nextStack,
      };
      return [{
        target: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: DESKTOP_TASK_STACK_LABEL },
        value: { t: 'json', v: nextStack },
        suffix: 'desktop_task_stack',
      }];
    }
    return [];
  }

  function deriveShellLocalStateWrites(rawTarget, rawValue) {
    const writes = [];
    if (!rawTarget || !rawValue || rawTarget.model_id !== EDITOR_STATE_MODEL_ID || rawTarget.k !== DESKTOP_FOREGROUND_APP_LABEL) {
      return writes;
    }
    const app = normalizeDesktopForegroundApp(rawValue.v);
    if (!app || app.page !== 'workspace' || !Number.isInteger(app.model_id)) {
      return writes;
    }
    writes.push({
      target: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'ws_app_selected' },
      value: { t: 'int', v: app.model_id },
      suffix: 'desktop_ws_app_selected',
    });
    writes.push({
      target: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'selected_model_id' },
      value: { t: 'str', v: String(app.model_id) },
      suffix: 'desktop_selected_model_id',
    });
    return writes;
  }

  function buildOverlayCommitEnvelope(entry, explicitValue) {
    if (!entry || !entry.commitTargetRef) return null;
    const writeTarget = entry.writeTarget || {};
    const action = typeof writeTarget.action === 'string' && writeTarget.action.trim()
      ? writeTarget.action.trim()
      : 'label_update';
    if (action !== 'label_update' && action !== 'label_add' && action !== 'ui_owner_label_update') return null;
    const opId = `overlay_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const typedValue = inferTypedValue(explicitValue !== undefined ? explicitValue : entry.value);
    const payload = {
      action,
      meta: {
        op_id: opId,
        overlay_commit: true,
        model_id: entry.commitTargetRef.model_id,
      },
      target: entry.commitTargetRef,
      value: typedValue,
    };
    return {
      event_id: Date.now(),
      type: action,
      source: 'ui_renderer',
      ts: 0,
      payload,
    };
  }

  async function commitOverlayValue({ ref, writeTarget, value }) {
    const key = labelRefKey(ref);
    if (!key) return null;
    const entry = overlayStore.get(key);
    if (!entry) return null;
    const effectiveWriteTarget = writeTarget || entry.writeTarget;
    const envelope = buildOverlayCommitEnvelope({ ...entry, writeTarget: effectiveWriteTarget }, value);
    if (!envelope) return null;
    entry.pending = true;
    entry.error = null;
    entry.writeTarget = effectiveWriteTarget || null;
    entry.commitTargetRef = getCommitTargetRef(ref, effectiveWriteTarget);
    entry.committedValueKey = stableValueKey(inferTypedValue(value !== undefined ? value : entry.value).v);
    overlayStore.set(key, entry);
    sendQueue = sendQueue.then(() => postEnvelope(envelope)).then((data) => {
      if (!data || data.result === 'error') {
        const current = overlayStore.get(key);
        if (current) {
          current.pending = false;
          current.error = data && data.code ? data.code : 'commit_failed';
          overlayStore.set(key, current);
        }
      } else {
        reconcileOverlayStore();
      }
      return data;
    }).catch((err) => {
      const current = overlayStore.get(key);
      if (current) {
        current.pending = false;
        current.error = String(err && err.message ? err.message : err);
        overlayStore.set(key, current);
      }
      return null;
    });
    return sendQueue;
  }

  async function flushSubmitOverlaysForEnvelope(rawEnvelope) {
    const payload = rawEnvelope && rawEnvelope.payload ? rawEnvelope.payload : null;
    const action = payload && typeof payload.action === 'string' ? payload.action : '';
    const pin = payload && typeof payload.pin === 'string' ? payload.pin : '';
    const isBusEventV2 = rawEnvelope && rawEnvelope.type === 'bus_event_v2';
    if (!action && !pin && !isBusEventV2) return;
    if (action === 'label_update' || action === 'label_add') return;
    for (const [key, entry] of overlayStore.entries()) {
      if (!entry || entry.pending) continue;
      if (entry.commitPolicy !== 'on_submit') continue;
      if (!entry.commitTargetRef) continue;
      const envelope = buildOverlayCommitEnvelope(entry);
      if (!envelope) continue;
      entry.pending = true;
      entry.error = null;
      entry.committedValueKey = stableValueKey(inferTypedValue(entry.value).v);
      overlayStore.set(key, entry);
      const data = await postEnvelope(envelope);
      if (!data || data.result === 'error') {
        entry.pending = false;
        entry.error = data && data.code ? data.code : 'commit_failed';
        overlayStore.set(key, entry);
      } else {
        reconcileOverlayStore();
      }
    }
  }

  function getEditorState() {
    const base = { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0 };
    const selectedModelId = parseSafeInt(getSnapshotLabelValue(snapshot, { ...base, k: 'selected_model_id' })) ?? 1;
    const draftP = parseSafeInt(getSnapshotLabelValue(snapshot, { ...base, k: 'draft_p' })) ?? 0;
    const draftR = parseSafeInt(getSnapshotLabelValue(snapshot, { ...base, k: 'draft_r' })) ?? 0;
    const draftC = parseSafeInt(getSnapshotLabelValue(snapshot, { ...base, k: 'draft_c' })) ?? 0;
    const draftK = String(getSnapshotLabelValue(snapshot, { ...base, k: 'draft_k' }) ?? '').trim() || 'title';
    const draftT = String(getSnapshotLabelValue(snapshot, { ...base, k: 'draft_t' }) ?? 'str');

    const draftText = String(getSnapshotLabelValue(snapshot, { ...base, k: 'draft_v_text' }) ?? '');
    const draftInt = getSnapshotLabelValue(snapshot, { ...base, k: 'draft_v_int' });
    const draftBool = getSnapshotLabelValue(snapshot, { ...base, k: 'draft_v_bool' });

    const valueT = ['str', 'int', 'bool', 'json'].includes(draftT) ? draftT : 'str';
    let valueV = draftText;
    if (valueT === 'int') {
      valueV = typeof draftInt === 'number' ? draftInt : (parseSafeInt(draftInt) ?? 0);
    } else if (valueT === 'bool') {
      if (draftBool === true || draftBool === false) valueV = draftBool;
      else if (typeof draftBool === 'string') {
        const trimmed = draftBool.trim();
        if (trimmed === 'true') valueV = true;
        else if (trimmed === 'false') valueV = false;
        else valueV = false;
      } else {
        valueV = false;
      }
    } else if (valueT === 'json') {
      valueV = draftText;
    }

    return { selectedModelId, draftP, draftR, draftC, draftK, valueT, valueV };
  }

  function rewriteEditorActionEnvelope(envelope) {
    if (!envelope || !envelope.payload || typeof envelope.payload.action !== 'string') return envelope;
    const action = envelope.payload.action;
    if (!['label_add', 'label_update', 'label_remove', 'cell_clear'].includes(action)) return envelope;

    // If target is explicitly provided, do not rewrite it.
    // This is required for app-shell level controls (like routing) that target editor_state labels.
    if (envelope.payload.target && typeof envelope.payload.target === 'object') {
      return envelope;
    }

    const s = getEditorState();
    const target = { model_id: s.selectedModelId, p: s.draftP, r: s.draftR, c: s.draftC };
    if (action !== 'cell_clear') {
      target.k = s.draftK;
    }
    envelope.payload.target = target;
    if (action === 'label_add' || action === 'label_update') {
      envelope.payload.value = { t: s.valueT, v: s.valueV };
    }
    return envelope;
  }

  async function fetchSnapshotAndApply(context, options = {}) {
    try {
      const resp = await fetch(buildSnapshotUrl(options), { credentials: 'same-origin' });
      if (!resp.ok) {
        const failureBody = await resp.json().catch(() => ({}));
        if (options && typeof options.onFailure === 'function') {
          options.onFailure({ status: resp.status, statusText: resp.statusText, body: failureBody });
        }
        console.error('snapshot fetch failed', {
          context,
          status: resp.status,
          statusText: resp.statusText,
          error: failureBody && (failureBody.error || failureBody.code) ? (failureBody.error || failureBody.code) : '',
        });
        return false;
      }
      const data = await resp.json();
      if (data && data.snapshot) {
        const mergeWithCurrentModels = Boolean(options && options.mergeWithCurrentModels);
        const staleMergedSnapshot = mergeWithCurrentModels
          && Number.isInteger(data.snapshot_seq)
          && data.snapshot_seq < currentSnapshotSeq;
        const nextSnapshot = mergeWithCurrentModels
          ? mergeSnapshotWithCurrentModels(data.snapshot, { preserveExistingModels: staleMergedSnapshot })
          : data.snapshot;
        const nextMetadata = staleMergedSnapshot
          ? { ...data, snapshot_seq: currentSnapshotSeq, stale_snapshot_seq: data.snapshot_seq }
          : data;
        applySnapshot(nextSnapshot, nextMetadata);
        return true;
      } else {
        console.warn('snapshot response missing snapshot', { context });
      }
    } catch (err) {
      console.error('snapshot fetch error', { context, err });
    }
    return false;
  }

  function refreshSnapshot(context = 'manual refresh') {
    return fetchSnapshotAndApply(context);
  }

  async function ensureVisibleModelLoaded(modelId) {
    const normalized = normalizeVisibleModelId(modelId);
    if (!Number.isInteger(normalized)) {
      throw new Error('invalid_visible_model_id');
    }
    if (hasSnapshotModel(normalized)) {
      visibleModelIds.add(normalized);
      connectEventSource();
      return true;
    }
    visibleModelIds.add(normalized);
    let visibleFailure = null;
    const ok = await fetchSnapshotAndApply(`visible model lazy load ${normalized}`, {
      profile: 'visible',
      modelIds: visibleModelIdList(),
      mergeWithCurrentModels: true,
      onFailure: (failure) => { visibleFailure = failure; },
    });
    if (!ok) {
      const hadOtherVisibleIds = visibleModelIds.size > 1;
      const failureCode = visibleFailure && visibleFailure.body
        ? (visibleFailure.body.error || visibleFailure.body.code || '')
        : '';
      const staleVisibleFailure = visibleFailure?.status === 404
        || failureCode === 'model_not_found'
        || failureCode === 'model_not_visible';
      if (hadOtherVisibleIds && staleVisibleFailure) {
        const previousVisibleIds = visibleModelIdList().filter((modelId) => modelId !== normalized);
        const retryOk = await fetchSnapshotAndApply(`visible model lazy load ${normalized} retry target-only after stale ids`, {
          profile: 'visible',
          modelIds: [normalized],
          mergeWithCurrentModels: true,
        });
        if (retryOk && hasSnapshotModel(normalized)) {
          visibleModelIds.clear();
          for (const previousId of previousVisibleIds) {
            const keepOk = await fetchSnapshotAndApply(`visible model ${previousId} revalidate after stale ids`, {
              profile: 'visible',
              modelIds: [previousId],
              mergeWithCurrentModels: true,
            });
            if (keepOk && hasSnapshotModel(previousId)) {
              visibleModelIds.add(previousId);
            } else {
              forgetSnapshotModel(previousId);
            }
          }
          visibleModelIds.add(normalized);
          connectEventSource();
          return true;
        }
      }
      visibleModelIds.delete(normalized);
      connectEventSource();
      return false;
    }
    connectEventSource();
    return hasSnapshotModel(normalized);
  }

  function scheduleSnapshotFallback(context, expectedOpId = '') {
    deferredSnapshotFallbackContext = context || 'bus event v2 deferred fallback';
    deferredSnapshotFallbackExpectedOpId = expectedOpId || '';
    if (deferredSnapshotFallbackTimer) return;
    deferredSnapshotFallbackTimer = setTimeout(() => {
      const nextContext = deferredSnapshotFallbackContext || 'bus event v2 deferred fallback';
      deferredSnapshotFallbackTimer = null;
      deferredSnapshotFallbackContext = '';
      deferredSnapshotFallbackExpectedOpId = '';
      fetchSnapshotAndApply(nextContext);
    }, snapshotFallbackDelayMs);
    if (
      deferredSnapshotFallbackTimer
      && typeof deferredSnapshotFallbackTimer === 'object'
      && typeof deferredSnapshotFallbackTimer.unref === 'function'
    ) {
      deferredSnapshotFallbackTimer.unref();
    }
  }

  async function ensureRuntimeRunning() {
    if (runtimeActivationPromise) return runtimeActivationPromise;
    runtimeActivationPromise = (async () => {
      try {
        const resp = await fetch(`${baseUrl}/api/runtime/mode`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ mode: 'running' }),
          credentials: 'same-origin',
        });
        if (!resp.ok) {
          const { data, detail } = await readJsonOrText(resp);
          notifyAuthFailure(resp, data, '/api/runtime/mode');
          console.error('runtime activation failed', { status: resp.status, statusText: resp.statusText, detail });
        }
      } catch (err) {
        console.error('runtime activation fetch error', { err });
      }
      await fetchSnapshotAndApply('runtime activation');
    })().finally(() => {
      runtimeActivationPromise = null;
    });
    return runtimeActivationPromise;
  }

  async function postEnvelope(envelope, options = {}) {
    let resp;
    const endpointPath = typeof options.endpointPath === 'string' && options.endpointPath
      ? options.endpointPath
      : BUS_EVENT_ENDPOINT_PATH;
    const clientPostStartedAt = Date.now();
    const clientPostStartedPerfMs = nowClientPerfMs();
    try {
      resp = await fetch(`${baseUrl}${endpointPath}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(envelope),
        credentials: 'same-origin',
      });
    } catch (err) {
      console.error('bus event fetch error', { err });
      await fetchSnapshotAndApply('bus event fetch error');
      return null;
    }

    if (!resp.ok) {
      const { data, detail: rawDetail } = await readJsonOrText(resp);
      notifyAuthFailure(resp, data, data.returnTo || endpointPath);
      const detail = rawDetail.length > 800 ? `${rawDetail.slice(0, 800)}…` : rawDetail;
      console.error('bus event response not ok', { status: resp.status, statusText: resp.statusText, detail });
      await fetchSnapshotAndApply('bus event response not ok');
      return null;
    }

    const contentType = resp.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      console.error('bus event response not json', { contentType });
      await fetchSnapshotAndApply('bus event response not json');
      return null;
    }

    let data;
    try {
      data = await resp.json();
    } catch (err) {
      console.error('bus event response json parse error', { err });
      await fetchSnapshotAndApply('bus event response json parse error');
      return null;
    }
    augmentResponseTiming(data, clientPostStartedAt, clientPostStartedPerfMs);
    if (data && data.result === 'error') {
      if (data.code === 'matrix_session_missing' && authStore && typeof authStore.fetchMatrixStatus === 'function') {
        const refreshed = await authStore.fetchMatrixStatus();
        if (!refreshed && authStore && typeof authStore.handleAuthFailure === 'function') {
          authStore.handleAuthFailure({ error: data.code, returnTo: endpointPath });
        }
      } else {
        notifyAuthFailure(resp, data, endpointPath);
      }
    }
    if (data && data.code === 'runtime_not_running' && options.retried !== true) {
      await ensureRuntimeRunning();
      return postEnvelope(envelope, { ...options, retried: true });
    }
    if (data && data.snapshot) {
      applySnapshot(data.snapshot, data);
    } else if (
      endpointPath === BUS_EVENT_ENDPOINT_PATH
      && envelope
      && envelope.type === 'bus_event_v2'
      && data
    ) {
      if (data.result === 'error') {
        await fetchSnapshotAndApply('bus event v2 error fallback');
      } else {
        const expectedOpId = typeof data.bus_event_last_op_id === 'string' && data.bus_event_last_op_id.trim()
          ? data.bus_event_last_op_id.trim()
          : readEnvelopeOpId(envelope);
        if (!expectedOpId || lastSnapshotBusEventOpId !== expectedOpId) {
          scheduleSnapshotFallback('bus event v2 deferred response fallback', expectedOpId);
        }
      }
    }
    return data;
  }

  let sendQueue = Promise.resolve();
  const pendingDraftByKey = new Map();
  let draftTimer = null;

  function flushDraftsNow() {
    if (draftTimer) {
      clearTimeout(draftTimer);
      draftTimer = null;
    }
    const drafts = Array.from(pendingDraftByKey.values());
    pendingDraftByKey.clear();
    for (const env of drafts) {
      sendQueue = sendQueue.then(() => postEnvelope(env, { endpointPath: UI_EVENT_ENDPOINT_PATH })).then((data) => {
        if (data && data.result === 'error') return data;
        return data;
      }).catch(() => {
        // keep queue alive
      });
    }
  }

  function scheduleDraftFlush() {
    if (draftTimer) return;
    draftTimer = setTimeout(() => {
      draftTimer = null;
      flushDraftsNow();
    }, 200);
  }

  function dispatchAddLabel(label) {
    assertDispatchLabel(label);

    const rawEnvelope = label.v;
    if (rawEnvelope && rawEnvelope.type === 'bus_event_v2') {
      sendQueue = sendQueue.then(async () => {
        await flushSubmitOverlaysForEnvelope(rawEnvelope);
        return postEnvelope(rawEnvelope);
      }).catch(() => {
        // keep queue alive
      });
      return sendQueue;
    }
    const rawPayload = rawEnvelope && rawEnvelope.payload ? rawEnvelope.payload : null;
    const rawAction = rawPayload && typeof rawPayload.action === 'string' ? rawPayload.action : '';
    const rawTarget = rawPayload && rawPayload.target ? rawPayload.target : null;

    // Remote mode UX mitigation:
    // - Negative UI-local state should update immediately in the browser.
    // - Still sync to server in the background to keep remote runtime state aligned.
    // - Coalesce per-target writes to reduce per-keystroke/per-drag network chatter.
    if (rawAction === 'label_update' && rawTarget && isNegativeLocalStateTarget(rawTarget)) {
      const syncLocalState = canSyncLocalState();
      const derivedWrites = [
        ...patchNegativeLocalStateLabel(rawTarget, rawPayload.value),
        ...deriveShellLocalStateWrites(rawTarget, rawPayload.value),
      ];
      if (rawTarget && typeof rawTarget.k === 'string') {
        const key = localStateKey(rawTarget);
        pendingLocalStateByKey.set(key, { target: rawTarget, value: rawPayload.value });
        if (syncLocalState) {
          pendingDraftByKey.set(key, rawEnvelope);
        }
      }
      for (const derivedWrite of derivedWrites) {
        if (!derivedWrite?.target || !derivedWrite?.value) continue;
        patchSnapshotLocalStateLabel(derivedWrite.target, derivedWrite.value, snapshot);
        const key = localStateKey(derivedWrite.target);
        pendingLocalStateByKey.set(key, { target: derivedWrite.target, value: derivedWrite.value });
        if (!syncLocalState) continue;
        pendingDraftByKey.set(
          key,
          buildDerivedLocalStateEnvelope(rawEnvelope, derivedWrite.target, derivedWrite.value, derivedWrite.suffix || 'derived'),
        );
      }
      if (syncLocalState) scheduleDraftFlush();
      return;
    }

    // Non-label_update action (e.g. static_project_upload, docs_search, etc.):
    // Force-flush all pending draft writes FIRST so the server state is up-to-date
    // before processing the action. Without this, the action might read stale labels.
    flushDraftsNow();

    const envelope = rewriteEditorActionEnvelope(rawEnvelope);

    sendQueue = sendQueue.then(async () => {
      await flushSubmitOverlaysForEnvelope(rawEnvelope);
      return postEnvelope(envelope);
    }).catch(() => {
      // keep queue alive
    });
    return sendQueue;
  }

  function dispatchRmLabel(_labelRef) {
    // server consumer clears mailbox; no-op
  }

  function consumeOnce() {
    return { consumed: false };
  }

  async function uploadMedia(input) {
    const file = input && Object.prototype.hasOwnProperty.call(input, 'file') ? input.file : null;
    if (!file) {
      throw new Error('missing_file');
    }
    const filename = input && typeof input.filename === 'string' && input.filename.trim().length > 0
      ? input.filename.trim()
      : 'upload.bin';
    const contentType = input && typeof input.contentType === 'string' && input.contentType.trim().length > 0
      ? input.contentType.trim()
      : 'application/octet-stream';
    const uploadPurpose = input && input.meta && typeof input.meta.upload_purpose === 'string'
      ? input.meta.upload_purpose.trim()
      : '';
    const query = new URLSearchParams({ filename });
    if (uploadPurpose) query.set('purpose', uploadPurpose);

    const resp = await fetch(`${baseUrl}/api/media/upload?${query.toString()}`, {
      method: 'POST',
      body: file,
      headers: { 'content-type': contentType },
      credentials: 'same-origin',
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data || data.ok !== true || typeof data.uri !== 'string' || data.uri.length === 0) {
      notifyAuthFailure(resp, data, '/api/media/upload');
      throw new Error(data && data.error ? String(data.error) : 'upload_media_failed');
    }
    return {
      uri: data.uri,
      name: data.name || filename,
      size: Number.isInteger(data.size) ? data.size : null,
      mime: data.mime || contentType,
    };
  }

  function closeEventSource() {
    if (!eventSource) return;
    try {
      eventSource.close();
    } catch (_) {
      // ignore stale browser EventSource handles
    }
    eventSource = null;
    eventSourceUrl = '';
  }

  function connectEventSource() {
    if (typeof EventSource !== 'function') return;
    const nextUrl = buildStreamUrl();
    if (eventSource && eventSourceUrl === nextUrl && eventSource.readyState !== 2) return;
    closeEventSource();
    try {
      const es = new EventSource(nextUrl, { withCredentials: true });
      eventSource = es;
      eventSourceUrl = nextUrl;
      es.addEventListener('snapshot', (evt) => {
        try {
          const data = JSON.parse(evt.data);
          if (data && data.snapshot) {
            if (pauseSse) {
              const nextPause = computePauseSse(data.snapshot);
              if (nextPause) {
                pendingSseSnapshot = { snapshot: data.snapshot, metadata: data };
                return;
              }
            }
            applySnapshot(data.snapshot, data);
          }
        } catch (err) {
          console.warn('sse snapshot parse error', { err });
        }
      });
      es.addEventListener('snapshot_patch', (evt) => {
        try {
          const data = JSON.parse(evt.data);
          if (data && data.snapshot_patch) {
            applySnapshotPatchEnvelope(data.snapshot_patch);
          }
        } catch (err) {
          console.warn('sse snapshot_patch apply error', { err });
          fetchSnapshotAndApply('snapshot patch recovery');
        }
      });
      es.onerror = (err) => {
        console.error('sse error', { err });
      };
    } catch (_) {
      // ignore
    }
  }

  async function bootstrap() {
    await fetchSnapshotAndApply('bootstrap startup');
    connectEventSource();
  }

  if (!options || options.autoBootstrap !== false) {
    bootstrap();
  }

  return {
    snapshot,
    projectionStore,
    getUiAst,
    setRoutePath,
    getEffectiveLabelValue,
    stageOverlayValue,
    commitOverlayValue,
    setPendingState,
    getPendingState,
    resolvePendingState,
    clearPendingState,
    dispatchAddLabel,
    dispatchRmLabel,
    consumeOnce,
    uploadMedia,
    ensureRuntimeRunning,
    refreshSnapshot,
    hasSnapshotModel,
    getVisibleSubscriptionState,
    ensureVisibleModelLoaded,
    buildDispatchLabel: buildBusDispatchLabel,
    buildUiEventV2: buildBusEventV2,
  };
}
