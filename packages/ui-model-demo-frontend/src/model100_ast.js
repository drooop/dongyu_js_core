import { MODEL_100_ID } from './model_ids.js';
import { buildAstFromCellwiseModel } from './ui_cellwise_projection.js';

export { MODEL_100_ID };

export function buildModel100Ast(snapshot) {
  return buildAstFromCellwiseModel(snapshot, MODEL_100_ID);
}
