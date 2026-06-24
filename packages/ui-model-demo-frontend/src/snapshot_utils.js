import { HOST_TABLE_ID, normalizeLabelRef, normalizeModelRef } from './model_ref.js';

export function getSnapshotModel(snapshot, modelRef, options = {}) {
  if (!snapshot) return null;
  const ref = normalizeModelRef(modelRef, {
    defaultTableId: HOST_TABLE_ID,
    ...options,
  });
  const table = snapshot.tables && snapshot.tables[ref.table_id];
  if (table && table.models) {
    return table.models[ref.model_id] || table.models[String(ref.model_id)] || null;
  }
  if (ref.table_id === HOST_TABLE_ID && snapshot.models) {
    return snapshot.models[ref.model_id] || snapshot.models[String(ref.model_id)] || null;
  }
  return null;
}

export function getSnapshotLabelValue(snapshot, ref, options = {}) {
  const labelRef = normalizeLabelRef(ref, {
    defaultTableId: HOST_TABLE_ID,
    ...options,
  });
  const model = getSnapshotModel(snapshot, labelRef);
  if (!model || !model.cells) return undefined;
  const key = `${labelRef.p},${labelRef.r},${labelRef.c}`;
  const cell = model.cells[key];
  if (!cell || !cell.labels) return undefined;
  const label = cell.labels[labelRef.k];
  if (!label) return undefined;
  return label.v;
}

export function parseSafeInt(value) {
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
