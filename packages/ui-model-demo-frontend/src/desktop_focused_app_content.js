import { buildAstFromCellwiseModel } from './ui_cellwise_projection.js';

function cloneAst(ast) {
  return ast && typeof ast === 'object' ? JSON.parse(JSON.stringify(ast)) : null;
}

export function buildFocusedWorkspaceAppContentAst(app, snapshot) {
  if (!app || app.page !== 'workspace' || !Number.isInteger(app.model_id)) {
    return null;
  }
  const ast = buildAstFromCellwiseModel(snapshot, app.model_id);
  if (ast && typeof ast === 'object') {
    return cloneAst(ast);
  }
  return {
    id: 'desktop_focused_app_missing_content',
    type: 'Text',
    props: {
      type: 'warning',
      text: `Focused app model ${app.model_id} has no cellwise UI.`,
    },
  };
}
