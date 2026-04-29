#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

const repoRoot = new URL('../..', import.meta.url);
const patchPath = 'packages/worker-base/system-models/slide_app_provider_docs_ui.json';
const docsScriptPath = 'scripts/ops/sync_ui_public_docs.sh';
const assetScriptPath = 'scripts/ops/sync_local_persisted_assets.sh';
const cloudSourcePath = 'scripts/ops/sync_cloud_source.sh';
const appDeployPath = 'scripts/ops/deploy_cloud_app.sh';
const fullDeployPath = 'scripts/ops/deploy_cloud_full.sh';
const localDeployPath = 'scripts/ops/deploy_local.sh';

function repoFile(relPath) {
  return new URL(`../../${relPath}`, import.meta.url);
}

function readText(relPath) {
  return readFileSync(repoFile(relPath), 'utf8');
}

function readJson(relPath) {
  return JSON.parse(readText(relPath));
}

function findRecord(records, matcher) {
  return records.find((record) => record && matcher(record)) || null;
}

function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    env: { ...process.env, ...(options.env || {}) },
  });
  assert.equal(result.status, 0, `${cmd} ${args.join(' ')} failed\nstdout=${result.stdout}\nstderr=${result.stderr}`);
  return result;
}

function test_workspace_docs_entry_is_cellwise_model() {
  const patch = readJson(patchPath);
  const records = patch.records || [];
  assert.ok(findRecord(records, (record) => record.op === 'create_model' && record.model_id === 1039), 'model 1039 must be created');
  assert.ok(findRecord(records, (record) => record.model_id === 0 && record.p === 2 && record.r === 0 && record.c === 18 && record.t === 'model.submt' && record.v === 1039), 'model 1039 must be mounted under Workspace');
  assert.ok(findRecord(records, (record) => record.model_id === 1039 && record.k === 'ui_authoring_version' && record.v === 'cellwise.ui.v1'), 'model 1039 must be cellwise.ui.v1');
  assert.ok(findRecord(records, (record) => record.model_id === 1039 && record.k === 'app_name' && record.v === 'Minimal Submit App Provider Docs'), 'workspace entry name must be present');

  const components = records.filter((record) => record.model_id === 1039 && record.k === 'ui_component').map((record) => record.v);
  for (const component of ['Container', 'Heading', 'Paragraph', 'Markdown', 'Link', 'Callout']) {
    assert.ok(components.includes(component), `component missing: ${component}`);
  }
  assert.equal(components.includes('Html'), false, 'docs entry must not use raw Html component');
  assert.equal(components.includes('WebView'), false, 'docs entry must not use WebView wrapper');
  assert.ok(records.some((record) => record.k === 'ui_props_json' && record.v?.href === '/p/slide-app-runtime-minimal-submit-provider/'), 'static HTML link must be modeled');
  assert.ok(records.some((record) => record.k === 'ui_markdown' && String(record.v).includes('minimal_submit_app_provider_guide.md')), 'Markdown doc path must be visible');
  return { key: 'workspace_docs_entry_is_cellwise_model', status: 'PASS' };
}

