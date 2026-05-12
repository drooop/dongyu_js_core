import { normalizeHashPath } from './router.js';
import { deriveSlidingFlowShellState, deriveWorkspaceSelected } from './editor_page_state_derivers.js';
import { findPageEntryByPath, resolvePageAsset } from './page_asset_resolver.js';
import { buildAstFromCellwiseModel } from './ui_cellwise_projection.js';
import { EDITOR_STATE_MODEL_ID, FLOW_SHELL_CATALOG_MODEL_ID } from './model_ids.js';
import { DESKTOP_FOREGROUND_APP_LABEL } from './desktop_app_state.js';

function cloneAst(ast) {
  return ast && typeof ast === 'object' ? JSON.parse(JSON.stringify(ast)) : null;
}

function normalizeSelectedChildren(ast) {
  const node = cloneAst(ast);
  if (!node || typeof node !== 'object') {
    return [{
      id: 'sliding_flow_missing_selected_app',
      type: 'Text',
      props: { type: 'warning', text: 'Selected app AST missing.' },
    }];
  }
  if (node.type === 'Root') {
    return Array.isArray(node.children) ? node.children : [];
  }
  return [node];
}

function buildSlidingFlowShellProjectionFromModel(snapshot, workspace) {
  const shellAst = buildAstFromCellwiseModel(snapshot, FLOW_SHELL_CATALOG_MODEL_ID);
  if (!shellAst || typeof shellAst !== 'object') {
    return {
      id: 'sliding_flow_shell_missing',
      type: 'Text',
      props: { type: 'warning', text: 'Sliding Flow Shell cellwise model missing.' },
    };
  }
  const selectedChildren = normalizeSelectedChildren(workspace && workspace.ast);

  const visit = (node) => {
    if (!node || typeof node !== 'object') return node;
    const next = {
      ...node,
      props: node.props && typeof node.props === 'object' ? { ...node.props } : node.props,
      children: Array.isArray(node.children) ? node.children.map(visit) : node.children,
    };
    if (next.id === 'sliding_flow_selected_slot') {
      return {
        ...next,
        children: selectedChildren,
      };
    }
    return next;
  };

  return visit(shellAst);
}

function composeWorkspaceProjection(snapshot, shellAst, workspace, flowState) {
  const selectedAst = workspace && workspace.ast && typeof workspace.ast === 'object'
    ? (
      flowState && flowState.flowCapable
        ? buildSlidingFlowShellProjectionFromModel(snapshot, workspace)
        : cloneAst(workspace.ast)
    )
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

function readEditorStateLabel(snapshot, key) {
  return snapshot?.models?.[String(EDITOR_STATE_MODEL_ID)]?.cells?.['0,0,0']?.labels?.[key]?.v;
}

function normalizeDesktopWorkspaceApps(snapshot) {
  const registry = readEditorStateLabel(snapshot, 'ws_apps_registry');
  if (!Array.isArray(registry)) return [];
  const apps = [];
  const seen = new Set();
  for (const entry of registry) {
    const modelId = entry && Number.isInteger(entry.model_id) ? entry.model_id : null;
    if (!Number.isInteger(modelId) || modelId <= 0 || seen.has(modelId)) continue;
    if (entry.slide_capable !== true) continue;
    seen.add(modelId);
    const title = typeof entry.name === 'string' && entry.name.trim() ? entry.name.trim() : `App ${modelId}`;
    apps.push({
      modelId,
      title,
      surface: typeof entry.slide_surface_type === 'string' && entry.slide_surface_type.trim()
        ? entry.slide_surface_type.trim()
        : 'workspace.page',
    });
  }
  return apps;
}

function buildDesktopWorkspaceAppNode(app) {
  return {
    id: `desktop_slide_app_${app.modelId}`,
    type: 'Button',
    props: {
      label: app.title,
      desktopApp: true,
      appKind: 'workspace',
      modelId: app.modelId,
      surface: app.surface,
    },
    bind: {
      write: {
        action: 'label_update',
        target_ref: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: DESKTOP_FOREGROUND_APP_LABEL },
        value_ref: {
          t: 'json',
          v: {
            id: `workspace:${app.modelId}`,
            kind: 'workspace',
            page: 'workspace',
            path: '/workspace',
            title: app.title,
            model_id: app.modelId,
          },
        },
      },
    },
    children: [],
  };
}

function composeDesktopProjection(snapshot, desktopAst) {
  const ast = cloneAst(desktopAst);
  const apps = normalizeDesktopWorkspaceApps(snapshot);
  if (!ast || typeof ast !== 'object') return ast;
  const appNodes = apps.map(buildDesktopWorkspaceAppNode);

  const visit = (node) => {
    if (!node || typeof node !== 'object') return node;
    const next = {
      ...node,
      props: node.props && typeof node.props === 'object' ? { ...node.props } : node.props,
      children: Array.isArray(node.children) ? node.children.map(visit) : node.children,
    };
    if (next.id === 'desktop_slide_apps') {
      return {
        ...next,
        children: appNodes,
      };
    }
    return next;
  };

  return visit(ast);
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
      projectCellwiseModel: buildAstFromCellwiseModel,
    });
    const workspace = deriveWorkspaceSelected(snapshot, EDITOR_STATE_MODEL_ID, projectSchemaModel);
    const flowState = deriveSlidingFlowShellState(snapshot, EDITOR_STATE_MODEL_ID);
    return {
      source: 'route_workspace',
      assetType: 'workspace_projection',
      pageName,
      modelId: shell && Number.isInteger(shell.modelId) ? shell.modelId : null,
      ast: composeWorkspaceProjection(snapshot, shell ? shell.ast : null, workspace, flowState),
    };
  }

  if (pageName === 'desktop') {
    const desktop = resolvePageAsset(snapshot, {
      pageName,
      projectSchemaModel,
      projectCellwiseModel: buildAstFromCellwiseModel,
    });
    return {
      ...desktop,
      ast: composeDesktopProjection(snapshot, desktop ? desktop.ast : null),
    };
  }

  return resolvePageAsset(snapshot, {
    pageName,
    projectSchemaModel,
    projectCellwiseModel: buildAstFromCellwiseModel,
  });
}
