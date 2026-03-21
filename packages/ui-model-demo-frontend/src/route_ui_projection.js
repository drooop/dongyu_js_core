import { normalizeHashPath } from './router.js';
import { deriveWorkspaceSelected } from './editor_page_state_derivers.js';
import { findPageEntryByPath, resolvePageAsset } from './page_asset_resolver.js';
import { EDITOR_STATE_MODEL_ID } from './model_ids.js';

export function resolveRouteUiAst(snapshot, routePath, options = {}) {
  const normalizedPath = normalizeHashPath(routePath);
  const projectSchemaModel = typeof options.projectSchemaModel === 'function'
    ? options.projectSchemaModel
    : null;

  const pageEntry = findPageEntryByPath(snapshot, normalizedPath);
  const pageName = pageEntry && typeof pageEntry.page === 'string' && pageEntry.page.trim()
    ? pageEntry.page.trim().toLowerCase()
    : 'home';

  if (pageName === 'workspace') {
    const workspace = deriveWorkspaceSelected(snapshot, EDITOR_STATE_MODEL_ID, projectSchemaModel);
    return {
      source: 'route_workspace',
      assetType: 'workspace_projection',
      pageName,
      modelId: null,
      ast: workspace.ast,
    };
  }

  return resolvePageAsset(snapshot, {
    pageName,
    projectSchemaModel,
  });
}
