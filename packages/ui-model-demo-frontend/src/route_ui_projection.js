import { normalizeHashPath } from './router.js';
import { deriveSlidingFlowShellState, deriveWorkspaceSelected } from './editor_page_state_derivers.js';
import { findPageEntryByPath, resolvePageAsset } from './page_asset_resolver.js';
import { buildAstFromCellwiseModel } from './ui_cellwise_projection.js';
import {
  BUILTIN_WORKSPACE_APP_MODEL_IDS,
  EDITOR_STATE_MODEL_ID,
  FLOW_SHELL_CATALOG_MODEL_ID,
  MATRIX_SUITE_APP_MODEL_ID,
  MODELTABLE_APP_MODEL_ID,
  SETTINGS_APP_MODEL_ID,
} from './model_ids.js';
import {
  DESKTOP_APP_MANAGE_MODE_LABEL,
  DESKTOP_APP_VIEW_MODE_LABEL,
  DESKTOP_FOREGROUND_APP_LABEL,
  DESKTOP_TASK_SWITCHER_OPEN_LABEL,
} from './desktop_app_state.js';

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

function normalizeWorkspaceAppTableId(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : 'host';
}

function workspaceAppRefKey(tableId, modelId) {
  return `${normalizeWorkspaceAppTableId(tableId)}|${modelId}`;
}

function workspaceAppNodeSuffix(app) {
  if (normalizeWorkspaceAppTableId(app.tableId) === 'host') return String(app.modelId);
  return `${String(app.tableId || 'host').replace(/[^a-zA-Z0-9_-]+/g, '_')}_${app.modelId}`;
}

function isHostBuiltinWorkspaceApp(modelId, tableId = 'host') {
  return normalizeWorkspaceAppTableId(tableId) === 'host' && BUILTIN_WORKSPACE_APP_MODEL_IDS.includes(modelId);
}

export function normalizeDesktopWorkspaceApps(snapshot) {
  const registry = readEditorStateLabel(snapshot, 'ws_apps_registry');
  if (!Array.isArray(registry)) return [];
  const apps = [];
  const seen = new Set();
  for (const entry of registry) {
    const modelId = entry && Number.isInteger(entry.model_id) ? entry.model_id : null;
    const tableId = normalizeWorkspaceAppTableId(entry?.table_id);
    const appKey = workspaceAppRefKey(tableId, modelId);
    if (!Number.isInteger(modelId) || (tableId === 'host' && modelId === 0) || seen.has(appKey)) continue;
    seen.add(appKey);
    const title = typeof entry.name === 'string' && entry.name.trim() ? entry.name.trim() : `App ${modelId}`;
    const summary = typeof entry.summary === 'string' && entry.summary.trim() ? entry.summary.trim() : '';
    const origin = isHostBuiltinWorkspaceApp(modelId, tableId) ? 'builtin' : 'slid_in';
    if (entry.slide_capable === true && !summary) {
      throw new Error(`slide_capable workspace app ${modelId} missing required slide_app_summary`);
    }
    const sourceDE = origin === 'slid_in'
      ? String(entry.source_de || 'source unknown').trim() || 'source unknown'
      : '';
    apps.push({
      modelId,
      tableId,
      title,
      summary: summary || (origin === 'builtin' ? `${title} built-in app.` : ''),
      origin,
      sourceDE,
      deletable: entry.deletable === true,
      surface: typeof entry.slide_surface_type === 'string' && entry.slide_surface_type.trim()
        ? entry.slide_surface_type.trim()
        : (modelId < 0 ? 'system.page' : 'workspace.page'),
    });
  }
  return apps;
}

function desktopLaunchValueForApp(app) {
  const tableId = typeof app.tableId === 'string' && app.tableId.trim() ? app.tableId.trim() : 'host';
  return {
    id: tableId === 'host' ? `workspace:${app.modelId}` : `workspace:${tableId}:${app.modelId}`,
    kind: 'workspace',
    page: 'workspace',
    path: '/workspace',
    model_id: app.modelId,
    ...(tableId !== 'host' ? { table_id: tableId } : {}),
    title: app.title,
    summary: app.summary,
  };
}

