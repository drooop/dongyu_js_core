import { reactive } from 'vue';
import { getSnapshotModel, getSnapshotLabelValue, parseSafeInt } from './snapshot_utils.js';

export function createRemoteStore(options) {
  const defaultBaseUrl = (typeof window !== 'undefined' && window.location) ? window.location.origin : 'http://127.0.0.1:9000';
  const baseUrl = options && options.baseUrl ? String(options.baseUrl).replace(/\/$/, '') : defaultBaseUrl;
  const snapshot = reactive({ models: {}, v1nConfig: { local_mqtt: null, global_mqtt: null } });
  const overlayStore = reactive(new Map());

  const EDITOR_MODEL_ID = -1;
  const EDITOR_STATE_MODEL_ID = -2;

  let pauseSse = false;
  let pendingSseSnapshot = null;
  let runtimeActivationPromise = null;

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

  function normalizeCommitPolicy(writeTarget) {
    const raw = writeTarget && typeof writeTarget.commit_policy === 'string'
      ? writeTarget.commit_policy.trim()
      : '';
    if (raw === 'on_change' || raw === 'on_blur' || raw === 'on_submit' || raw === 'immediate') {
      return raw;
    }
    return 'immediate';
  }

  function inferInteractionMode(writeTarget) {
    const explicit = writeTarget && typeof writeTarget.interaction_mode === 'string'
      ? writeTarget.interaction_mode.trim()
      : '';
    if (explicit === 'overlay_then_commit' || explicit === 'committed_direct') return explicit;
    const policy = normalizeCommitPolicy(writeTarget);
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
    return getSnapshotLabelValue(snapshot, ref);
  }

  function stageOverlayValue({ ref, value, writeTarget }) {
    if (!ref || !labelRefKey(ref)) return;
    if (!Number.isInteger(ref.model_id) || ref.model_id === 0 || ref.model_id === EDITOR_MODEL_ID) return;
    if (inferInteractionMode(writeTarget) !== 'overlay_then_commit') return;
    overlayStore.set(labelRefKey(ref), {
      ref,
      value,
      commitPolicy: normalizeCommitPolicy(writeTarget),
      writeTarget: writeTarget || null,
      commitTargetRef: getCommitTargetRef(ref, writeTarget),
      pending: false,
      error: null,
      committedValueKey: null,
      updatedAt: Date.now(),
    });
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

  function applySnapshot(next) {
    if (!next || !next.models) return;
    snapshot.models = next.models;
    snapshot.v1nConfig = next.v1nConfig;
    reconcileOverlayStore();
    pauseSse = computePauseSse(next);
    if (!pauseSse) {
      const pending = pendingSseSnapshot;
      pendingSseSnapshot = null;
      if (pending && pending !== next) applySnapshot(pending);
    }
  }

  function getUiAst() {
    const raw = getSnapshotLabelValue(snapshot, { model_id: EDITOR_MODEL_ID, p: 0, r: 0, c: 0, k: 'ui_ast_v0' });
    if (!raw) return null;
    // Defensive: some producers may store json-typed values as strings.
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : null;
      } catch (_) {
        return null;
      }
    }
    return raw;
  }

  function assertMailboxWriteLabel(label) {
    if (!label || label.t !== 'event') {
      throw new Error('non_event_write');
    }
    if (label.p !== 0 || label.r !== 0 || label.c !== 1 || label.k !== 'ui_event') {
      throw new Error('event_mailbox_mismatch');
    }
    if (!label.v || typeof label.v !== 'object') {
      throw new Error('invalid_envelope');
    }
  }

  function isNegativeLocalStateTarget(target) {
    const modelId = target && Number.isInteger(target.model_id) ? target.model_id : null;
    if (modelId === null) return false;
    return modelId < 0 && modelId !== EDITOR_MODEL_ID;
  }

  function localStateKey(target) {
    return `${target.model_id}:${target.p}:${target.r}:${target.c}:${target.k}`;
  }

  function patchNegativeLocalStateLabel(target, value) {
    const modelId = target && Number.isInteger(target.model_id) ? target.model_id : null;
    if (!isNegativeLocalStateTarget(target)) return;
    if (!target || !Number.isInteger(target.p) || !Number.isInteger(target.r) || !Number.isInteger(target.c) || typeof target.k !== 'string') {
      return;
    }
    if (!value || typeof value.t !== 'string' || !Object.prototype.hasOwnProperty.call(value, 'v')) {
      return;
    }

    let model = getSnapshotModel(snapshot, modelId);
    if (!model) {
      snapshot.models[String(modelId)] = { cells: {} };
      model = snapshot.models[String(modelId)];
    }
    if (!model.cells) {
      model.cells = {};
    }
    const cellKey = `${target.p},${target.r},${target.c}`;
    if (!model.cells[cellKey]) {
      model.cells[cellKey] = { labels: {} };
    }
    const cell = model.cells[cellKey];
    if (!cell.labels) {
      cell.labels = {};
    }
    cell.labels[target.k] = { k: target.k, t: value.t, v: value.v };
  }

  function buildOverlayCommitEnvelope(entry, explicitValue) {
    if (!entry || !entry.commitTargetRef) return null;
    const writeTarget = entry.writeTarget || {};
    const action = typeof writeTarget.action === 'string' && writeTarget.action.trim()
      ? writeTarget.action.trim()
      : 'label_update';
    if (action !== 'label_update' && action !== 'label_add') return null;
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
    if (!payload || typeof payload.action !== 'string') return;
    const action = payload.action;
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

  async function fetchSnapshotAndApply(context) {
    try {
      const resp = await fetch(`${baseUrl}/snapshot`, { credentials: 'same-origin' });
      if (!resp.ok) {
        console.error('snapshot fetch failed', { context, status: resp.status, statusText: resp.statusText });
        return;
      }
      const data = await resp.json();
      if (data && data.snapshot) {
        applySnapshot(data.snapshot);
      } else {
        console.warn('snapshot response missing snapshot', { context });
      }
    } catch (err) {
      console.error('snapshot fetch error', { context, err });
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
          let detail = '';
          try {
            detail = await resp.text();
          } catch (_) {
            // ignore
          }
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
    try {
      resp = await fetch(`${baseUrl}/ui_event`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(envelope),
        credentials: 'same-origin',
      });
    } catch (err) {
      console.error('ui_event fetch error', { err });
      await fetchSnapshotAndApply('ui_event fetch error');
      return null;
    }

    if (!resp.ok) {
      let detail = '';
      try {
        const t = await resp.text();
        detail = t.length > 800 ? `${t.slice(0, 800)}…` : t;
      } catch (_) {
        // ignore
      }
      console.error('ui_event response not ok', { status: resp.status, statusText: resp.statusText, detail });
      await fetchSnapshotAndApply('ui_event response not ok');
      return null;
    }

    const contentType = resp.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      console.error('ui_event response not json', { contentType });
      await fetchSnapshotAndApply('ui_event response not json');
      return null;
    }

    let data;
    try {
      data = await resp.json();
    } catch (err) {
      console.error('ui_event response json parse error', { err });
      await fetchSnapshotAndApply('ui_event response json parse error');
      return null;
    }
    if (data && data.code === 'runtime_not_running' && options.retried !== true) {
      await ensureRuntimeRunning();
      return postEnvelope(envelope, { retried: true });
    }
    if (data && data.snapshot) applySnapshot(data.snapshot);
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
      sendQueue = sendQueue.then(() => postEnvelope(env)).catch(() => {
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
    assertMailboxWriteLabel(label);

    const rawEnvelope = label.v;
    const rawPayload = rawEnvelope && rawEnvelope.payload ? rawEnvelope.payload : null;
    const rawAction = rawPayload && typeof rawPayload.action === 'string' ? rawPayload.action : '';
    const rawTarget = rawPayload && rawPayload.target ? rawPayload.target : null;

    // Remote mode UX mitigation:
    // - Negative UI-local state should update immediately in the browser.
    // - Still sync to server in the background to keep remote runtime state aligned.
    // - Coalesce per-target writes to reduce per-keystroke/per-drag network chatter.
    if (rawAction === 'label_update' && rawTarget && isNegativeLocalStateTarget(rawTarget)) {
      patchNegativeLocalStateLabel(rawTarget, rawPayload.value);
      if (rawTarget && typeof rawTarget.k === 'string') {
        pendingDraftByKey.set(localStateKey(rawTarget), rawEnvelope);
      }
      scheduleDraftFlush();
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

    const resp = await fetch(`${baseUrl}/api/media/upload?filename=${encodeURIComponent(filename)}`, {
      method: 'POST',
      body: file,
      headers: { 'content-type': contentType },
      credentials: 'same-origin',
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data || data.ok !== true || typeof data.uri !== 'string' || data.uri.length === 0) {
      throw new Error(data && data.error ? String(data.error) : 'upload_media_failed');
    }
    return {
      uri: data.uri,
      name: data.name || filename,
      size: Number.isInteger(data.size) ? data.size : null,
      mime: data.mime || contentType,
    };
  }

  async function bootstrap() {
    try {
      const resp = await fetch(`${baseUrl}/snapshot`, { credentials: 'same-origin' });
      const data = await resp.json();
      if (data && data.snapshot) applySnapshot(data.snapshot);
    } catch (_) {
      // allow SSE to recover later
    }

    await ensureRuntimeRunning();

    try {
      const es = new EventSource(`${baseUrl}/stream`, { withCredentials: true });
      es.addEventListener('snapshot', (evt) => {
        try {
          const data = JSON.parse(evt.data);
          if (data && data.snapshot) {
            if (pauseSse) {
              const nextPause = computePauseSse(data.snapshot);
              if (nextPause) {
                pendingSseSnapshot = data.snapshot;
                return;
              }
            }
            applySnapshot(data.snapshot);
          }
        } catch (err) {
          console.warn('sse snapshot parse error', { err });
        }
      });
      es.onerror = (err) => {
        console.error('sse error', { err });
      };
    } catch (_) {
      // ignore
    }
  }

  bootstrap();

  return {
    snapshot,
    getUiAst,
    getEffectiveLabelValue,
    stageOverlayValue,
    commitOverlayValue,
    dispatchAddLabel,
    dispatchRmLabel,
    consumeOnce,
    uploadMedia,
  };
}
