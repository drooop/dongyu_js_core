function safeJsonParse(text) {
  if (typeof text !== 'string' || text.length === 0) return null;
  try {
    return JSON.parse(text);
  } catch (_) {
    return null;
  }
}

export function createMemoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(String(k)) ? map.get(String(k)) : null),
    setItem: (k, v) => {
      map.set(String(k), String(v));
    },
    removeItem: (k) => {
      map.delete(String(k));
    },
    _dump: () => Object.fromEntries(map.entries()),
  };
}

export function createLocalStoragePersister(options) {
  const storageKey = options && options.storageKey ? String(options.storageKey) : 'dy_modeltable_local_v1';
  const storage = options && options.storage ? options.storage : (typeof window !== 'undefined' ? window.localStorage : null);
  const ignoreModelIds = options && options.ignoreModelIds ? options.ignoreModelIds : new Set();
  const ignoreLabelKeys = new Set([
    'ui_event',
    'ui_event_error',
    'ui_event_last_op_id',
    'ui_ast_v0',
    'snapshot_json',
    'event_log',
    // Editor UI ephemeral state.
    'dt_detail_open',
    'dt_detail_title',
    'dt_detail_text',
  ]);

  let enabled = true;
  const state = {
    version: 1,
    models: {},
    labels: {},
  };

  function flush() {
    if (!storage) return;
    if (!enabled) return;
    try {
      storage.setItem(storageKey, JSON.stringify(state));
    } catch (err) {
      // Never break runtime label writes due to persistence failures.
      // Typical causes: storage quota exceeded, circular JSON, storage disabled.
      void err;
    }
  }

  function loadState() {
    if (!storage) return;
    const raw = storage.getItem(storageKey);
    const parsed = safeJsonParse(raw);
    if (!parsed || parsed.version !== 1) return;
    if (parsed.models && typeof parsed.models === 'object') state.models = parsed.models;
    if (parsed.labels && typeof parsed.labels === 'object') state.labels = parsed.labels;
  }

  function labelKey(modelId, p, r, c, k) {
    return `${modelId}:${p},${r},${c}:${k}`;
  }

  function shouldPersistLabel(model, label) {
    if (!enabled) return false;
    if (!storage) return false;
    if (!model || typeof model.id !== 'number') return false;
    if (ignoreModelIds && ignoreModelIds.has(model.id)) return false;
    if (!label || typeof label.k !== 'string') return false;
    if (label.t === 'event') return false;
    if (ignoreLabelKeys.has(label.k)) return false;
    // Avoid persisting very large blobs (can hit localStorage quota quickly).
    if (typeof label.v === 'string' && label.v.length > 20000) return false;
    return true;
  }

  function ensureModel(model) {
    if (!enabled) return;
    if (!storage) return;
    if (!model || typeof model.id !== 'number') return;
    state.models[String(model.id)] = {
      id: model.id,
      name: typeof model.name === 'string' ? model.name : '',
      type: typeof model.type === 'string' ? model.type : '',
    };
    flush();
  }

  function onLabelAdded({ model, p, r, c, label }) {
    if (!shouldPersistLabel(model, label)) return;
    // Make restore robust even if model meta wasn't captured earlier.
    ensureModel(model);
    state.labels[labelKey(model.id, p, r, c, label.k)] = {
      model_id: model.id,
      p,
      r,
      c,
      k: label.k,
      t: label.t,
      v: label.v,
    };
    flush();
  }

  function onLabelRemoved({ model, p, r, c, label }) {
    if (!enabled) return;
    if (!storage) return;
    if (!model || typeof model.id !== 'number') return;
    if (!label || typeof label.k !== 'string') return;
    delete state.labels[labelKey(model.id, p, r, c, label.k)];
    flush();
  }

  function setEnabled(next) {
    enabled = Boolean(next);
  }

  function loadIntoRuntime(runtime) {
    if (!storage) return { ok: false, reason: 'no_storage' };
    if (!runtime) return { ok: false, reason: 'no_runtime' };

    loadState();

    const prev = enabled;
    enabled = false;
    try {
      // If model meta is missing, fall back to creating models based on label records.
      const neededModelIds = new Set();
      for (const rec of Object.values(state.labels)) {
        if (rec && typeof rec.model_id === 'number') {
          if (ignoreModelIds && ignoreModelIds.has(rec.model_id)) continue;
          neededModelIds.add(rec.model_id);
        }
      }

      for (const meta of Object.values(state.models)) {
        if (!meta || typeof meta.id !== 'number') continue;
        if (ignoreModelIds && ignoreModelIds.has(meta.id)) continue;
        if (!runtime.getModel(meta.id)) {
          runtime.createModel({ id: meta.id, name: meta.name || `M${meta.id}`, type: meta.type || 'main' });
        }
      }

      for (const id of neededModelIds) {
        if (ignoreModelIds && ignoreModelIds.has(id)) continue;
        if (!runtime.getModel(id)) {
          const type = id < 0 ? 'ui' : 'main';
          runtime.createModel({ id, name: `M${id}`, type });
        }
      }

      for (const rec of Object.values(state.labels)) {
        if (!rec || typeof rec.model_id !== 'number') continue;
        if (ignoreModelIds && ignoreModelIds.has(rec.model_id)) continue;
        const model = runtime.getModel(rec.model_id);
        if (!model) continue;
        runtime.addLabel(model, rec.p, rec.r, rec.c, { k: rec.k, t: rec.t, v: rec.v });
      }
      return { ok: true };
    } finally {
      enabled = prev;
    }
  }

  return {
    storageKey,
    setEnabled,
    ensureModel,
    onLabelAdded,
    onLabelRemoved,
    loadIntoRuntime,
  };
}
