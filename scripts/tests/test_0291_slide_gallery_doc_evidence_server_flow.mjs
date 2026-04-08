#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const SLIDE_CREATOR_TRUTH_MODEL_ID = 1035;
const GALLERY_STATE_MODEL_ID = -102;

function wait(ms = 120) {
  return new Promise((resolveWait) => setTimeout(resolveWait, ms));
}

function mailboxEnvelope(action, options = {}) {
  const payload = {
    action,
    meta: { op_id: options.opId || `${action}_${Date.now()}` },
  };
  if (options.value !== undefined) payload.value = options.value;
  if (options.target !== undefined) payload.target = options.target;
  return {
    event_id: Date.now(),
    type: action,
    payload,
    source: 'ui_renderer',
    ts: Date.now(),
  };
}

async function withServerState(fn) {
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0291-slide-gallery-'));
  process.env.DY_AUTH = '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.WORKER_BASE_WORKSPACE = `it0291_gallery_${Date.now()}`;
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

function readGalleryLabel(snapshot, key, row) {
  return snapshot.models[String(GALLERY_STATE_MODEL_ID)]?.cells?.[`0,${row},0`]?.labels?.[key]?.v;
}

async function test_gallery_slide_showcase_tracks_creator_and_registry_state() {
  return withServerState(async (state) => {
    const runtime = state.runtime;
    const snapBefore = state.clientSnap();

    assert.match(
      String(readGalleryLabel(snapBefore, 'gallery_slide_registry_count_text', 14) || ''),
      /slide apps=/,
      'gallery_slide_registry_count_text_must_report_slide_counts',
    );
    assert.match(
      String(readGalleryLabel(snapBefore, 'gallery_slide_models_text', 15) || ''),
      /100:flow\.shell/,
      'gallery_slide_models_text_must_include_flow_shell_anchor',
    );
    assert.match(
      String(readGalleryLabel(snapBefore, 'gallery_slide_models_text', 15) || ''),
      /1034:workspace\.page/,
      'gallery_slide_models_text_must_include_slide_creator_app',
    );
    assert.match(
      String(readGalleryLabel(snapBefore, 'gallery_slide_creator_status_text', 16) || ''),
      /填写字段后创建 Slide App/,
      'gallery_slide_creator_status_text_must_reflect_creator_truth_status',
    );

    const creatorTruth = runtime.getModel(SLIDE_CREATOR_TRUTH_MODEL_ID);
    assert.ok(creatorTruth, 'slide_creator_truth_model_missing');
    runtime.addLabel(creatorTruth, 0, 0, 0, { k: 'create_app_name', t: 'str', v: 'Gallery Created App' });
    runtime.addLabel(creatorTruth, 0, 0, 0, { k: 'create_source_worker', t: 'str', v: 'gallery-evidence' });
    runtime.addLabel(creatorTruth, 0, 0, 0, { k: 'create_headline', t: 'str', v: 'Gallery Evidence Headline' });
    runtime.addLabel(creatorTruth, 0, 0, 0, { k: 'create_body_text', t: 'str', v: 'Gallery evidence body text' });

    const createResult = await state.submitEnvelope(mailboxEnvelope('slide_app_create', {
      target: { model_id: SLIDE_CREATOR_TRUTH_MODEL_ID, p: 0, r: 0, c: 0, k: 'create_app_name' },
    }));
    assert.equal(createResult.result, 'ok', 'slide_app_create_must_be_accepted');
    await wait();

    const snapAfterCreate = state.clientSnap();
    assert.match(
      String(readGalleryLabel(snapAfterCreate, 'gallery_slide_last_created_text', 17) || ''),
      /Gallery Created App/,
      'gallery_slide_last_created_text_must_include_new_app_name',
    );
    assert.match(
      String(readGalleryLabel(snapAfterCreate, 'gallery_slide_creator_status_text', 16) || ''),
      /created: Gallery Created App/,
      'gallery_slide_creator_status_text_must_update_after_create',
    );
    assert.match(
      String(readGalleryLabel(snapAfterCreate, 'gallery_slide_registry_count_text', 14) || ''),
      /deletable=/,
      'gallery_slide_registry_count_text_must_still_report_registry_summary_after_create',
    );

    const registry = snapAfterCreate.models['-2']?.cells?.['0,0,0']?.labels?.ws_apps_registry?.v || [];
    const createdEntry = registry.find((entry) => entry && entry.name === 'Gallery Created App');
    assert.ok(createdEntry, 'gallery_created_app_must_enter_workspace_registry');

    const deleteResult = await state.submitEnvelope(mailboxEnvelope('ws_app_delete', {
      value: { t: 'int', v: createdEntry.model_id },
    }));
    assert.equal(deleteResult.result, 'ok', 'gallery_created_app_delete_must_be_accepted');
    await wait();

    const snapAfterDelete = state.clientSnap();
    assert.ok(
      !String(readGalleryLabel(snapAfterDelete, 'gallery_slide_last_created_text', 17) || '').includes('missing'),
      'gallery_slide_last_created_text_must_remain_human_readable_after_delete',
    );

    return { key: 'gallery_slide_showcase_tracks_creator_and_registry_state', status: 'PASS' };
  });
}

const tests = [
  test_gallery_slide_showcase_tracks_creator_and_registry_state,
];

(async () => {
  let passed = 0;
  let failed = 0;
  for (const test of tests) {
    try {
      const result = await test();
      console.log(`[${result.status}] ${result.key}`);
      passed += 1;
    } catch (error) {
      console.log(`[FAIL] ${test.name}: ${error.message}`);
      failed += 1;
    }
  }
  console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
  process.exit(failed > 0 ? 1 : 0);
})();
