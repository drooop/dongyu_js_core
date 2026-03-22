#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..');
const serverSource = fs.readFileSync(path.join(repoRoot, 'packages/ui-model-demo-server/server.mjs'), 'utf8');

function run() {
  assert(serverSource.includes("url.pathname === '/stream'"), 'missing_stream_route');
  assert(serverSource.includes("url.pathname === '/snapshot'"), 'missing_snapshot_route');
  assert(serverSource.includes("url.pathname === '/ui_event'"), 'missing_ui_event_route');
  assert(serverSource.includes("url.pathname === '/api/runtime/mode'"), 'missing_runtime_mode_route');
  assert(serverSource.includes("url.pathname === '/api/modeltable/patch'"), 'missing_patch_route');

  assert(serverSource.includes("error: 'direct_patch_api_disabled'"), 'missing_direct_patch_api_disabled_contract');
  assert(serverSource.includes("finishError('direct_model_mutation_disabled', action)"), 'missing_direct_model_mutation_guard');
  assert(serverSource.includes('const allowUiLocalMutation = isUiLocalMutableModelId(directMutationTarget);'), 'missing_ui_local_mutation_gate');
  assert(serverSource.includes('const uiLocalAdapter = createLocalBusAdapter({'), 'missing_ui_local_adapter_path');
  assert(serverSource.includes('state.activateRuntimeMode(nextMode)'), 'missing_runtime_mode_activation');
  assert(!serverSource.includes("overwriteStateLabel(runtime, 'ws_selected_ast'"), 'legacy_ws_selected_ast_write_must_be_removed');

  process.stdout.write('editor_server_sse_contract: PASS\n');
}

try {
  run();
  process.exit(0);
} catch (err) {
  process.stderr.write(`FAIL: ${err && err.message ? err.message : String(err)}\n`);
  process.exit(1);
}
