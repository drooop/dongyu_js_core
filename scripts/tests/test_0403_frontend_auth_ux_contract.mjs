#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';

const files = {
  authStore: fs.readFileSync('packages/ui-model-demo-frontend/src/auth_store.js', 'utf8'),
  main: fs.readFileSync('packages/ui-model-demo-frontend/src/main.js', 'utf8'),
  remoteStore: fs.readFileSync('packages/ui-model-demo-frontend/src/remote_store.js', 'utf8'),
  appShell: fs.readFileSync('packages/ui-model-demo-frontend/src/demo_app.js', 'utf8'),
  modelIds: fs.readFileSync('packages/ui-model-demo-frontend/src/model_ids.js', 'utf8'),
  server: fs.readFileSync('packages/ui-model-demo-server/server.mjs', 'utf8'),
};

function assertIncludes(source, needle, message) {
  assert.equal(source.includes(needle), true, message);
}

function test_auth_store_exposes_sso_session_and_permission_state() {
  for (const field of ['provider', 'subject', 'email', 'username', 'roles', 'capabilities', 'matrixConnected', 'matrixUserId']) {
    assertIncludes(files.authStore, field, `auth_store_must_track_${field}`);
  }
  assertIncludes(files.authStore, 'loginWithSso', 'auth_store_must_expose_sso_login');
  assertIncludes(files.authStore, '/auth/sso/start', 'auth_store_must_use_sso_start_endpoint');
  assertIncludes(files.authStore, 'returnTo', 'auth_store_must_preserve_return_to');
  assertIncludes(files.authStore, 'isPageReturnTo', 'auth_store_must_filter_non_page_return_to');
  for (const forbiddenReturnTo of ['/bus_event', '/ui_event', '/api/']) {
    assertIncludes(files.authStore, forbiddenReturnTo, `auth_store_must_reject_return_to_${forbiddenReturnTo}`);
  }
  assertIncludes(files.authStore, 'handleAuthFailure', 'auth_store_must_record_auth_failures');
  assertIncludes(files.authStore, 'permission_denied', 'auth_store_must_support_permission_denied');
  assertIncludes(files.authStore, 'login_required', 'auth_store_must_support_login_required');
  assertIncludes(files.authStore, "error === 'not_authenticated'", 'auth_store_must_treat_not_authenticated_as_login_required');
  assertIncludes(files.authStore, 'clearPrincipal();', 'auth_store_must_clear_stale_principal_on_login_required');
  assertIncludes(files.authStore, "error === 'matrix_session_missing'", 'auth_store_must_handle_missing_matrix_session');
  assertIncludes(files.authStore, 'state.matrixConnected = false;', 'auth_store_must_clear_stale_matrix_connection');
  assertIncludes(files.authStore, 'requiredCapability', 'auth_store_must_track_required_capability');
  assertIncludes(files.authStore, 'connectMatrix', 'auth_store_must_expose_matrix_connect');
  assertIncludes(files.authStore, '/auth/matrix/start', 'auth_store_must_use_matrix_sso_start_endpoint');
  assertIncludes(files.authStore, 'disconnectMatrix', 'auth_store_must_expose_matrix_disconnect');
  assertIncludes(files.authStore, '/auth/matrix/disconnect', 'auth_store_must_use_matrix_disconnect_endpoint');
  assertIncludes(files.authStore, '/auth/logout', 'auth_store_must_use_server_logout_endpoint');
  assertIncludes(files.authStore, 'window.location.assign(logoutUrl)', 'auth_store_logout_must_redirect_browser_through_server');
  assert.equal(files.authStore.includes('data.logoutUrl'), false, 'auth_store_must_not_read_upstream_logout_url_in_page_js');
  assert.equal(files.server.includes("max-age=31536000, immutable"), false, 'server_must_not_pin_frontend_assets_across_auth_hotfixes');
  assertIncludes(files.server, "'cache-control': 'no-cache'", 'server_must_revalidate_frontend_assets');
  return { key: 'auth_store_exposes_sso_session_and_permission_state', status: 'PASS' };
}

function test_remote_mode_instantiates_auth_store() {
  assertIncludes(files.main, "import { createAuthStore } from './auth_store.js';", 'main_must_import_auth_store');
  assertIncludes(files.main, 'const authStore = createAuthStore({ baseUrl: server });', 'main_must_create_remote_auth_store');
  assertIncludes(files.main, 'authStore.checkSession()', 'main_must_check_remote_session');
  assertIncludes(files.main, 'createRemoteStore({ baseUrl: server, authStore })', 'remote_store_must_receive_auth_store');
  assertIncludes(files.main, 'createAppShell({ mainStore: store, galleryStore, authStore })', 'app_shell_must_receive_auth_store');
  return { key: 'remote_mode_instantiates_auth_store', status: 'PASS' };
}

