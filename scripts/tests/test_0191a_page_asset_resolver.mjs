#!/usr/bin/env node

import assert from 'node:assert/strict';
import { buildAstFromSchema } from '../../packages/ui-model-demo-frontend/src/ui_schema_projection.js';
import { buildAstFromCellwiseModel } from '../../packages/ui-model-demo-frontend/src/ui_cellwise_projection.js';
import { resolvePageAsset } from '../../packages/ui-model-demo-frontend/src/page_asset_resolver.js';

function makeStateLabels(extra = {}) {
  return Object.fromEntries(
    Object.entries(extra).map(([k, v]) => [k, { t: 'json', v }]),
  );
}

function makeSnapshotWithState(extraLabels = {}, extraModels = {}) {
  return {
    models: {
      '-2': {
        id: -2,
        cells: {
          '0,0,0': {
            labels: {
              ui_page: { t: 'str', v: 'prompt' },
              ...makeStateLabels(extraLabels),
            },
          },
        },
      },
      ...extraModels,
    },
  };
}

function makeSchemaModel(modelId) {
  return {
    id: modelId,
    cells: {
      '0,0,0': {
        labels: {
          prompt_text: { t: 'str', v: '' },
        },
      },
      '1,0,0': {
        labels: {
          _title: { t: 'str', v: 'Prompt Asset' },
          _field_order: { t: 'json', v: ['prompt_text'] },
          prompt_text: { t: 'str', v: 'Input' },
          prompt_text__label: { t: 'str', v: 'Prompt' },
        },
      },
    },
  };
}

function makeUiAstModel(modelId) {
  return {
    id: modelId,
    cells: {
      '0,1,0': {
        labels: {
          page_asset_v0: {
            t: 'json',
            v: {
              id: `ui_ast_${modelId}`,
              type: 'Root',
              children: [
                { id: `txt_${modelId}`, type: 'Text', props: { text: 'Hello' } },
              ],
            },
          },
        },
      },
    },
  };
}

function makeCellwiseModel(modelId) {
  return {
    id: modelId,
    cells: {
      '0,0,0': {
        labels: {
          ui_authoring_version: { t: 'str', v: 'cellwise.ui.v1' },
          ui_root_node_id: { t: 'str', v: `cellwise_root_${modelId}` },
        },
      },
      '2,0,0': {
        labels: {
          ui_node_id: { t: 'str', v: `cellwise_root_${modelId}` },
          ui_component: { t: 'str', v: 'Root' },
        },
      },
      '2,1,0': {
        labels: {
          ui_node_id: { t: 'str', v: `txt_${modelId}` },
          ui_component: { t: 'str', v: 'Text' },
          ui_parent: { t: 'str', v: `cellwise_root_${modelId}` },
          ui_order: { t: 'int', v: 10 },
          ui_props_json: { t: 'json', v: { text: 'Hello Cellwise' } },
        },
      },
    },
  };
}

function test_prefers_schema_model_asset_over_legacy_ast() {
  const snapshot = makeSnapshotWithState(
    {
      ui_page_catalog_json: [
        { page: 'prompt', asset_type: 'schema_model', model_id: 4101 },
      ],
    },
    { '4101': makeSchemaModel(4101) },
  );

  const result = resolvePageAsset(snapshot, {
    projectSchemaModel: buildAstFromSchema,
  });

  assert.equal(result.source, 'model_asset');
  assert.equal(result.assetType, 'schema_model');
  assert.equal(result.modelId, 4101);
  assert.equal(result.ast?.id, 'schema_root_4101');
}

function test_prefers_model_label_asset_over_legacy_root_ast() {
  const snapshot = makeSnapshotWithState(
    {
      ui_page_catalog_json: [
        { page: 'prompt', asset_type: 'model_label', model_id: 4102, asset_ref: { p: 0, r: 1, c: 0, k: 'page_asset_v0' } },
      ],
    },
    { '4102': makeUiAstModel(4102) },
  );

  const result = resolvePageAsset(snapshot, {
    projectSchemaModel: buildAstFromSchema,
  });

  assert.equal(result.source, 'model_asset');
  assert.equal(result.assetType, 'model_label');
  assert.equal(result.ast?.id, 'ui_ast_4102');
}

function test_prefers_cellwise_model_label_asset_when_page_asset_source_is_absent() {
  const snapshot = makeSnapshotWithState(
    {
      ui_page_catalog_json: [
        { page: 'prompt', asset_type: 'model_label', model_id: 4103, asset_ref: { p: 0, r: 1, c: 0, k: 'page_asset_v0' } },
      ],
    },
    { '4103': makeCellwiseModel(4103) },
  );

  const result = resolvePageAsset(snapshot, {
    projectSchemaModel: buildAstFromSchema,
    projectCellwiseModel: buildAstFromCellwiseModel,
  });

  assert.equal(result.source, 'model_asset');
  assert.equal(result.assetType, 'model_label');
  assert.equal(result.modelId, 4103);
  assert.equal(result.ast?.id, 'cellwise_root_4103');
}

function test_returns_none_when_model_label_asset_missing() {
  const snapshot = makeSnapshotWithState(
    {
      ui_page_catalog_json: [
        { page: 'prompt', asset_type: 'model_label', model_id: 4998, asset_ref: { p: 0, r: 1, c: 0, k: 'page_asset_v0' } },
      ],
    },
    {},
  );

  const result = resolvePageAsset(snapshot, {
    projectSchemaModel: buildAstFromSchema,
  });

  assert.equal(result.source, 'none');
  assert.equal(result.ast, null);
}

function test_returns_none_when_page_asset_missing() {
  const snapshot = makeSnapshotWithState(
    {
      ui_page_catalog_json: [
        { page: 'prompt', asset_type: 'schema_model', model_id: 4999 },
      ],
    },
    {},
  );

  const result = resolvePageAsset(snapshot, {
    projectSchemaModel: buildAstFromSchema,
  });

  assert.equal(result.source, 'none');
  assert.equal(result.ast, null);
}

function test_returns_none_when_no_asset_and_no_legacy_builder() {
  const snapshot = makeSnapshotWithState({}, {});
  const result = resolvePageAsset(snapshot, {
    pageName: 'prompt',
    projectSchemaModel: buildAstFromSchema,
  });
  assert.equal(result.source, 'none');
  assert.equal(result.ast, null);
}

const tests = [
  test_prefers_schema_model_asset_over_legacy_ast,
  test_prefers_model_label_asset_over_legacy_root_ast,
  test_prefers_cellwise_model_label_asset_when_page_asset_source_is_absent,
  test_returns_none_when_model_label_asset_missing,
  test_returns_none_when_page_asset_missing,
  test_returns_none_when_no_asset_and_no_legacy_builder,
];

let passed = 0;
let failed = 0;

for (const test of tests) {
  try {
    test();
    console.log(`[PASS] ${test.name}`);
    passed += 1;
  } catch (err) {
    console.log(`[FAIL] ${test.name}: ${err.message}`);
    failed += 1;
  }
}

console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
process.exit(failed > 0 ? 1 : 0);
