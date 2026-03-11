#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readAppShellRouteSyncState } from '../../packages/ui-model-demo-frontend/src/app_shell_route_sync.js';

function makeSnapshot(labels = {}) {
  const rootLabels = {};
  for (const [k, value] of Object.entries(labels)) {
    rootLabels[k] = { v: value };
  }
  return {
    models: {
      '-2': {
        cells: {
          '0,0,0': {
            labels: rootLabels,
          },
        },
      },
    },
  };
}

{
  const state = readAppShellRouteSyncState(makeSnapshot({ ui_page: 'home' }), '/workspace');
  assert.equal(state.pending, true, 'workspace route must stay pending until snapshot ui_page catches up');
}

{
  const state = readAppShellRouteSyncState(
    makeSnapshot({ ui_page: 'workspace', ws_app_selected: 100, selected_model_id: '0' }),
    '/workspace',
  );
  assert.equal(state.pending, true, 'workspace route must stay pending until selected_model_id matches ws_app_selected');
}

{
  const state = readAppShellRouteSyncState(
    makeSnapshot({ ui_page: 'workspace', ws_app_selected: 100, selected_model_id: '100' }),
    '/workspace',
  );
  assert.equal(state.pending, false, 'workspace route must be ready once snapshot page and selection are synchronized');
}

{
  const state = readAppShellRouteSyncState(makeSnapshot({ ui_page: 'home' }), '/docs');
  assert.equal(state.pending, true, 'docs route must stay pending until snapshot ui_page switches to docs');
}

{
  const state = readAppShellRouteSyncState(makeSnapshot({ ui_page: 'docs' }), '/docs');
  assert.equal(state.pending, false, 'docs route must be ready once snapshot ui_page matches docs');
}

{
  const state = readAppShellRouteSyncState(makeSnapshot({ ui_page: 'home' }), '/');
  assert.equal(state.pending, false, 'home route must not be blocked by synchronization gating');
}

console.log('PASS test_0182_app_shell_route_sync_contract');
