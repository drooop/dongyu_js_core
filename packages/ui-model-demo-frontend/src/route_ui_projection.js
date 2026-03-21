import { normalizeHashPath } from './router.js';
import { deriveWorkspaceSelected } from './editor_page_state_derivers.js';
import { findPageEntryByPath, resolvePageAsset } from './page_asset_resolver.js';
import { EDITOR_STATE_MODEL_ID } from './model_ids.js';

function cloneAst(ast) {
  return ast && typeof ast === 'object' ? JSON.parse(JSON.stringify(ast)) : null;
}

function composeWorkspaceProjection(shellAst, workspace) {
  const selectedAst = workspace && workspace.ast && typeof workspace.ast === 'object'
    ? cloneAst(workspace.ast)
    : {
      id: 'ws_placeholder',
      type: 'Text',
      props: { type: 'info', text: '请从左侧选择一个应用' },
    };
  if (!shellAst || typeof shellAst !== 'object') {
    return selectedAst;
  }

  const visit = (node) => {
    if (!node || typeof node !== 'object') return node;
    const next = {
      ...node,
      props: node.props && typeof node.props === 'object' ? { ...node.props } : node.props,
      children: Array.isArray(node.children) ? node.children.map(visit) : node.children,
    };
    if (next.id === 'ws_right_panel' && next.props && workspace && typeof workspace.title === 'string') {
      next.props.title = workspace.title;
    }
    if (next.id === 'ws_selected_slot') {
      return selectedAst;
    }
    return next;
  };

  return visit(cloneAst(shellAst));
}

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
    const shell = resolvePageAsset(snapshot, {
      pageName,
      projectSchemaModel,
    });
    const workspace = deriveWorkspaceSelected(snapshot, EDITOR_STATE_MODEL_ID, projectSchemaModel);
    return {
      source: 'route_workspace',
      assetType: 'workspace_projection',
      pageName,
      modelId: shell && Number.isInteger(shell.modelId) ? shell.modelId : null,
      ast: composeWorkspaceProjection(shell ? shell.ast : null, workspace),
    };
  }

  return resolvePageAsset(snapshot, {
    pageName,
    projectSchemaModel,
  });
}
