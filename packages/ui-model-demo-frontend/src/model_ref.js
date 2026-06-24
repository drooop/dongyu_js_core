export const HOST_TABLE_ID = 'host';

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function parseSafeModelId(value) {
  if (Number.isSafeInteger(value)) return value;
  if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) {
    const parsed = Number(value.trim());
    return Number.isSafeInteger(parsed) ? parsed : null;
  }
  return null;
}

function normalizeTableId(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function explicitTableId(value) {
  if (!hasOwn(value, 'table_id')) return null;
  const tableId = normalizeTableId(value.table_id);
  if (!tableId) {
    throw new Error('table_id_required');
  }
  return tableId;
}

function currentTableIdFromOptions(options) {
  const current = options && options.currentModelRef
    ? normalizeModelRef(options.currentModelRef, { allowBareHost: false })
    : null;
  return current ? current.table_id : null;
}

function currentModelIdFromOptions(options) {
  const current = options && options.currentModelRef
    ? normalizeModelRef(options.currentModelRef, { allowBareHost: false })
    : null;
  return current ? current.model_id : null;
}

export function normalizeModelRef(value, options = {}) {
  const allowBareHost = options.allowBareHost !== false;
  const defaultTableId = normalizeTableId(options.defaultTableId);

  if (Number.isSafeInteger(value) || typeof value === 'string') {
    const modelId = parseSafeModelId(value);
    if (!Number.isSafeInteger(modelId)) {
      throw new Error('model_id_required');
    }
    if (!allowBareHost && !defaultTableId) {
      throw new Error('table_id_required');
    }
    return {
      table_id: defaultTableId || HOST_TABLE_ID,
      model_id: modelId,
    };
  }

  if (!isPlainObject(value)) {
    throw new Error('model_ref_required');
  }

  const modelId = parseSafeModelId(value.model_id);
  if (!Number.isSafeInteger(modelId)) {
    throw new Error('model_id_required');
  }

  const explicit = explicitTableId(value);
  const currentTableId = currentTableIdFromOptions(options);
  const tableId = explicit || currentTableId || defaultTableId || (allowBareHost ? HOST_TABLE_ID : null);
  if (!tableId) {
    throw new Error('table_id_required');
  }

  return {
    table_id: tableId,
    model_id: modelId,
  };
}

export function modelRefKey(value, options = {}) {
  const ref = normalizeModelRef(value, options);
  return JSON.stringify([ref.table_id, ref.model_id]);
}

export function normalizeLabelRef(ref, options = {}) {
  if (!isPlainObject(ref)) {
    throw new Error('label_ref_required');
  }
  if (!Number.isInteger(ref.p) || !Number.isInteger(ref.r) || !Number.isInteger(ref.c) || typeof ref.k !== 'string') {
    throw new Error('label_ref_required');
  }

  const currentTableId = currentTableIdFromOptions(options);
  const currentModelId = currentModelIdFromOptions(options);
  const hasExplicitModelId = hasOwn(ref, 'model_id');
  const modelId = parseSafeModelId(ref.model_id);
  if (hasExplicitModelId && !Number.isSafeInteger(modelId)) {
    throw new Error('model_id_required');
  }
  const resolvedModelId = Number.isSafeInteger(modelId) ? modelId : currentModelId;
  const explicit = explicitTableId(ref);
  if (explicit && !hasExplicitModelId) {
    throw new Error('model_id_required');
  }
  if (!Number.isSafeInteger(resolvedModelId)) {
    throw new Error('current_model_ref_required');
  }

  const allowBareHost = options.allowBareHost !== false;
  const defaultTableId = normalizeTableId(options.defaultTableId);
  const tableId = explicit || currentTableId || defaultTableId || (allowBareHost ? HOST_TABLE_ID : null);
  if (!tableId) {
    throw new Error('table_id_required');
  }

  return {
    table_id: tableId,
    model_id: resolvedModelId,
    p: ref.p,
    r: ref.r,
    c: ref.c,
    k: ref.k,
  };
}

export function labelRefKey(ref, options = {}) {
  const normalized = normalizeLabelRef(ref, options);
  return JSON.stringify([
    normalized.table_id,
    normalized.model_id,
    normalized.p,
    normalized.r,
    normalized.c,
    normalized.k,
  ]);
}
