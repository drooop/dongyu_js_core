#!/usr/bin/env node

import assert from 'node:assert/strict';
import {
  buildClientSnapshotForPrincipal,
  createPrincipalRuntimeRegistry,
  createServerState,
} from '../../packages/ui-model-demo-server/server.mjs';
import {
  DESKTOP_FOREGROUND_APP_LABEL,
  DESKTOP_TASK_STACK_LABEL,
  deriveDesktopTaskStack,
  readAvailableDesktopForegroundApp,
  readAvailableDesktopTaskStack,
  removeDesktopTaskFromStack,
} from '../../packages/ui-model-demo-frontend/src/desktop_app_state.js';

function createTestState() {
  return createServerState({ dbPath: null });
}

function mailboxEnvelope(action, options = {}) {
  const payload = {
    action,
    meta: { op_id: options.opId || `${action}_${Date.now()}` },
  };
  if (options.target) payload.target = options.target;
  if (Object.prototype.hasOwnProperty.call(options, 'value')) payload.value = options.value;
  return {
    event_id: Date.now(),
    type: action,
    payload,
    source: 'ui_renderer',
    ts: Date.now(),
  };
}

function setStateLabel(state, key, t, v) {
  const model = state.runtime.getModel(-2);
  assert.ok(model, 'editor_state_model_missing');
  state.runtime.addLabel(model, 0, 0, 0, { k: key, t, v });
}

function tableModelRef(tableId, modelId) {
  return tableId === 'host' ? modelId : { table_id: tableId, model_id: modelId };
}

function ensureModel(state, tableId, modelId, name = `model_${modelId}`) {
  return state.runtime.getModel(tableModelRef(tableId, modelId))
    || state.runtime.createModel({
      ...(tableId === 'host' ? {} : { table_id: tableId }),
      id: modelId,
      name,
      type: 'sliding_ui',
    });
}

function mountSubtable(state, tableId, ownerPrincipalId, rootModelId = 1) {
  const root = state.runtime.getModel(0);
  assert.ok(root, 'host_model_0_missing');
  const p = 70 + Math.abs([...tableId].reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % 1000);
  state.runtime.addLabel(root, p, 0, 0, {
    k: `subtable_${tableId.replace(/[^a-zA-Z0-9]+/g, '_')}`,
    t: 'model.subtable',
    v: {
      table_id: tableId,
      root_model_id: rootModelId,
      owner_principal_id: ownerPrincipalId,
    },
  });
}

function createWorkspaceApp(state, {
  id,
  tableId,
  modelId = 1,
  title,
  ownerPrincipalId,
}) {
  if (tableId !== 'host') {
    mountSubtable(state, tableId, ownerPrincipalId, modelId);
  }
  const model = ensureModel(state, tableId, modelId, title);
  state.runtime.addLabel(model, 0, 0, 0, { k: 'title', t: 'str', v: title });
  state.runtime.addLabel(model, 0, 0, 0, { k: 'app_name', t: 'str', v: title });
  state.runtime.addLabel(model, 0, 0, 0, { k: 'deletable', t: 'bool', v: true });
  state.runtime.addLabel(model, 0, 0, 0, { k: 'slide_capable', t: 'bool', v: true });
  state.runtime.addLabel(model, 0, 0, 0, { k: 'slide_app_summary', t: 'str', v: `${title} fixture` });
  return {
    id,
    kind: 'workspace',
    page: 'workspace',
    path: '/workspace',
    title,
    table_id: tableId,
    model_id: modelId,
  };
}

function clientSnapshot(entry) {
  return buildClientSnapshotForPrincipal(entry.state.clientSnap(), {
    ...entry.principal,
    capabilities: ['workspace:read', 'app:read', 'slide_app:use'],
  });
}

function rootLabelValue(snapshot, key) {
  return snapshot?.models?.['-2']?.cells?.['0,0,0']?.labels?.[key]?.v;
}

function createRegistry() {
  return createPrincipalRuntimeRegistry({
    createState: (principalKey, principal) => {
      const state = createTestState();
      state.runtime.principalRuntimeKey = principalKey;
      state.runtime.addLabel(state.runtime.getModel(0), 0, 0, 0, {
        k: 'principal_runtime_key',
        t: 'str',
        v: principalKey,
      });
      state.runtime.addLabel(state.runtime.getModel(0), 0, 0, 0, {
        k: 'principal_subject',
        t: 'str',
        v: principal?.subject || '',
      });
      return state;
    },
    readOnlyState: createTestState(),
  });
}

