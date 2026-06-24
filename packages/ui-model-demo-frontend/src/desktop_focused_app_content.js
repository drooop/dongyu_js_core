import { buildAstFromCellwiseModel } from './ui_cellwise_projection.js';

function cloneAst(ast) {
  return ast && typeof ast === 'object' ? JSON.parse(JSON.stringify(ast)) : null;
}

export function buildFocusedWorkspaceAppContentAst(app, snapshot) {
  if (!app || app.page !== 'workspace' || !Number.isInteger(app.model_id)) {
    return null;
  }
  const modelRef = typeof app.table_id === 'string' && app.table_id.trim()
    ? { table_id: app.table_id.trim(), model_id: app.model_id }
    : app.model_id;
  const ast = buildAstFromCellwiseModel(snapshot, modelRef);
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
