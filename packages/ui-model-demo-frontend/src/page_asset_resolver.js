import { normalizeHashPath } from './router.js';
import { getSnapshotLabelValue } from './snapshot_utils.js';

function getStateLabels(snapshot) {
  return snapshot?.models?.['-2']?.cells?.['0,0,0']?.labels ?? {};
}

function readStateValue(snapshot, key) {
  const label = getStateLabels(snapshot)[key];
  return label && Object.prototype.hasOwnProperty.call(label, 'v') ? label.v : undefined;
}

function normalizeAssetJson(rawValue) {
  if (rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue)) {
    return rawValue;
  }
  if (typeof rawValue !== 'string') return null;
  try {
    const parsed = JSON.parse(rawValue);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch (_) {
    return null;
  }
}

function normalizeAssetRef(modelId, assetRef) {
  if (!Number.isInteger(modelId) || !assetRef || typeof assetRef !== 'object') return null;
  if (!Number.isInteger(assetRef.p) || !Number.isInteger(assetRef.r) || !Number.isInteger(assetRef.c) || typeof assetRef.k !== 'string') {
    return null;
  }
  return {
    model_id: modelId,
    p: assetRef.p,
    r: assetRef.r,
    c: assetRef.c,
    k: assetRef.k,
  };
}

function readModelLabelAsset(snapshot, modelId, assetRef) {
  const ref = normalizeAssetRef(modelId, assetRef);
  if (!ref) return null;
  return normalizeAssetJson(getSnapshotLabelValue(snapshot, ref));
}

export function readPageCatalog(snapshot) {
  const raw = readStateValue(snapshot, 'ui_page_catalog_json');
  return Array.isArray(raw) ? raw : [];
}

export function findPageEntry(snapshot, pageName) {
  const catalog = readPageCatalog(snapshot);
  return catalog.find((entry) => entry && entry.page === pageName) || null;
}

export function findPageEntryByPath(snapshot, routePath) {
  const normalized = normalizeHashPath(routePath);
  const catalog = readPageCatalog(snapshot);
  return catalog.find((entry) => entry && typeof entry.path === 'string' && normalizeHashPath(entry.path) === normalized) || null;
}

export function resolvePageAsset(snapshot, options = {}) {
  const pageName = typeof options.pageName === 'string'
    ? options.pageName
    : String(readStateValue(snapshot, 'ui_page') ?? '').trim().toLowerCase();
  const projectSchemaModel = typeof options.projectSchemaModel === 'function'
    ? options.projectSchemaModel
    : null;

  const pageEntry = findPageEntry(snapshot, pageName);
  if (pageEntry && Number.isInteger(pageEntry.model_id)) {
    if (pageEntry.asset_type === 'schema_model' && projectSchemaModel) {
      const ast = projectSchemaModel(snapshot, pageEntry.model_id);
      if (ast) {
        return { source: 'model_asset', assetType: 'schema_model', pageName, modelId: pageEntry.model_id, ast };
      }
    }
    if (pageEntry.asset_type === 'model_label') {
      const ast = readModelLabelAsset(snapshot, pageEntry.model_id, pageEntry.asset_ref);
      if (ast) {
        return { source: 'model_asset', assetType: 'model_label', pageName, modelId: pageEntry.model_id, ast };
      }
    }
  }

  if (pageEntry && pageEntry.legacy_fallback === false) {
    return { source: 'none', assetType: null, pageName, modelId: null, ast: null };
  }

  return { source: 'none', assetType: null, pageName, modelId: null, ast: null };
}
