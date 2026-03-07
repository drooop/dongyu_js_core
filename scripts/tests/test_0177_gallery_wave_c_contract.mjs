#!/usr/bin/env node

import assert from 'node:assert/strict';
import { buildGalleryAst, GALLERY_STATE_MODEL_ID } from '../../packages/ui-model-demo-frontend/src/gallery_model.js';

function findNodeById(node, id) {
  if (!node || typeof node !== 'object') return null;
  if (node.id === id) return node;
  const children = Array.isArray(node.children) ? node.children : [];
  for (const child of children) {
    const found = findNodeById(child, id);
    if (found) return found;
  }
  return null;
}

const ast = buildGalleryAst();

const waveDesc = findNodeById(ast, 'wave_c_desc');
assert.ok(waveDesc, 'wave_c_desc must exist');
assert.equal(
  String(waveDesc.props?.text || '').includes('submodel_create'),
  false,
  'Wave C description must not promise blocked submodel_create flow',
);

const materializeBtn = findNodeById(ast, 'wave_c_materialize_fragment');
assert.ok(materializeBtn, 'Wave C materialize button must exist');
assert.equal(materializeBtn.bind?.write?.action, 'label_update', 'Wave C materialize button must use standard label_update');
assert.deepEqual(
  materializeBtn.bind?.write?.target_ref,
  { model_id: GALLERY_STATE_MODEL_ID, p: 0, r: 9, c: 2, k: 'wave_c_fragment_dynamic' },
  'Wave C materialize button must write to gallery state label',
);
assert.equal(materializeBtn.bind?.write?.value_ref?.t, 'json', 'Wave C materialize button must write json fragment');

const dynamicInclude = findNodeById(ast, 'wave_c_include_dynamic');
assert.ok(dynamicInclude, 'Wave C dynamic include must exist');
assert.deepEqual(
  dynamicInclude.props?.ref,
  { model_id: GALLERY_STATE_MODEL_ID, p: 0, r: 9, c: 2, k: 'wave_c_fragment_dynamic' },
  'Wave C include must read the same gallery state label that the button writes',
);

console.log('PASS test_0177_gallery_wave_c_contract');
