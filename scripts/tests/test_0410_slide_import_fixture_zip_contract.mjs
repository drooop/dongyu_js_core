#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import AdmZipPkg from 'adm-zip';

const AdmZip = AdmZipPkg && AdmZipPkg.default ? AdmZipPkg.default : AdmZipPkg;
const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const payloadPath = path.join(repoRoot, 'test_files', 'app_payload.json');
const zipPath = path.join(repoRoot, 'test_files', 'slide-import-v1.zip');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function rootRecord(payload, key) {
  return payload.find((record) => (
    record
    && record.id === 0
    && record.p === 0
    && record.r === 0
    && record.c === 0
    && record.k === key
  ));
}

function test_slide_import_fixture_zip_matches_saved_payload() {
  assert.equal(fs.existsSync(payloadPath), true, 'slide_import_payload_fixture_missing');
  assert.equal(fs.existsSync(zipPath), true, 'slide_import_zip_fixture_missing');

  const savedPayload = readJson(payloadPath);
  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries().filter((entry) => entry && !entry.isDirectory);
  assert.equal(entries.length, 1, 'slide_import_zip_must_contain_exactly_one_file');
  assert.equal(entries[0].entryName, 'app_payload.json', 'slide_import_zip_file_must_be_app_payload_json');

  const zippedPayload = JSON.parse(entries[0].getData().toString('utf8'));
  assert.deepEqual(zippedPayload, savedPayload, 'slide_import_zip_payload_must_match_saved_payload');

  const summary = rootRecord(zippedPayload, 'slide_app_summary');
  assert.equal(summary?.t, 'str', 'slide_import_zip_must_include_summary_type');
  assert.equal(typeof summary?.v, 'string', 'slide_import_zip_must_include_summary_value');
  assert.ok(summary.v.trim().length >= 8, 'slide_import_zip_summary_must_be_non_empty');

  return { key: 'slide_import_fixture_zip_matches_saved_payload', status: 'PASS' };
}

async function withServerState(fn) {
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0410-fixture-'));
  process.env.DY_AUTH = '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.WORKER_BASE_WORKSPACE = `it0410_fixture_${Date.now()}`;
  process.env.WORKER_BASE_DATA_ROOT = join(tempRoot, 'runtime');
  process.env.DOCS_ROOT = join(tempRoot, 'docs');
  process.env.STATIC_PROJECTS_ROOT = join(tempRoot, 'static');
  const { createServerState } = await import(new URL('../../packages/ui-model-demo-server/server.mjs', import.meta.url));
  const state = createServerState({ dbPath: null });
  try {
    await state.activateRuntimeMode('running');
    return await fn(state);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
    delete process.env.WORKER_BASE_WORKSPACE;
    delete process.env.WORKER_BASE_DATA_ROOT;
    delete process.env.DOCS_ROOT;
    delete process.env.STATIC_PROJECTS_ROOT;
    delete process.env.DY_PERSISTED_ASSET_ROOT;
  }
}

async function test_slide_import_fixture_zip_imports_successfully() {
  return withServerState(async (state) => {
    state.cacheUploadedMediaForTest('mxc://localhost/0410-slide-import-v1', {
      buffer: fs.readFileSync(zipPath),
      contentType: 'application/zip',
      filename: 'slide-import-v1.zip',
      userId: '@fixture:localhost',
    });
    const importResult = state.runtime.hostApi.slideImportAppFromMxc('mxc://localhost/0410-slide-import-v1');
    assert.equal(importResult.ok, true, 'slide_import_fixture_zip_must_import_successfully');
    assert.equal(importResult.data?.app_name, 'Imported Zip App', 'slide_import_fixture_app_name_must_match');
    assert.equal(Number.isInteger(importResult.data?.model_id), true, 'slide_import_fixture_model_id_must_be_int');
    return { key: 'slide_import_fixture_zip_imports_successfully', status: 'PASS' };
  });
}

const tests = [
  test_slide_import_fixture_zip_matches_saved_payload,
  test_slide_import_fixture_zip_imports_successfully,
];

let failed = 0;
for (const test of tests) {
  try {
    const result = await test();
    console.log(`PASS ${result.key}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${test.name}: ${error && error.stack ? error.stack : error}`);
  }
}

if (failed) {
  console.error(`${failed} failed, ${tests.length - failed} passed out of ${tests.length}`);
  process.exit(1);
}

console.log(`${tests.length} passed, 0 failed out of ${tests.length}`);
