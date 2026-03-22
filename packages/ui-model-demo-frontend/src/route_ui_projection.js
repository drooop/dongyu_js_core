import { normalizeHashPath } from './router.js';
import { deriveSlidingFlowShellState, deriveWorkspaceSelected } from './editor_page_state_derivers.js';
import { findPageEntryByPath, resolvePageAsset } from './page_asset_resolver.js';
import { EDITOR_STATE_MODEL_ID, FLOW_SHELL_TAB_LABEL } from './model_ids.js';

function cloneAst(ast) {
  return ast && typeof ast === 'object' ? JSON.parse(JSON.stringify(ast)) : null;
}

function normalizeStatus(statusText) {
  const value = typeof statusText === 'string' ? statusText.trim().toLowerCase() : '';
  if (!value) return 'info';
  if (value === 'ready' || value === 'completed' || value === 'connected' || value === 'online') return 'success';
  if (value === 'running' || value === 'loading' || value === 'submitting' || value === 'inflight') return 'warning';
  if (value === 'failed' || value === 'error' || value === 'send_failed') return 'error';
  if (value === 'offline' || value === 'idle') return 'offline';
  return 'info';
}

function buildSummaryTable(id, rows) {
  return {
    id,
    type: 'Table',
    props: {
      data: Array.isArray(rows) ? rows : [],
      border: true,
      size: 'small',
      stripe: true,
      rowKey: 'key',
    },
    children: [
      {
        id: `${id}_label_col`,
        type: 'TableColumn',
        props: { label: 'Field', prop: 'label', minWidth: 120 },
      },
      {
        id: `${id}_value_col`,
        type: 'TableColumn',
        props: { label: 'Value', prop: 'value', minWidth: 220 },
      },
    ],
  };
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

function buildSlidingFlowShellAst(workspace, flowState) {
  const selectedApp = flowState && flowState.selectedApp ? flowState.selectedApp : {};
  const sceneContext = flowState && flowState.sceneContext ? flowState.sceneContext : {};
  const actionLifecycle = flowState && flowState.actionLifecycle ? flowState.actionLifecycle : {};
  const matrixDebug = flowState && flowState.matrixDebug ? flowState.matrixDebug : {};
  const progress = flowState && flowState.progress ? flowState.progress : { percentage: 0, variant: 'info' };
  const selectedChildren = normalizeSelectedChildren(workspace && workspace.ast);

  return {
    id: 'sliding_flow_root',
    type: 'Container',
    props: {
      layout: 'column',
      gap: 16,
      style: {
        minHeight: '520px',
      },
    },
    children: [
      {
        id: 'sliding_flow_header_card',
        type: 'Card',
        props: {
          title: `Sliding Flow Shell · ${selectedApp.name || `Model ${flowState.selectedModelId}`}`,
        },
        children: [
          {
            id: 'sliding_flow_header_intro',
            type: 'Text',
            props: {
              type: 'info',
              text: `Projection only: reads Model ${flowState.anchorModelId}, Model -12 scene_context, Model -1 action_lifecycle, and Model -100 debug truth. UI tab focus stays on Model -2.`,
            },
          },
        ],
      },
      {
        id: 'sliding_flow_status_row',
        type: 'Container',
        props: { layout: 'row', gap: 12, wrap: true },
        children: [
          {
            id: 'sliding_flow_app_status',
            type: 'StatusBadge',
            props: {
              label: 'APP',
              status: normalizeStatus(selectedApp.status),
              text: selectedApp.status || selectedApp.name || `Model ${flowState.selectedModelId}`,
            },
          },
          {
            id: 'sliding_flow_lifecycle_status',
            type: 'StatusBadge',
            props: {
              label: 'LIFECYCLE',
              status: normalizeStatus(actionLifecycle.status),
              text: actionLifecycle.status || 'idle',
            },
          },
          {
            id: 'sliding_flow_debug_status',
            type: 'StatusBadge',
            props: {
              label: 'DEBUG',
              status: normalizeStatus(matrixDebug.selected),
              text: matrixDebug.selected || 'trace',
            },
          },
        ],
      },
      {
        id: 'sliding_flow_progress',
        type: 'ProgressBar',
        props: {
          percentage: progress.percentage,
          label: sceneContext.active_flow ? `Flow: ${sceneContext.active_flow}` : 'Flow Progress',
          variant: progress.variant,
        },
      },
      {
        id: 'sliding_flow_body',
        type: 'Container',
        props: {
          layout: 'row',
          gap: 16,
          wrap: true,
          style: { alignItems: 'flex-start' },
        },
        children: [
          {
            id: 'sliding_flow_summary_card',
            type: 'Card',
            props: {
              title: 'Process / Debug Summary',
              style: {
                width: '380px',
                flexShrink: 0,
              },
            },
            children: [
              {
                id: 'sliding_flow_tabs',
                type: 'Tabs',
                props: {
                  type: 'card',
                },
                bind: {
                  read: {
                    model_id: EDITOR_STATE_MODEL_ID,
                    p: 0,
                    r: 0,
                    c: 0,
                    k: FLOW_SHELL_TAB_LABEL,
                  },
                  write: {
                    action: 'label_update',
                    target_ref: {
                      model_id: EDITOR_STATE_MODEL_ID,
                      p: 0,
                      r: 0,
                      c: 0,
                      k: FLOW_SHELL_TAB_LABEL,
                    },
                  },
                },
                children: [
                  {
                    id: 'sliding_flow_process_pane',
                    type: 'TabPane',
                    props: {
                      label: 'Process',
                      name: 'process',
                    },
                    children: [
                      {
                        id: 'sliding_flow_process_text',
                        type: 'Text',
                        props: {
                          type: 'info',
                          text: 'Selected app business state plus scene/action lifecycle projection.',
                        },
                      },
                      buildSummaryTable('sliding_flow_process_table', flowState.processSummaryRows),
                    ],
                  },
                  {
                    id: 'sliding_flow_debug_pane',
                    type: 'TabPane',
                    props: {
                      label: 'Debug',
                      name: 'debug',
                    },
                    children: [
                      {
                        id: 'sliding_flow_debug_text',
                        type: 'Text',
                        props: {
                          type: 'info',
                          text: 'Reuses the 0213 matrix debug projection; no debug truth is duplicated here.',
                        },
                      },
                      buildSummaryTable('sliding_flow_debug_table', flowState.debugSummaryRows),
                    ],
                  },
                ],
              },
            ],
          },
          {
            id: 'sliding_flow_app_card',
            type: 'Card',
            props: {
              title: workspace && typeof workspace.title === 'string' ? workspace.title : 'Selected App',
              style: { flex: 1, minWidth: '320px' },
            },
            children: [
              {
                id: 'sliding_flow_app_meta',
                type: 'Text',
                props: {
                  type: 'info',
                  text: `source=${selectedApp.source || 'unknown'} | current_app=${sceneContext.current_app ?? ''} | flow_step=${sceneContext.flow_step ?? 0}`,
                },
              },
              ...selectedChildren,
            ],
          },
        ],
      },
    ],
  };
}

function composeWorkspaceProjection(shellAst, workspace, flowState) {
  const selectedAst = workspace && workspace.ast && typeof workspace.ast === 'object'
    ? (
      flowState && flowState.flowCapable
        ? buildSlidingFlowShellAst(workspace, flowState)
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
    const flowState = deriveSlidingFlowShellState(snapshot, EDITOR_STATE_MODEL_ID);
    return {
      source: 'route_workspace',
      assetType: 'workspace_projection',
      pageName,
      modelId: shell && Number.isInteger(shell.modelId) ? shell.modelId : null,
      ast: composeWorkspaceProjection(shell ? shell.ast : null, workspace, flowState),
    };
  }

  return resolvePageAsset(snapshot, {
    pageName,
    projectSchemaModel,
  });
}
