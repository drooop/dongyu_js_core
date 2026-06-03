#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

import { createRenderer as createRendererMjs } from '../../packages/ui-renderer/src/renderer.mjs';

const require = createRequire(import.meta.url);
const { createRenderer: createRendererCjs } = require('../../packages/ui-renderer/src/renderer.js');

const workspacePath = 'packages/worker-base/system-models/workspace_positive_models.json';
const desktopPath = 'packages/worker-base/system-models/desktop_catalog_ui.json';
const rendererPath = 'packages/ui-renderer/src/renderer.mjs';
const rendererCjsPath = 'packages/ui-renderer/src/renderer.js';
const guardPath = 'scripts/ops/playwright_session_guard.sh';
const CHAT_APP_MODEL_ID = 1083;

function readJson(pathname) {
  return JSON.parse(fs.readFileSync(pathname, 'utf8'));
}

function records(pathname) {
  return readJson(pathname).records || [];
}

function label(allRecords, modelId, p, r, c, key) {
  return allRecords.find((record) => record.model_id === modelId
    && record.p === p
    && record.r === r
    && record.c === c
    && record.k === key);
}

function styleOf(allRecords, modelId, p, r, c) {
  return label(allRecords, modelId, p, r, c, 'ui_props_json')?.v?.style || {};
}

function propsOf(allRecords, modelId, p, r, c) {
  return label(allRecords, modelId, p, r, c, 'ui_props_json')?.v || {};
}

function test_matrix_chat_root_uses_viewport_safe_sizing() {
  const allRecords = records(workspacePath);
  const rootStyle = styleOf(allRecords, CHAT_APP_MODEL_ID, 1, 0, 0);
  assert.equal(rootStyle.height, '100%', 'Matrix Chat root must fill the AppWindow slot, not use viewport-relative height');
  assert.equal(rootStyle.minHeight, '0', 'Matrix Chat root must allow the foreground shell to shrink at 100% zoom');
  assert.equal(rootStyle.maxHeight, '100%', 'Matrix Chat root must not exceed its AppWindow slot');
  assert.equal(rootStyle.overflow, 'hidden', 'outer Matrix Chat root must not create document scroll');
  assert.equal(rootStyle.boxSizing, 'border-box', 'root border must be included in the slot size');
  assert.notEqual(rootStyle.height, '78vh', 'old 78vh sizing caused nested overflow and must not return');

  const sidebarStyle = styleOf(allRecords, CHAT_APP_MODEL_ID, 1, 1, 0);
  assert.equal(sidebarStyle.minHeight, '0', 'sidebar must be shrinkable');
  assert.equal(sidebarStyle.overflow, 'hidden', 'sidebar must leave scrolling to the conversation list');
  assert.ok(Number.parseInt(sidebarStyle.width, 10) <= 304, 'sidebar must be compact enough for 1365px-wide browser testing');

  const mainStyle = styleOf(allRecords, CHAT_APP_MODEL_ID, 1, 1, 1);
  assert.equal(mainStyle.overflow, 'hidden', 'main chat column must leave scrolling to timeline/list internals');
  assert.equal(mainStyle.minHeight, '0', 'main chat column must be shrinkable');
  assert.equal(mainStyle.maxHeight, '100%', 'main chat column must not exceed app root');

  const headerStyle = styleOf(allRecords, CHAT_APP_MODEL_ID, 3, 0, 0);
  assert.ok(Number.parseInt(headerStyle.minHeight, 10) <= 64, 'room header must be compact enough for 768px viewport');
  return { key: 'matrix_chat_root_uses_viewport_safe_sizing', status: 'PASS' };
}

function test_foreground_shell_keeps_app_content_internal() {
  const allRecords = records(desktopPath);
  const shellStyle = styleOf(allRecords, -29, 3, 0, 0);
  assert.equal(shellStyle.height, '100dvh', 'foreground shell must lock to the visible viewport height');
  assert.equal(shellStyle.overflow, 'hidden', 'foreground shell must prevent outer document scrolling');
  assert.ok(Number.parseInt(shellStyle.padding, 10) <= 12, 'foreground shell padding must not consume excessive small-screen height');

  const appWindowProps = propsOf(allRecords, -29, 3, 6, 0);
  assert.equal(appWindowProps.contentOverflow, 'hidden', 'focused AppWindow must not add a second outer scroll container');
  assert.equal(appWindowProps.style?.overflow, 'hidden', 'focused AppWindow frame must clip to viewport');
  assert.equal(appWindowProps.style?.minHeight, 0, 'focused AppWindow must be shrinkable inside shell');
  return { key: 'foreground_shell_keeps_app_content_internal', status: 'PASS' };
}

