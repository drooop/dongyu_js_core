import { reactive } from 'vue';

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

export function createRemoteStore(options) {
  const defaultBaseUrl = (typeof window !== 'undefined' && window.location) ? window.location.origin : 'http://127.0.0.1:9000';
  const baseUrl = options && options.baseUrl ? String(options.baseUrl).replace(/\/$/, '') : defaultBaseUrl;
  const snapshot = reactive({ models: {}, v1nConfig: { local_mqtt: null, global_mqtt: null } });

  const EDITOR_MODEL_ID = -1;
  const EDITOR_STATE_MODEL_ID = -2;

  let pauseSse = false;
  let pendingSseSnapshot = null;

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

  function patchEditorStateLabel(target, value) {
    const modelId = target && Number.isInteger(target.model_id) ? target.model_id : null;
    if (modelId !== EDITOR_STATE_MODEL_ID) return;
    if (!target || !Number.isInteger(target.p) || !Number.isInteger(target.r) || !Number.isInteger(target.c) || typeof target.k !== 'string') {
      return;
    }
    if (!value || typeof value.t !== 'string' || !Object.prototype.hasOwnProperty.call(value, 'v')) {
      return;
    }

    const model = getSnapshotModel(snapshot, EDITOR_STATE_MODEL_ID);
    if (!model || !model.cells) return;
    const cellKey = `${target.p},${target.r},${target.c}`;
    const cell = model.cells[cellKey];
    if (!cell || !cell.labels) return;
    cell.labels[target.k] = { k: target.k, t: value.t, v: value.v };
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
      const resp = await fetch(`${baseUrl}/snapshot`);
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

  async function postEnvelope(envelope) {
    let resp;
    try {
      resp = await fetch(`${baseUrl}/ui_event`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(envelope),
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
    // - Draft edits live in editor_state (model -2). Apply optimistically for input responsiveness.
    // - Coalesce draft writes to reduce per-keystroke network chatter.
    if (rawAction === 'label_update' && rawTarget && rawTarget.model_id === EDITOR_STATE_MODEL_ID) {
      patchEditorStateLabel(rawTarget, rawPayload.value);
      if (rawTarget && typeof rawTarget.k === 'string') {
        pendingDraftByKey.set(rawTarget.k, rawEnvelope);
      }
      scheduleDraftFlush();
      return;
    }

    // Non-label_update action (e.g. static_project_upload, docs_search, etc.):
    // Force-flush all pending draft writes FIRST so the server state is up-to-date
    // before processing the action. Without this, the action might read stale labels.
    flushDraftsNow();

    const envelope = rewriteEditorActionEnvelope(rawEnvelope);

    sendQueue = sendQueue.then(() => postEnvelope(envelope)).catch(() => {
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

  async function bootstrap() {
    try {
      const resp = await fetch(`${baseUrl}/snapshot`);
      const data = await resp.json();
      if (data && data.snapshot) applySnapshot(data.snapshot);
    } catch (_) {
      // allow SSE to recover later
    }

    try {
      const es = new EventSource(`${baseUrl}/stream`);
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
    dispatchAddLabel,
    dispatchRmLabel,
    consumeOnce,
  };
}
