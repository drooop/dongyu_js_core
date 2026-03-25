#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..', '..');
const homeCatalogPatch = JSON.parse(fs.readFileSync(
  resolve(repoRoot, 'packages/worker-base/system-models/home_catalog_ui.json'),
  'utf8',
));

function getPatchRecords(patch) {
  return Array.isArray(patch?.records) ? patch.records : [];
}

function findHomeAsset(records) {
  return records.find((record) => (
    record?.model_id === -22 &&
    record?.p === 0 &&
    record?.r === 1 &&
    record?.c === 0 &&
    record?.k === 'page_asset_v0'
  )) || null;
}

function walk(node, fn) {
  if (!node || typeof node !== 'object') return;
  fn(node);
  const children = Array.isArray(node.children) ? node.children : [];
  for (const child of children) walk(child, fn);
}

function test_home_surface_contract_removes_legacy_datatable_marker() {
  const records = getPatchRecords(homeCatalogPatch);
  const assetRecord = findHomeAsset(records);
  assert(assetRecord, 'home_page_asset_v0_record_missing');
  assert.equal(assetRecord.v?.id, 'root_home', 'home_page_asset_root_id_must_be_root_home');

  const texts = [];
  const titles = [];
  const ids = [];
  walk(assetRecord.v, (node) => {
    if (typeof node.id === 'string') ids.push(node.id);
    if (typeof node?.props?.text === 'string') texts.push(node.props.text);
    if (typeof node?.props?.title === 'string') titles.push(node.props.title);
  });

  const joinedTexts = texts.join('\n');
  const joinedTitles = titles.join('\n');
  const joinedIds = ids.join('\n');

  assert(!joinedTexts.includes('home-datatable'), 'home_surface_must_not_expose_legacy_home_datatable_marker');
  assert(!joinedTitles.includes('DataTable'), 'home_surface_must_not_use_legacy_datatable_title');
  assert(!joinedIds.includes('card_home_datatable'), 'home_surface_must_not_keep_legacy_datatable_card_id');
}

const tests = [
  test_home_surface_contract_removes_legacy_datatable_marker,
];

let passed = 0;
let failed = 0;

for (const test of tests) {
  try {
    test();
    console.log(`[PASS] ${test.name}`);
    passed += 1;
  } catch (error) {
    console.log(`[FAIL] ${test.name}: ${error.message}`);
    failed += 1;
  }
}

console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
process.exit(failed > 0 ? 1 : 0);
