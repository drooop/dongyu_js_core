import { normalizeHashPath } from './router.js';

function getSnapshotModel(snapshot, modelId) {
  if (!snapshot || !snapshot.models) return null;
  return snapshot.models[modelId] || snapshot.models[String(modelId)] || null;
}

function getStateLabels(snapshot) {
  return snapshot?.models?.['-2']?.cells?.['0,0,0']?.labels ?? {};
}

function readStateValue(snapshot, key) {
  const label = getStateLabels(snapshot)[key];
  return label && Object.prototype.hasOwnProperty.call(label, 'v') ? label.v : undefined;
}

function readUiAstFromModel(snapshot, modelId) {
  const model = getSnapshotModel(snapshot, modelId);
  const root = model && model.cells ? model.cells['0,0,0'] : null;
  const labels = root && root.labels ? root.labels : null;
  const label = labels && labels.ui_ast_v0 ? labels.ui_ast_v0 : null;
  return label && typeof label.v === 'object' ? label.v : null;
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
    if (pageEntry.asset_type === 'ui_ast_model') {
      const ast = readUiAstFromModel(snapshot, pageEntry.model_id);
      if (ast) {
        return { source: 'model_asset', assetType: 'ui_ast_model', pageName, modelId: pageEntry.model_id, ast };
      }
    }
  }

  if (pageEntry && pageEntry.legacy_fallback === false) {
    return { source: 'none', assetType: null, pageName, modelId: null, ast: null };
  }

  return { source: 'none', assetType: null, pageName, modelId: null, ast: null };
}