function test_two_principals_have_independent_desktop_state_and_registries() {
  const registry = createRegistry();
  const alice = registry.resolveMutableRuntime({ subject: 'alice-sub', email: 'alice@example.test' });
  const bob = registry.resolveMutableRuntime({ subject: 'bob-sub', email: 'bob@example.test' });

  const aliceApp = createWorkspaceApp(alice.state, {
    id: 'workspace:todo',
    tableId: 'app:alice:todo',
    modelId: 1,
    title: 'Alice To Do',
    ownerPrincipalId: 'alice-sub',
  });
  const bobApp = createWorkspaceApp(bob.state, {
    id: 'workspace:todo',
    tableId: 'app:bob:todo',
    modelId: 1,
    title: 'Bob To Do',
    ownerPrincipalId: 'bob-sub',
  });

  setStateLabel(alice.state, 'ws_apps_registry', 'json', [aliceApp]);
  setStateLabel(alice.state, DESKTOP_FOREGROUND_APP_LABEL, 'json', aliceApp);
  setStateLabel(alice.state, DESKTOP_TASK_STACK_LABEL, 'json', [aliceApp]);
  setStateLabel(bob.state, 'ws_apps_registry', 'json', [bobApp]);
  setStateLabel(bob.state, DESKTOP_FOREGROUND_APP_LABEL, 'json', bobApp);
  setStateLabel(bob.state, DESKTOP_TASK_STACK_LABEL, 'json', [bobApp]);

  const aliceSnapshot = clientSnapshot(alice);
  const bobSnapshot = clientSnapshot(bob);

  assert.deepEqual(
    rootLabelValue(aliceSnapshot, 'ws_apps_registry').map((app) => app.table_id),
    ['app:alice:todo'],
    'alice_visible_registry_must_not_include_bob_app',
  );
  assert.deepEqual(
    rootLabelValue(bobSnapshot, 'ws_apps_registry').map((app) => app.table_id),
    ['app:bob:todo'],
    'bob_visible_registry_must_not_include_alice_app',
  );
  assert.equal(readAvailableDesktopForegroundApp(aliceSnapshot)?.title, 'Alice To Do');
  assert.equal(readAvailableDesktopForegroundApp(bobSnapshot)?.title, 'Bob To Do');
  assert.deepEqual(readAvailableDesktopTaskStack(aliceSnapshot).map((task) => task.table_id), ['app:alice:todo']);
  assert.deepEqual(readAvailableDesktopTaskStack(bobSnapshot).map((task) => task.table_id), ['app:bob:todo']);

  return { key: 'two_principals_have_independent_desktop_state_and_registries', status: 'PASS' };
}

function test_default_development_context_is_explicit_principal_not_shared_fallback() {
  const registry = createRegistry();
  assert.throws(() => registry.resolveMutableRuntime(null), /guest_read_only/, 'anonymous_mutable_runtime_must_be_rejected');

  const guest = registry.resolveReadRuntime(null);
  assert.equal(guest.principalKey, 'guest');
  assert.equal(guest.mutable, false);

  const dev = registry.resolveMutableRuntime({ subject: 'local-dev', userId: 'ignored-user-id' });
  assert.equal(dev.principalKey, 'subject:local-dev');
  assert.equal(registry.principalRuntimeKey({ subject: 'local-dev', userId: 'ignored-user-id' }), 'subject:local-dev');
  assert.ok(registry.runtimeByKey('subject:local-dev'), 'explicit_local_dev_runtime_missing');

  return { key: 'default_development_context_is_explicit_principal_not_shared_fallback', status: 'PASS' };
}

function test_server_principal_key_takes_authenticated_identity_order_not_client_payload() {
  const registry = createRegistry();
  const maliciousClientPayload = {
    principal_id: 'bob-sub',
    subject: 'bob-sub',
    table_id: 'app:bob:todo',
  };
  const authenticatedSessionPrincipal = { subject: 'alice-sub', userId: maliciousClientPayload.subject };

  const entry = registry.resolveMutableRuntime(authenticatedSessionPrincipal);

  assert.equal(entry.principalKey, 'subject:alice-sub');
  assert.equal(registry.principalRuntimeKey(authenticatedSessionPrincipal), 'subject:alice-sub');
  assert.equal(registry.runtimeByKey('subject:bob-sub'), null, 'client_payload_must_not_create_or_select_bob_runtime');

  return { key: 'server_principal_key_takes_authenticated_identity_order_not_client_payload', status: 'PASS' };
}