function desktopDeleteValueForApp(app) {
  const tableId = typeof app.tableId === 'string' && app.tableId.trim() ? app.tableId.trim() : 'host';
  return {
    model_id: app.modelId,
    ...(tableId !== 'host' ? { table_id: tableId } : {}),
    title: app.title,
  };
}

function buildDesktopWorkspaceAppNode(app, displayMode = 'cards', manageMode = false) {
  const deletable = app.origin === 'slid_in' && app.deletable === true;
  return {
    id: `desktop_slide_app_${workspaceAppNodeSuffix(app)}`,
    type: 'AppCard',
    props: {
      title: app.title,
      label: app.title,
      summary: app.summary,
      mark: app.title,
      accent: app.origin === 'builtin' ? '#0ea5e9' : (app.modelId === 100 ? '#14b8a6' : '#64748b'),
      desktopApp: true,
      appKind: 'workspace',
      appOrigin: app.origin,
      sourceDE: app.origin === 'slid_in' ? app.sourceDE : '',
      modelId: app.modelId,
      tableId: app.tableId,
      surface: app.surface,
      displayMode,
      density: 'compact',
      sourcePlacement: 'cornerBadge',
      manageMode,
      deletable,
    },
    bind: {
      contextmenu: deletable ? {
        write: {
          action: 'desktop_app_request_delete',
          value_ref: {
            t: 'json',
            v: desktopDeleteValueForApp(app),
          },
        },
      } : null,
      delete: deletable ? {
        write: {
          action: 'desktop_app_request_delete',
          value_ref: {
            t: 'json',
            v: desktopDeleteValueForApp(app),
          },
        },
      } : null,
      write: {
        action: 'label_update',
        target_ref: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: DESKTOP_FOREGROUND_APP_LABEL },
        value_ref: {
          t: 'json',
          v: desktopLaunchValueForApp(app),
        },
      },
    },
    children: [],
  };
}

function composeDesktopProjection(snapshot, desktopAst) {
  const apps = normalizeDesktopWorkspaceApps(snapshot);
  const requestedViewMode = String(readEditorStateLabel(snapshot, DESKTOP_APP_VIEW_MODE_LABEL) || 'cards').trim().toLowerCase();
  const displayMode = requestedViewMode === 'list' ? 'list' : 'cards';
  const manageMode = readEditorStateLabel(snapshot, DESKTOP_APP_MANAGE_MODE_LABEL) === true;
  if (!desktopAst || typeof desktopAst !== 'object') {
    return {
      id: 'desktop_catalog_missing',
      type: 'Text',
      props: { type: 'warning', text: 'Desktop shell cellwise model missing.' },
    };
  }
  const builtinApps = apps.filter((app) => app.origin === 'builtin');
  const slidInApps = apps.filter((app) => app.origin !== 'builtin');
  const matrixApp = apps.find((app) => app.modelId === MATRIX_SUITE_APP_MODEL_ID) || {
    modelId: MATRIX_SUITE_APP_MODEL_ID,
    title: 'Matrix Suite',
    summary: '',
    origin: 'builtin',
    surface: 'workspace.page',
  };

  const visit = (node) => {
    if (!node || typeof node !== 'object') return node;
    const next = {
      ...node,
      props: node.props && typeof node.props === 'object' ? { ...node.props } : node.props,
      bind: node.bind && typeof node.bind === 'object' ? cloneAst(node.bind) : node.bind,
      children: Array.isArray(node.children) ? node.children.map(visit) : node.children,
    };
    if (next.id === 'desktop_builtin_grid') {
      next.props = {
        ...(next.props && typeof next.props === 'object' ? next.props : {}),
        variant: displayMode === 'list' ? 'list' : 'grid',
      };
      next.children = builtinApps.map((app) => buildDesktopWorkspaceAppNode(app, displayMode, manageMode));
    }
    if (next.id === 'desktop_slid_in_grid') {
      next.props = {
        ...(next.props && typeof next.props === 'object' ? next.props : {}),
        variant: displayMode === 'list' ? 'list' : 'grid',
      };
      next.children = slidInApps.map((app) => buildDesktopWorkspaceAppNode(app, displayMode, manageMode));
    }
    if (next.id === 'desktop_taskbar_mb' && next.bind?.write?.value_ref) {
      next.bind.write.value_ref.v = desktopLaunchValueForApp(matrixApp);
    }
    return next;
  };
  return visit(cloneAst(desktopAst));
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