function test_publish_script_copies_docs_and_static_project() {
  const root = mkdtempSync(join(tmpdir(), 'dy-0353-public-docs-'));
  try {
    run('bash', [docsScriptPath], { env: { LOCAL_DY_PERSIST_ROOT: root } });
    const docsRoot = join(root, 'docs/user-guide/slide-app-runtime');
    const staticRoot = join(root, 'static_projects/slide-app-runtime-minimal-submit-provider');
    assert.match(readFileSync(join(docsRoot, 'minimal_submit_app_provider_guide.md'), 'utf8'), /Input \+ Submit/u);
    assert.match(readFileSync(join(docsRoot, 'minimal_submit_app_provider_visualized.md'), 'utf8'), /cellwise UI labels/u);
    assert.match(readFileSync(join(staticRoot, 'index.html'), 'utf8'), /demoInput/u);
    assert.match(readFileSync(join(staticRoot, 'minimal_submit_app_provider_interactive.html'), 'utf8'), /demoSubmit/u);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
  return { key: 'publish_script_copies_docs_and_static_project', status: 'PASS' };
}

async function test_server_can_open_published_docs_and_static_project() {
  const root = mkdtempSync(join(tmpdir(), 'dy-0353-server-docs-'));
  process.env.DY_AUTH = '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.WORKER_BASE_WORKSPACE = `it0353_docs_${Date.now()}`;
  process.env.WORKER_BASE_DATA_ROOT = join(root, 'runtime');
  process.env.DY_PERSIST_ROOT = root;
  process.env.DOCS_ROOT = join(root, 'docs');
  process.env.STATIC_PROJECTS_ROOT = join(root, 'static_projects');
  try {
    run('bash', [docsScriptPath], { env: { LOCAL_DY_PERSIST_ROOT: root } });
    const { createServerState } = await import(new URL('../../packages/ui-model-demo-server/server.mjs', import.meta.url));
    const state = createServerState({ dbPath: null });
    await state.activateRuntimeMode('running');

    const docResult = state.runtime.hostApi.docsOpenDoc('user-guide/slide-app-runtime/minimal_submit_app_provider_guide.md');
    assert.equal(docResult.ok, true, `docsOpenDoc must open guide: ${docResult.detail || ''}`);
    assert.match(docResult.data?.markdown || '', /Minimal Submit App/u);

    const projectsResult = state.runtime.hostApi.staticListProjects();
    assert.equal(projectsResult.ok, true, 'staticListProjects must succeed');
    assert.ok(projectsResult.data.projects.some((project) => project.name === 'slide-app-runtime-minimal-submit-provider' && project.url === '/p/slide-app-runtime-minimal-submit-provider/'), 'static project must be listed');
  } finally {
    rmSync(root, { recursive: true, force: true });
    delete process.env.DY_AUTH;
    delete process.env.DY_PERSISTED_ASSET_ROOT;
    delete process.env.WORKER_BASE_WORKSPACE;
    delete process.env.WORKER_BASE_DATA_ROOT;
    delete process.env.DY_PERSIST_ROOT;
    delete process.env.DOCS_ROOT;
    delete process.env.STATIC_PROJECTS_ROOT;
  }
  return { key: 'server_can_open_published_docs_and_static_project', status: 'PASS' };
}

function test_deploy_and_asset_sync_include_public_docs() {
  const localDeploy = readText(localDeployPath);
  const appDeploy = readText(appDeployPath);
  const fullDeploy = readText(fullDeployPath);
  const cloudSource = readText(cloudSourcePath);
  assert.match(localDeploy, /sync_ui_public_docs\.sh/u, 'local deploy must sync public docs');
  assert.match(appDeploy, /sync_ui_public_docs\.sh/u, 'cloud app deploy must sync public docs');
  assert.match(appDeploy, /\[\s*"\$TARGET"\s*=\s*"ui-server"\s*\]/u, 'cloud app deploy must limit public docs sync to ui-server');
  assert.match(fullDeploy, /sync_ui_public_docs\.sh/u, 'cloud full deploy must sync public docs');
  assert.match(cloudSource, /docs\/user-guide\/slide-app-runtime/u, 'cloud source fallback must include slide app runtime docs');
  return { key: 'deploy_and_asset_sync_include_public_docs', status: 'PASS' };
}

function test_persisted_asset_manifest_includes_docs_ui_patch() {
  const root = mkdtempSync(join(tmpdir(), 'dy-0353-assets-'));
  try {
    run('bash', [assetScriptPath], { env: { LOCAL_PERSISTED_ASSET_ROOT: root } });
    const manifest = JSON.parse(readFileSync(join(root, 'manifest.v0.json'), 'utf8'));
    assert.ok(manifest.entries.some((entry) => entry.path === 'system/positive/slide_app_provider_docs_ui.json' && entry.kind === 'patch' && entry.scope.includes('ui-server')), 'asset manifest must include docs UI patch for ui-server');
    const copied = JSON.parse(readFileSync(join(root, 'system/positive/slide_app_provider_docs_ui.json'), 'utf8'));
    assert.equal(copied.op_id, 'slide_app_provider_docs_ui_v0');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
  return { key: 'persisted_asset_manifest_includes_docs_ui_patch', status: 'PASS' };
}

const tests = [
  test_workspace_docs_entry_is_cellwise_model,
  test_publish_script_copies_docs_and_static_project,
  test_server_can_open_published_docs_and_static_project,
  test_deploy_and_asset_sync_include_public_docs,
  test_persisted_asset_manifest_includes_docs_ui_patch,
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
      console.log(`[FAIL] ${test.name}: ${error.stack || error.message}`);
      failed += 1;
    }
  }
  console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
  process.exit(failed > 0 ? 1 : 0);
})();