function test_remote_store_reports_server_auth_failures() {
  assertIncludes(files.remoteStore, 'authStore', 'remote_store_must_accept_auth_store');
  assertIncludes(files.remoteStore, 'handleAuthFailure', 'remote_store_must_notify_auth_failure');
  assertIncludes(files.remoteStore, 'login_required', 'remote_store_must_handle_login_required');
  assertIncludes(files.remoteStore, 'not_authenticated', 'remote_store_must_handle_not_authenticated');
  assertIncludes(files.remoteStore, 'permission_denied', 'remote_store_must_handle_permission_denied');
  assertIncludes(files.remoteStore, 'matrix_session_missing', 'remote_store_must_handle_missing_matrix_session');
  assertIncludes(files.remoteStore, 'fetchMatrixStatus', 'remote_store_must_refresh_matrix_status_after_matrix_session_errors');
  assertIncludes(files.remoteStore, 'requiredCapability', 'remote_store_must_forward_required_capability');
  assertIncludes(files.remoteStore, 'canSyncLocalState', 'remote_store_must_not_sync_guest_shell_state_to_write_endpoints');
  assertIncludes(files.remoteStore, 'refreshSnapshot', 'remote_store_must_expose_logout_snapshot_refresh');
  return { key: 'remote_store_reports_server_auth_failures', status: 'PASS' };
}

function test_app_shell_has_polished_auth_controls_and_prompts() {
  assert.equal(files.appShell.includes('CORS_ORIGIN'), false, 'app_shell_must_not_show_technical_no_ast_hint');
  for (const component of ['ElDropdown', 'ElDropdownMenu', 'ElDropdownItem', 'ElTag']) {
    assertIncludes(files.appShell, component, `app_shell_must_use_${component}`);
  }
  for (const testId of [
    'auth-readonly-badge',
    'auth-login-button',
    'auth-user-menu',
    'auth-permission-panel',
    'auth-logout-button',
    'auth-matrix-connect-button',
    'auth-matrix-disconnect-button',
    'auth-matrix-required-panel',
    'auth-matrix-connect-primary',
  ]) {
    assertIncludes(files.appShell, testId, `app_shell_must_render_${testId}`);
  }
  assertIncludes(files.appShell, 'loginWithSso', 'app_shell_login_button_must_start_sso');
  assertIncludes(files.appShell, 'returnTo', 'app_shell_must_preserve_return_to');
  assertIncludes(files.appShell, "refreshSnapshot('logout')", 'app_shell_logout_must_refresh_guest_snapshot');
  assertIncludes(files.appShell, '权限不足', 'app_shell_must_show_permission_denied_copy');
  assertIncludes(files.appShell, '访客只读', 'app_shell_must_show_guest_readonly_affordance');
  assertIncludes(files.appShell, 'connectMatrix', 'app_shell_must_start_matrix_sso');
  assertIncludes(files.appShell, 'disconnectMatrix', 'app_shell_must_disconnect_matrix_session');
  assertIncludes(files.appShell, "marginLeft: 'auto'", 'app_shell_auth_menu_must_stay_right_aligned_without_nav_buttons');
  assertIncludes(files.appShell, 'textOverflow', 'app_shell_auth_menu_must_truncate_long_display_names');
  assertIncludes(files.appShell, "'data-testid': 'foreground-app-layout'", 'foreground_layout_must_have_stable_test_id');
  assertIncludes(files.appShell, "'data-testid': 'foreground-content-slot'", 'foreground_content_slot_must_have_stable_test_id');
  assertIncludes(files.appShell, "height: '100dvh'", 'foreground_layout_must_own_one_viewport_height');
  assertIncludes(files.appShell, "flex: 1", 'foreground_content_slot_must_fill_remaining_height');
  assertIncludes(files.appShell, "minHeight: 0", 'foreground_content_slot_must_be_shrinkable');
  assertIncludes(files.appShell, "appLayout(h(ForegroundPlayer), { foreground: true })", 'foreground_route_must_use_shrinkable_layout');
  return { key: 'app_shell_has_polished_auth_controls_and_prompts', status: 'PASS' };
}