function test_renderer_supports_appwindow_content_overflow_contract() {
  for (const pathname of [rendererPath, rendererCjsPath]) {
    const renderer = fs.readFileSync(pathname, 'utf8');
    assert.match(renderer, /contentOverflow/u, `${pathname} must read AppWindow contentOverflow prop`);
    assert.match(renderer, /cleanShellProps\(props, \['title', 'contentOverflow'\]\)/u, `${pathname} contentOverflow must not leak as a raw DOM attribute`);
    assert.match(renderer, /overflow: contentOverflow/u, `${pathname} AppWindow inner slot must use the configured overflow mode`);
    assert.match(renderer, /value: opt && Object\.prototype\.hasOwnProperty\.call\(opt, 'value'\)/u, `${pathname} RadioGroup options must pass Element Plus value explicitly`);
    assert.match(renderer, /props\.value = props\.label/u, `${pathname} standalone Radio labels must become clickable values`);
  }
  return { key: 'renderer_supports_appwindow_content_overflow_contract', status: 'PASS' };
}

function test_renderer_conversation_list_filter_contract() {
  const ast = {
    type: 'ConversationList',
    props: {
      items: [
        { id: 'person-1', conversation_group: 'people', kind: 'person', list_title: 'mbr', name: 'Remote Matrix Check', list_subtitle: 'Dongyu Local Test' },
        { id: 'room-1', conversation_group: 'rooms', kind: 'room', list_title: '0400 Matrix Chat Temp Room', name: '0400 Matrix Chat Temp Room' },
      ],
      filter: 'people',
      filterField: 'conversation_group',
      filterAllValue: 'all',
      primaryField: 'list_title',
      secondaryField: 'list_subtitle',
    },
  };
  const host = {
    getSnapshot: () => ({ models: {} }),
    dispatchAddLabel: () => {},
    dispatchRmLabel: () => {},
  };
  for (const [name, createRenderer] of [['esm', createRendererMjs], ['cjs', createRendererCjs]]) {
    const tree = createRenderer({ host }).renderTree(ast);
    assert.equal(tree.items?.length, 1, `${name} renderer must filter ConversationList items`);
    assert.equal(tree.items?.[0]?.id, 'person-1', `${name} renderer must keep the People row`);
    assert.equal(tree.items?.[0]?.list_title, 'mbr', `${name} renderer must preserve peer display title`);
    assert.equal(tree.activeId, '', `${name} renderer must expose activeId default`);
  }
  return { key: 'renderer_conversation_list_filter_contract', status: 'PASS' };
}

function test_playwright_guard_is_safe_and_project_scoped() {
  const guard = fs.readFileSync(guardPath, 'utf8');
  assert.match(guard, /DY_PW_SESSION="\$\{DY_PW_SESSION:-dy-0400\}"/u, 'guard must default to one fixed project session');
  assert.match(guard, /\$PWCLI" -s="\$DY_PW_SESSION" close/u, 'guard cleanup must close only the fixed project session');
  assert.match(guard, /\$PWCLI" -s="\$DY_PW_SESSION" delete-data/u, 'guard cleanup must delete data only for the fixed project session');
  assert.equal(/\bclose-all\b/u.test(guard), false, 'guard must not close all Playwright sessions');
  assert.equal(/\bkill-all\b/u.test(guard), false, 'guard must not kill all Playwright sessions');
  assert.match(guard, /playwright_chromiumdev_profile/u, 'guard must check Playwright-managed browser profiles');
  assert.match(guard, /Does not kill ordinary user Chrome windows/u, 'guard must document the no-user-Chrome-kill boundary');
  assert.equal(/pkill .*Chrome/u.test(guard), false, 'guard must not kill ordinary Chrome by process name');
  assert.equal(/killall .*Chrome/u.test(guard), false, 'guard must not use killall Chrome');
  return { key: 'playwright_guard_is_safe_and_project_scoped', status: 'PASS' };
}

const tests = [
  test_matrix_chat_root_uses_viewport_safe_sizing,
  test_foreground_shell_keeps_app_content_internal,
  test_renderer_supports_appwindow_content_overflow_contract,
  test_renderer_conversation_list_filter_contract,
  test_playwright_guard_is_safe_and_project_scoped,
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