function test_task_stack_uses_table_qualified_workspace_identity() {
  const appA = {
    id: 'workspace:todo',
    kind: 'workspace',
    page: 'workspace',
    path: '/workspace',
    title: 'To Do A',
    table_id: 'app:a',
    model_id: 1,
  };
  const appB = {
    id: 'workspace:todo',
    kind: 'workspace',
    page: 'workspace',
    path: '/workspace',
    title: 'To Do B',
    table_id: 'app:b',
    model_id: 1,
  };

  const next = deriveDesktopTaskStack([appA], appB);
  assert.deepEqual(
    next.map((task) => `${task.table_id}/${task.model_id}`),
    ['app:b/1', 'app:a/1'],
    'same_local_model_id_in_different_tables_must_not_be_deduped',
  );
  const removed = removeDesktopTaskFromStack(next, appB);
  assert.deepEqual(
    removed.map((task) => `${task.table_id}/${task.model_id}`),
    ['app:a/1'],
    'closing_one_table_qualified_task_must_not_close_other_instance',
  );

  return { key: 'task_stack_uses_table_qualified_workspace_identity', status: 'PASS' };
}

async function test_server_accepts_app_table_foreground_update_from_current_registry() {
  const state = createTestState();
  const app = createWorkspaceApp(state, {
    id: 'workspace:todo',
    tableId: 'app:foreground:todo',
    modelId: 1,
    title: 'Foreground To Do',
    ownerPrincipalId: 'local-dev',
  });
  setStateLabel(state, 'ws_apps_registry', 'json', [app]);

  const result = await state.submitEnvelope(mailboxEnvelope('label_update', {
    opId: 'it0425_app_table_foreground',
    target: { table_id: 'host', model_id: -2, p: 0, r: 0, c: 0, k: DESKTOP_FOREGROUND_APP_LABEL },
    value: { t: 'json', v: app },
  }));

  assert.equal(result.result, 'ok', 'app_table_foreground_update_must_be_accepted');
  const snapshot = state.clientSnap();
  assert.equal(rootLabelValue(snapshot, DESKTOP_FOREGROUND_APP_LABEL)?.table_id, 'app:foreground:todo');
  assert.deepEqual(
    rootLabelValue(snapshot, DESKTOP_TASK_STACK_LABEL).map((task) => `${task.table_id}/${task.model_id}`),
    ['app:foreground:todo/1'],
    'accepted_app_table_foreground_must_update_table_qualified_task_stack',
  );

  return { key: 'server_accepts_app_table_foreground_update_from_current_registry', status: 'PASS' };
}

async function test_server_delete_removes_app_table_target_without_host_fallback() {
  const state = createTestState();
  const hostModel = ensureModel(state, 'host', 1, 'host-collision');
  state.runtime.addLabel(hostModel, 0, 0, 0, { k: 'app_name', t: 'str', v: 'Host Collision' });
  state.runtime.addLabel(hostModel, 0, 0, 0, { k: 'deletable', t: 'bool', v: true });
  state.runtime.addLabel(hostModel, 0, 0, 0, { k: 'slide_capable', t: 'bool', v: true });
  state.runtime.addLabel(hostModel, 0, 0, 0, { k: 'slide_app_summary', t: 'str', v: 'host collision app' });
  const app = createWorkspaceApp(state, {
    id: 'workspace:todo',
    tableId: 'app:delete:todo',
    modelId: 1,
    title: 'Delete To Do',
    ownerPrincipalId: 'local-dev',
  });

  const result = await state.submitEnvelope(mailboxEnvelope('desktop_app_request_delete', {
    opId: 'it0425_app_table_delete',
    value: app,
  }));

  assert.equal(result.result, 'ok');
  const confirm = await state.submitEnvelope(mailboxEnvelope('desktop_app_confirm_delete', {
    opId: 'it0425_app_table_delete_confirm',
  }));
  assert.equal(confirm.result, 'ok');
  assert.ok(state.runtime.getModel({ table_id: 'host', model_id: 1 }), 'host_same_model_id_must_not_be_deleted');
  assert.equal(state.runtime.getModel({ table_id: 'app:delete:todo', model_id: 1 }), undefined, 'app_table_target_must_be_deleted_by_table_ref');

  return { key: 'server_delete_removes_app_table_target_without_host_fallback', status: 'PASS' };
}

const tests = [
  test_two_principals_have_independent_desktop_state_and_registries,
  test_default_development_context_is_explicit_principal_not_shared_fallback,
  test_server_principal_key_takes_authenticated_identity_order_not_client_payload,
  test_task_stack_uses_table_qualified_workspace_identity,
  test_server_accepts_app_table_foreground_update_from_current_registry,
  test_server_delete_removes_app_table_target_without_host_fallback,
];

const results = [];
for (const test of tests) {
  results.push(await test());
}
for (const result of results) {
  console.log(`${result.status} ${result.key}`);
}
console.log(`test_0425_principal_desktop_state_contract: ${results.length} passed`);