function test_matrix_chat_requires_explicit_matrix_connection_before_live_rooms() {
  assertIncludes(files.modelIds, 'export const MATRIX_CHAT_APP_MODEL_ID = 1083;', 'model_ids_must_export_matrix_chat_app_model_id');
  assertIncludes(files.appShell, "import { MATRIX_CHAT_APP_MODEL_ID } from './model_ids.js';", 'app_shell_must_import_matrix_chat_model_id');
  assertIncludes(files.appShell, 'if (path.value !== ROUTE_HOME) return null;', 'matrix_prompt_must_not_leak_outside_foreground_home_route');
  assertIncludes(files.appShell, 'Number(desktopForegroundApp.value?.model_id) === MATRIX_CHAT_APP_MODEL_ID', 'matrix_prompt_must_only_target_matrix_chat_foreground_app');
  assertIncludes(files.appShell, 'if (authStore.state.matrixConnected) return null;', 'matrix_prompt_must_only_show_before_matrix_connection');
  assertIncludes(files.appShell, 'Matrix 尚未连接', 'matrix_prompt_must_name_unconnected_state');
  assertIncludes(files.appShell, '当前列表是本地初始视图；连接 Matrix 后可刷新为你的远端会话。', 'matrix_prompt_must_explain_seeded_view_without_claiming_live_rooms');
  return { key: 'matrix_chat_requires_explicit_matrix_connection_before_live_rooms', status: 'PASS' };
}

function test_matrix_chat_auto_refreshes_once_after_matrix_connection() {
  assertIncludes(files.appShell, "const MATRIX_CHAT_BUS_KEY = 'matrix_chat_1083_bus_event';", 'matrix_auto_refresh_must_target_chat_bus');
  assertIncludes(files.appShell, "v: 'refresh_rooms'", 'matrix_auto_refresh_must_request_refresh_rooms');
  assertIncludes(files.appShell, 'matrixChatAutoRefreshKeys = new Set()', 'matrix_auto_refresh_must_dedupe_by_session_key');
  assertIncludes(files.appShell, 'const matrixChatAutoRefreshKey = computed(() =>', 'matrix_auto_refresh_must_use_reactive_gate');
  assertIncludes(files.appShell, 'if (path.value !== ROUTE_HOME) return', 'matrix_auto_refresh_must_only_run_on_home_foreground');
  assertIncludes(files.appShell, 'if (!isMatrixChatForeground()) return', 'matrix_auto_refresh_must_only_run_for_matrix_chat_foreground');
  assertIncludes(files.appShell, 'state.authenticated !== true || state.matrixConnected !== true', 'matrix_auto_refresh_must_require_logged_in_matrix_session');
  assertIncludes(files.appShell, "capabilities.includes('matrix:connect')", 'matrix_auto_refresh_must_require_matrix_capability');
  assertIncludes(files.appShell, 'mainStore.buildUiEventV2', 'matrix_auto_refresh_must_use_formal_bus_event_builder');
  assertIncludes(files.appShell, 'mainStore.buildDispatchLabel(envelope)', 'matrix_auto_refresh_must_use_formal_dispatch_label');
  assertIncludes(files.appShell, "source: 'app_shell_auto_refresh'", 'matrix_auto_refresh_must_mark_source');
  assertIncludes(files.appShell, 'watch(matrixChatAutoRefreshKey', 'matrix_auto_refresh_must_watch_session_foreground_key');
  assertIncludes(files.appShell, '{ immediate: true }', 'matrix_auto_refresh_must_fire_when_opening_connected_chat');
  assertIncludes(files.appShell, 'matrixChatAutoRefreshKeys.clear()', 'matrix_auto_refresh_must_allow_refresh_after_reconnect');
  return { key: 'matrix_chat_auto_refreshes_once_after_matrix_connection', status: 'PASS' };
}

const tests = [
  test_auth_store_exposes_sso_session_and_permission_state,
  test_remote_mode_instantiates_auth_store,
  test_remote_store_reports_server_auth_failures,
  test_app_shell_has_polished_auth_controls_and_prompts,
  test_matrix_chat_requires_explicit_matrix_connection_before_live_rooms,
  test_matrix_chat_auto_refreshes_once_after_matrix_connection,
];

let passed = 0;
let failed = 0;
for (const test of tests) {
  try {
    const result = test();
    console.log(`[${result.status}] ${result.key}`);
    passed += 1;
  } catch (error) {
    console.log(`[FAIL] ${test.name}: ${error.stack || error.message}`);
    failed += 1;
  }
}
console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
process.exit(failed > 0 ? 1 : 0);
