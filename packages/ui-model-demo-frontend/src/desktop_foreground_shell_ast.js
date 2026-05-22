import { DESKTOP_FOREGROUND_SHELL_MODEL_ID } from './model_ids.js';
import { buildAstFromCellwiseModel } from './ui_cellwise_projection.js';

function cloneAst(ast) {
  return ast && typeof ast === 'object' ? JSON.parse(JSON.stringify(ast)) : null;
}

export function buildForegroundShellAst(app, snapshot) {
  const template = buildAstFromCellwiseModel(snapshot, DESKTOP_FOREGROUND_SHELL_MODEL_ID);
  const title = app?.title || app?.id || 'App';
  const subtitle = app?.kind === 'workspace' && Number.isInteger(app?.model_id)
    ? `Workspace app · model ${app.model_id}`
    : 'System app';
  if (!template || typeof template !== 'object') {
    return {
      id: 'desktop_foreground_shell_missing',
      type: 'Text',
      props: { type: 'warning', text: 'Foreground shell cellwise model missing.' },
    };
  }
  const visit = (node) => {
    if (!node || typeof node !== 'object') return node;
    const next = {
      ...node,
      props: node.props && typeof node.props === 'object' ? { ...node.props } : node.props,
      bind: node.bind && typeof node.bind === 'object' ? cloneAst(node.bind) : node.bind,
      children: Array.isArray(node.children) ? node.children.map(visit) : node.children,
    };
    if (next.id === 'desktop_foreground_statusbar_model') {
      next.props = { ...(next.props || {}), title, subtitle };
    }
    if (next.id === 'desktop_app_detail_drawer_text') {
      next.props = {
        ...(next.props || {}),
        text: `id: ${app?.id || 'unknown'}\n${subtitle}`,
      };
    }
    return next;
  };
  return visit(cloneAst(template));
}
