#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

import { createRenderer as createEsmRenderer } from '../../packages/ui-renderer/src/renderer.mjs';
import registryRaw from '../../packages/ui-renderer/src/component_registry_v1.json' with { type: 'json' };
import { createDemoStore } from '../../packages/ui-model-demo-frontend/src/demo_modeltable.js';
import { DESKTOP_APP_VIEW_MODE_LABEL } from '../../packages/ui-model-demo-frontend/src/desktop_app_state.js';
import { createRemoteStore } from '../../packages/ui-model-demo-frontend/src/remote_store.js';
import { resolveRouteUiAst } from '../../packages/ui-model-demo-frontend/src/route_ui_projection.js';
import { buildAstFromCellwiseModel } from '../../packages/ui-model-demo-frontend/src/ui_cellwise_projection.js';

const EXPECTED_BUILTIN_APPS = Object.freeze({
  Docs: { id: 'workspace:-23', kind: 'workspace', page: 'workspace', path: '/workspace', model_id: -23 },
  Settings: { id: 'workspace:1081', kind: 'workspace', page: 'workspace', path: '/workspace', model_id: 1081 },
  ModelTable: { id: 'workspace:1082', kind: 'workspace', page: 'workspace', path: '/workspace', model_id: 1082 },
  'Matrix Suite': { id: 'workspace:1080', kind: 'workspace', page: 'workspace', path: '/workspace', model_id: 1080 },
  'Mgmt Bus Console': { id: 'workspace:1036', kind: 'workspace', page: 'workspace', path: '/workspace', model_id: 1036 },
});

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function collectNodes(ast, predicate = () => true) {
  const out = [];
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    if (predicate(node)) out.push(node);
    for (const child of Array.isArray(node.children) ? node.children : []) visit(child);
  };
  visit(ast);
  return out;
}

function nodeText(node) {
  if (!node || typeof node !== 'object') return '';
  const props = node.props && typeof node.props === 'object' ? node.props : {};
  return String(props.text ?? props.label ?? props.title ?? node.text ?? '');
}

function assertLaunchTarget(actual, expected, messagePrefix) {
  assert.ok(actual && typeof actual === 'object', `${messagePrefix}_launch_payload_missing`);
  for (const key of ['id', 'kind', 'page', 'path', 'model_id']) {
    assert.equal(actual[key], expected[key], `${messagePrefix}_launch_${key}_mismatch`);
  }
}

function collectNodesOutside(root, excludedNode, predicate = () => true) {
  const out = [];
  const visit = (node, insideExcluded = false) => {
    if (!node || typeof node !== 'object') return;
    const nextInside = insideExcluded || node === excludedNode;
    if (!nextInside && predicate(node)) out.push(node);
    for (const child of Array.isArray(node.children) ? node.children : []) visit(child, nextInside);
  };
  visit(root, false);
  return out;
}

function desktopAst() {
  const store = createDemoStore({ uiMode: 'v1', adapterMode: 'v1' });
  return resolveRouteUiAst(store.snapshot, '/')?.ast;
}

function workspaceRegistry() {
  const store = createDemoStore({ uiMode: 'v1', adapterMode: 'v1' });
  const raw = store.snapshot?.models?.['-2']?.cells?.['0,0,0']?.labels?.ws_apps_registry?.v;
  return Array.isArray(raw) ? raw : [];
}

function test_iteration_0390_registered_for_execution() {
  const text = readFileSync('docs/ITERATIONS.md', 'utf8');
  assert.match(text, /0390-focused-app-shell-settings/, 'iteration_0390_must_be_registered');
  assert.match(text, /0390-focused-app-shell-settings[^\n]*In Progress/, 'iteration_0390_must_be_in_progress_after_user_approval');
  return { key: 'iteration_0390_registered_for_execution', status: 'PASS' };
}

function test_drawer_and_dialog_are_model_components() {
  const components = registryRaw?.components ?? {};
  for (const type of ['Drawer', 'Dialog']) {
    assert.equal(components[type]?.tree_kind, type, `${type}_tree_kind_missing`);
    assert.equal(components[type]?.vnode_kind, type, `${type}_vnode_kind_missing`);
  }

  const ast = {
    id: 'root',
    type: 'Container',
    children: [
      { id: 'drawer', type: 'Drawer', props: { title: 'Details' }, children: [{ id: 'drawer_text', type: 'Text', props: { text: 'Drawer body' } }] },
      { id: 'dialog', type: 'Dialog', props: { title: 'Confirm' }, children: [{ id: 'dialog_text', type: 'Text', props: { text: 'Dialog body' } }] },
    ],
  };
  const tree = createEsmRenderer({
    host: {
      getSnapshot: () => ({ models: {} }),
      dispatchAddLabel: () => {},
      dispatchRmLabel: () => {},
    },
  }).renderTree(ast);
  assert.equal(tree.children[0].type, 'Drawer', 'drawer_must_survive_render_tree');
  assert.ok(Array.isArray(tree.children[0].children) && tree.children[0].children.length > 0, 'drawer_children_must_be_rendered');
  assert.equal(tree.children[0].children[0].text, 'Drawer body', 'drawer_children_must_survive_render_tree');
  assert.equal(tree.children[1].type, 'Dialog', 'dialog_must_survive_render_tree');
  assert.ok(Array.isArray(tree.children[1].children) && tree.children[1].children.length > 0, 'dialog_children_must_be_rendered');
  assert.equal(tree.children[1].children[0].text, 'Dialog body', 'dialog_children_must_survive_render_tree');

  const makeH = (tag, props, children) => ({ tag, props: props || {}, children });
  const emitted = [];
  const vnodeRenderer = createEsmRenderer({
    host: {
      getSnapshot: () => ({ models: {} }),
      dispatchAddLabel: (label) => emitted.push(label),
      dispatchRmLabel: () => {},
    },
    vue: { h: makeH, resolveComponent: (name) => name },
  });
  const vnode = vnodeRenderer.renderVNode({
    id: 'drawer_vnode',
    type: 'Drawer',
    props: { title: 'Details', placement: 'right', size: '360px' },
    bind: {
      read: { model_id: -2, p: 0, r: 0, c: 0, k: 'drawer_open' },
      write: { action: 'label_update', target_ref: { model_id: -2, p: 0, r: 0, c: 0, k: 'drawer_open' }, value_ref: { t: 'bool', v: false } },
    },
    children: [{ id: 'drawer_vnode_text', type: 'Text', props: { text: 'Body' } }],
  });
  assert.equal(vnode.tag, 'ElDrawer', 'drawer_must_render_element_plus_drawer_vnode');
  assert.equal(vnode.props.title, 'Details', 'drawer_vnode_title_missing');
  assert.equal(vnode.props.placement, 'right', 'drawer_vnode_placement_missing');
  assert.equal(vnode.props.size, '360px', 'drawer_vnode_size_missing');
  assert.equal(typeof vnode.props['onUpdate:modelValue'], 'function', 'drawer_vnode_update_binding_missing');
  vnode.props['onUpdate:modelValue'](true);
  assert.equal(emitted.at(-1)?.v?.payload?.target?.k, 'drawer_open', 'drawer_update_must_dispatch_bound_label');

  const dialogVNode = vnodeRenderer.renderVNode({
    id: 'dialog_vnode',
    type: 'Dialog',
    props: { title: 'Confirm action', width: '420px' },
    bind: {
      read: { model_id: -2, p: 0, r: 0, c: 0, k: 'dialog_open' },
      write: { action: 'label_update', target_ref: { model_id: -2, p: 0, r: 0, c: 0, k: 'dialog_open' }, value_ref: { t: 'bool', v: false } },
    },
    children: [{ id: 'dialog_vnode_text', type: 'Text', props: { text: 'Confirm body' } }],
  });
  assert.equal(dialogVNode.tag, 'ElDialog', 'dialog_must_render_element_plus_dialog_vnode');
  assert.equal(dialogVNode.props.title, 'Confirm action', 'dialog_vnode_title_missing');
  assert.equal(dialogVNode.props.width, '420px', 'dialog_vnode_width_missing');
  assert.equal(typeof dialogVNode.props['onUpdate:modelValue'], 'function', 'dialog_vnode_update_binding_missing');
  dialogVNode.props['onUpdate:modelValue'](true);
  assert.equal(emitted.at(-1)?.v?.payload?.target?.k, 'dialog_open', 'dialog_update_must_dispatch_bound_label');
  return { key: 'drawer_and_dialog_are_model_components', status: 'PASS' };
}

function test_desktop_is_simplified_fullscreen_launcher() {
  const ast = desktopAst();
  assert.ok(ast, 'desktop_ast_missing');
  const types = collectNodes(ast, (node) => typeof node.type === 'string').map((node) => node.type);
  assert.ok(!types.includes('NavigationRail'), 'desktop_must_not_render_navigation_rail_or_sidebar');
  assert.ok(!types.includes('QuickSettingsPanel'), 'desktop_must_not_render_quick_settings_panel');

  const texts = collectNodes(ast).map(nodeText).filter(Boolean);
  for (const forbidden of ['Today', 'Shell Contract', 'Workspace', 'Quick Settings']) {
    assert.ok(!texts.includes(forbidden), `desktop_must_not_render_${forbidden.replaceAll(' ', '_')}`);
  }
  for (const text of texts) {
    assert.ok(!/^(available\s+|slide\s+)?apps?$/i.test(text.trim()), `desktop_must_not_render_app_heading_${text}`);
  }

  const rootStyle = ast.props?.style ?? {};
  assert.equal(rootStyle.width, '100%', 'desktop_root_must_fill_available_width_without_outer_scroll');
  assert.equal(rootStyle.height, '100%', 'desktop_root_must_fill_app_shell_content_slot');
  assert.equal(rootStyle.overflow, 'hidden', 'desktop_root_must_prevent_outer_scroll');
  const desktopCatalog = readFileSync('packages/worker-base/system-models/desktop_catalog_ui.json', 'utf8');
  assert.match(desktopCatalog, /desktop_builtin_grid/, 'desktop_shell_frame_must_be_defined_in_cellwise_model');
  assert.match(desktopCatalog, /desktop_slid_in_grid/, 'desktop_shell_frame_must_expose_cellwise_app_slots');
  assert.match(
    readFileSync('docs/iterations/0390-focused-app-shell-settings/resolution.md', 'utf8'),
    /document\.scrollingElement|outer scrolling|no outer scrolling/i,
    'browser_verification_must_cover_outer_scroll',
  );
  return { key: 'desktop_is_simplified_fullscreen_launcher', status: 'PASS' };
}

function test_dock_contains_only_home_tasks_mb_and_docs_is_listed() {
  const ast = desktopAst();
  const taskbar = collectNodes(ast, (node) => node.type === 'Taskbar')[0];
  assert.ok(taskbar, 'desktop_taskbar_missing');
  const labels = collectNodes(taskbar, (node) => node.type === 'Button').map((node) => node.props?.label).filter(Boolean);
  assert.deepEqual(labels, ['Home', 'Tasks', 'MB'], 'dock_must_contain_only_home_tasks_mb');

  const mbButton = collectNodes(taskbar, (node) => node.type === 'Button' && node.props?.label === 'MB')[0];
  const mbTarget = mbButton?.bind?.write?.value_ref?.v;
  assertLaunchTarget(mbTarget, EXPECTED_BUILTIN_APPS['Matrix Suite'], 'mb_dock_must_open_matrix_suite_task');

  const cards = collectNodes(ast, (node) => node.type === 'AppCard');
  const titles = cards.map((node) => node.props?.title).filter(Boolean);
  assert.ok(titles.includes('Docs'), 'docs_must_appear_in_slide_app_list');
  assert.ok(!labels.includes('Docs'), 'docs_must_not_appear_in_dock');
  return { key: 'dock_contains_only_home_tasks_mb_and_docs_is_listed', status: 'PASS' };
}

function test_app_list_groups_builtin_and_slid_in_sources() {
  const ast = desktopAst();
  const visibleTexts = collectNodes(ast).map(nodeText).filter(Boolean);
  assert.ok(visibleTexts.includes('Built-in'), 'desktop_builtin_group_heading_missing');
  assert.ok(visibleTexts.includes('Slid in from DE'), 'desktop_slid_in_group_heading_missing');

  const cards = collectNodes(ast, (node) => node.type === 'AppCard');
  assert.ok(cards.some((node) => node.props?.appOrigin === 'builtin'), 'builtin_app_cards_missing');
  assert.ok(cards.some((node) => node.props?.appOrigin === 'slid_in'), 'slid_in_app_cards_missing');

  for (const card of cards.filter((node) => node.props?.appOrigin === 'slid_in')) {
    const source = String(card.props?.sourceDE ?? '').trim();
    assert.ok(source.length > 0, `${card.id}_slid_in_source_de_missing`);
  }

  const store = createDemoStore({ uiMode: 'v1', adapterMode: 'v1' });
  const snapshot = cloneJson(store.snapshot);
  const registry = snapshot.models['-2'].cells['0,0,0'].labels.ws_apps_registry.v;
  registry.push({
    model_id: 1999,
    name: 'Broken Source App',
    summary: 'Fixture with missing source metadata.',
    slide_capable: true,
    slide_surface_type: 'workspace.page',
    app_origin: 'slid_in',
    source_de: '',
  });
  const fixtureAst = resolveRouteUiAst(snapshot, '/')?.ast;
  const fixtureCard = collectNodes(fixtureAst, (node) => node.type === 'AppCard' && node.props?.title === 'Broken Source App')[0];
  assert.equal(fixtureCard?.props?.sourceDE, 'source unknown', 'missing_source_de_must_render_source_unknown');
  const renderedCard = createEsmRenderer({
    host: {
      getSnapshot: () => ({ models: {} }),
      dispatchAddLabel: () => {},
      dispatchRmLabel: () => {},
    },
    vue: { h: (tag, props, children) => ({ tag, props: props || {}, children }), resolveComponent: (name) => name },
  }).renderVNode(fixtureCard);
  assert.match(JSON.stringify(renderedCard), /From source unknown/, 'app_card_must_visibly_render_slid_in_source_de');
  const spoofedBuiltinSnapshot = cloneJson(store.snapshot);
  const spoofedRegistry = spoofedBuiltinSnapshot.models['-2'].cells['0,0,0'].labels.ws_apps_registry.v;
  spoofedRegistry.push({
    model_id: 1998,
    name: 'Spoofed Builtin App',
    summary: 'Fixture trying to self-claim builtin origin.',
    slide_capable: true,
    slide_surface_type: 'workspace.page',
    app_origin: 'builtin',
    source_de: '',
  });
  const spoofedAst = resolveRouteUiAst(spoofedBuiltinSnapshot, '/')?.ast;
  const spoofedCard = collectNodes(spoofedAst, (node) => node.type === 'AppCard' && node.props?.title === 'Spoofed Builtin App')[0];
  assert.equal(spoofedCard?.props?.appOrigin, 'slid_in', 'slid_in_app_must_not_self_claim_builtin_origin');
  assert.equal(spoofedCard?.props?.sourceDE, 'source unknown', 'spoofed_builtin_must_still_show_source_unknown');
  return { key: 'app_list_groups_builtin_and_slid_in_sources', status: 'PASS' };
}

function test_settings_mt_matrix_docs_registry_contract() {
  const registry = workspaceRegistry();
  const byName = new Map(registry.map((entry) => [entry?.name, entry]));

  assert.equal(byName.get('Docs')?.app_origin, 'builtin', 'docs_must_be_builtin_app_list_entry');
  assert.equal(byName.get('Settings')?.app_origin, 'builtin', 'settings_must_be_builtin_slide_app');
  assert.equal(byName.get('ModelTable')?.app_origin, 'builtin', 'modeltable_must_be_builtin_slide_app');
  assert.equal(byName.get('Matrix Suite')?.app_origin, 'builtin', 'matrix_suite_must_be_builtin_mb_target');
  assert.equal(byName.get('Mgmt Bus Console')?.app_origin, 'builtin', 'mgmt_bus_console_must_be_builtin_slide_app');
  assert.equal(byName.get('Mgmt Bus Console')?.source, 'ui-server', 'mgmt_bus_console_must_be_owned_by_ui_server');

  const ast = desktopAst();
  const cards = collectNodes(ast, (node) => node.type === 'AppCard');
  for (const title of ['Docs', 'Settings', 'ModelTable', 'Matrix Suite', 'Mgmt Bus Console']) {
    const card = cards.find((node) => node.props?.title === title);
    assert.ok(card, `${title}_app_card_missing`);
    assert.equal(card.bind?.write?.action, 'label_update', `${title}_must_launch_through_label_update`);
    assert.equal(card.bind?.write?.target_ref?.k, 'desktop_foreground_app_json', `${title}_must_launch_as_desktop_foreground_app`);
    assertLaunchTarget(card.bind?.write?.value_ref?.v, EXPECTED_BUILTIN_APPS[title], `${title}_launch_payload_must_target_correct_builtin_app`);
  }

  const slid = registry.filter((entry) => entry?.app_origin === 'slid_in');
  assert.ok(slid.length > 0, 'registry_must_have_slid_in_apps');
  for (const entry of slid) {
    assert.ok(String(entry.source_de ?? '').trim(), `${entry.name}_source_de_missing`);
  }
  for (const name of ['E2E 颜色生成器', '最小 Submit 双总线示例', '工作区管理器']) {
    const source = byName.get(name)?.source_de;
    assert.ok(source && source !== 'source unknown', `${name}_seeded_app_must_have_real_source_de`);
  }
  const modelTableStore = createDemoStore({ uiMode: 'v1', adapterMode: 'v1' });
  const modelTableSnapshot = cloneJson(modelTableStore.snapshot);
  modelTableSnapshot.models['-2'].cells['0,0,0'].labels.ws_app_selected.v = 1082;
  const modelTableAst = resolveRouteUiAst(modelTableSnapshot, '/workspace')?.ast;
  assert.ok(collectNodes(modelTableAst, (node) => node.id === 'ws_not_mounted').length === 0, 'modeltable_app_1082_must_be_mounted_into_workspace');
  assert.ok(collectNodes(modelTableAst, (node) => node.id === 'tbl_home_cells' && node.type === 'Table').length === 1, 'modeltable_app_1082_must_own_modeltable_table');
  assert.ok(collectNodes(modelTableAst, (node) => node.id === 'btn_home_open_create' && node.props?.label === 'Add Label').length === 1, 'modeltable_app_1082_must_expose_create_action');
  assert.ok(collectNodes(modelTableAst, (node) => node.id === 'btn_home_open_edit' && node.props?.label === 'Edit').length === 1, 'modeltable_app_1082_must_expose_edit_action');
  assert.ok(collectNodes(modelTableAst, (node) => node.id === 'btn_home_delete_label' && node.props?.label === 'Delete').length === 1, 'modeltable_app_1082_must_expose_delete_action');
  return { key: 'settings_mt_matrix_docs_registry_contract', status: 'PASS' };
}

function test_workspace_manager_install_complete_dialog_is_cellwise() {
  const store = createDemoStore({ uiMode: 'v1', adapterMode: 'v1' });
  const ast = buildAstFromCellwiseModel(store.snapshot, 1051);
  const dialog = collectNodes(ast, (node) => node.id === 'workspace_asset_install_complete_dialog')[0];
  assert.equal(dialog?.type, 'Dialog', 'workspace_manager_install_complete_dialog_must_be_cellwise_dialog');
  assert.equal(dialog?.bind?.read?.k, 'asset_install_dialog_open', 'install_complete_dialog_must_read_open_state_from_modeltable_label');
  assert.equal(dialog?.bind?.write?.action, 'workspace_asset_close_install_dialog', 'install_complete_dialog_close_must_dispatch_model_action');
  assert.equal(dialog?.props?.title?.$label?.k, 'asset_install_dialog_title', 'install_complete_dialog_title_must_be_bound_to_label');

  const body = collectNodes(dialog, (node) => node.id === 'workspace_asset_install_complete_text')[0];
  assert.equal(body?.type, 'Text', 'install_complete_dialog_must_render_body_text');
  assert.equal(body?.bind?.read?.k, 'asset_install_dialog_text', 'install_complete_dialog_body_must_be_bound_to_label');

  const openButton = collectNodes(dialog, (node) => node.id === 'workspace_asset_open_installed_button')[0];
  const closeButton = collectNodes(dialog, (node) => node.id === 'workspace_asset_close_install_complete_button')[0];
  assert.equal(openButton?.type, 'Button', 'install_complete_dialog_open_button_missing');
  assert.equal(openButton?.props?.label, '打开', 'install_complete_dialog_open_button_label_must_be_open');
  assert.equal(openButton?.bind?.write?.action, 'workspace_asset_open_installed_app', 'install_complete_dialog_open_button_must_dispatch_open_action');
  assert.equal(closeButton?.bind?.write?.action, 'workspace_asset_close_install_dialog', 'install_complete_dialog_close_button_must_dispatch_close_action');
  return { key: 'workspace_manager_install_complete_dialog_is_cellwise', status: 'PASS' };
}

function test_desktop_supports_compact_cards_and_list_view() {
  const store = createDemoStore({ uiMode: 'v1', adapterMode: 'v1' });
  const cardAst = resolveRouteUiAst(store.snapshot, '/')?.ast;
  const viewButtons = collectNodes(cardAst, (node) => node.type === 'Button' && ['卡片', '列表'].includes(String(node.props?.label ?? '')));
  assert.deepEqual(viewButtons.map((node) => node.props.label), ['卡片', '列表'], 'desktop_must_render_card_list_view_switch_buttons');
  for (const button of viewButtons) {
    assert.equal(button.bind?.write?.action, 'label_update', `${button.props.label}_view_button_must_write_local_view_mode`);
    assert.equal(button.bind?.write?.target_ref?.k, DESKTOP_APP_VIEW_MODE_LABEL, `${button.props.label}_view_button_must_target_desktop_view_mode_label`);
  }
  assert.equal(viewButtons[0].bind?.write?.value_ref?.v, 'cards', 'card_view_button_must_write_cards_mode');
  assert.equal(viewButtons[1].bind?.write?.value_ref?.v, 'list', 'list_view_button_must_write_list_mode');

  const cards = collectNodes(cardAst, (node) => node.type === 'AppCard');
  assert.ok(cards.length > 0, 'desktop_card_view_must_render_app_cards');
  for (const card of cards) {
    assert.equal(card.props?.displayMode, 'cards', `${card.id}_must_receive_cards_display_mode`);
    assert.equal(card.props?.density, 'compact', `${card.id}_must_receive_compact_density`);
    assert.equal(card.props?.sourcePlacement, 'cornerBadge', `${card.id}_must_place_source_badge_as_corner_metadata`);
  }
  const firstRenderedCard = createEsmRenderer({
    host: {
      getSnapshot: () => ({ models: {} }),
      dispatchAddLabel: () => {},
      dispatchRmLabel: () => {},
    },
    vue: { h: (tag, props, children) => ({ tag, props: props || {}, children }), resolveComponent: (name) => name },
  }).renderVNode(cards[0]);
  assert.equal(firstRenderedCard.props?.style?.minHeight, '108px', 'compact_app_card_must_be_shorter_than_original_loose_card');
  assert.match(JSON.stringify(firstRenderedCard), /Built-in|From /u, 'compact_app_card_must_render_source_badge');

  const listSnapshot = cloneJson(store.snapshot);
  listSnapshot.models['-2'].cells['0,0,0'].labels[DESKTOP_APP_VIEW_MODE_LABEL] = { t: 'str', v: 'list' };
  const listAst = resolveRouteUiAst(listSnapshot, '/')?.ast;
  const grids = collectNodes(listAst, (node) => node.type === 'DesktopGrid');
  assert.ok(grids.length >= 2, 'desktop_list_view_must_keep_builtin_and_slid_in_sections');
  for (const grid of grids) {
    assert.equal(grid.props?.variant, 'list', `${grid.id}_must_switch_to_list_variant`);
  }
  const listCards = collectNodes(listAst, (node) => node.type === 'AppCard');
  assert.ok(listCards.length > 0, 'desktop_list_view_must_still_render_app_entries');
  for (const card of listCards) {
    assert.equal(card.props?.displayMode, 'list', `${card.id}_must_receive_list_display_mode`);
  }
  return { key: 'desktop_supports_compact_cards_and_list_view', status: 'PASS' };
}

function test_desktop_app_management_delete_contract() {
  const desktopCatalog = readFileSync('packages/worker-base/system-models/desktop_catalog_ui.json', 'utf8');
  for (const key of [
    'desktop_app_manage_mode',
    'desktop_delete_confirm_open',
    'desktop_delete_confirm_target_json',
    'desktop_delete_result_open',
    'desktop_delete_confirm_dialog',
    'desktop_delete_result_dialog',
  ]) {
    assert.match(desktopCatalog, new RegExp(key), `${key}_must_be_declared_in_cellwise_desktop_model`);
  }

  const store = createDemoStore({ uiMode: 'v1', adapterMode: 'v1' });
  const snapshot = cloneJson(store.snapshot);
  const labels = snapshot.models['-2'].cells['0,0,0'].labels;
  labels.desktop_app_manage_mode = { k: 'desktop_app_manage_mode', t: 'bool', v: true };
  labels.ws_apps_registry.v.push({
    model_id: 2099,
    name: 'Deletable Demo',
    summary: 'A compact slid-in app for delete contract.',
    slide_capable: true,
    slide_surface_type: 'workspace.page',
    deletable: true,
    app_origin: 'slid_in',
    source_de: 'Delete-DE',
  });
  const ast = resolveRouteUiAst(snapshot, '/')?.ast;
  const targetCard = collectNodes(ast, (node) => node.type === 'AppCard' && node.props?.title === 'Deletable Demo')[0];
  assert.ok(targetCard, 'deletable_fixture_card_missing');
  assert.equal(targetCard.props?.manageMode, true, 'management_mode_must_reach_appcard_props');
  assert.equal(targetCard.props?.deletable, true, 'deletable_slid_in_app_must_enable_delete_operation');
  assert.equal(targetCard.bind?.contextmenu?.write?.action, 'desktop_app_request_delete', 'appcard_context_menu_must_offer_delete_action');
  assert.equal(targetCard.bind?.contextmenu?.write?.value_ref?.v?.model_id, 2099, 'context_menu_delete_must_carry_target_model_id');
  assert.equal(targetCard.bind?.delete?.write?.action, 'desktop_app_request_delete', 'delete_icon_must_request_confirmation');
  assert.equal(targetCard.bind?.delete?.write?.value_ref?.v?.model_id, 2099, 'delete_request_must_carry_target_model_id');

  const renderer = createEsmRenderer({
    host: {
      getSnapshot: () => snapshot,
      dispatchAddLabel: () => {},
      dispatchRmLabel: () => {},
    },
    vue: { h: (tag, props, children) => ({ tag, props: props || {}, children }), resolveComponent: (name) => name },
  });
  const renderedCard = renderer.renderVNode({
    id: 'card_layout_fixture',
    type: 'AppCard',
    props: {
      title: 'Long Layout Title',
      summary: 'This summary should use the body area instead of sitting under a separate icon block.',
      mark: 'XX',
      appOrigin: 'slid_in',
      sourceDE: 'Layout-DE',
      displayMode: 'cards',
      density: 'compact',
      manageMode: true,
      deletable: true,
    },
    bind: {
      contextmenu: {
        write: {
          action: 'desktop_app_request_delete',
          value_ref: { t: 'json', v: { model_id: 2099, title: 'Long Layout Title' } },
        },
      },
      delete: {
        write: {
          action: 'desktop_app_request_delete',
          value_ref: { t: 'json', v: { model_id: 2099, title: 'Long Layout Title' } },
        },
      },
    },
    children: [],
  });
  const renderedJson = JSON.stringify(renderedCard);
  assert.match(renderedJson, /删除 Long Layout Title/, 'management_mode_card_must_render_accessible_delete_icon');
  assert.doesNotMatch(renderedJson, />删除</, 'management_mode_delete_control_must_be_icon_only');
  assert.match(renderedJson, /"right":"10px"/, 'management_mode_card_delete_icon_must_be_positioned_top_right');
  assert.doesNotMatch(renderedJson, /"left":"10px"/, 'management_mode_card_delete_icon_must_not_use_top_left_position');
  assert.doesNotMatch(renderedJson, /"XX"/, 'compact_card_must_not_render_old_icon_mark_block');
  assert.match(renderedJson, /Long Layout Title/, 'card_title_must_use_the_former_icon_area_prominently');

  const renderedList = renderer.renderVNode({
    id: 'list_layout_fixture',
    type: 'AppCard',
    props: {
      title: 'List Layout Title',
      summary: 'List summary',
      mark: 'LL',
      appOrigin: 'slid_in',
      sourceDE: 'Layout-DE',
      displayMode: 'list',
      density: 'compact',
      manageMode: true,
      deletable: true,
    },
    bind: {
      delete: {
        write: {
          action: 'desktop_app_request_delete',
          value_ref: { t: 'json', v: { model_id: 2099, title: 'List Layout Title' } },
        },
      },
    },
    children: [],
  });
  assert.match(JSON.stringify(renderedList), /删除/, 'list_view_must_expose_delete_operation_in_management_mode');
  return { key: 'desktop_app_management_delete_contract', status: 'PASS' };
}

function test_appcard_context_menu_dispatches_delete_once() {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    url: 'http://127.0.0.1:30900/',
    pretendToBeVisual: true,
  });
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  globalThis.document = dom.window.document;
  globalThis.window = dom.window;
  try {
    const emitted = [];
    const renderer = createEsmRenderer({
      host: {
        getSnapshot: () => ({ models: {} }),
        dispatchAddLabel: (label) => emitted.push(label),
        dispatchRmLabel: () => {},
      },
      vue: { h: (tag, props, children) => ({ tag, props: props || {}, children }), resolveComponent: (name) => name },
    });
    const renderedCard = renderer.renderVNode({
      id: 'context_menu_dispatch_fixture',
      type: 'AppCard',
      props: {
        title: 'Context Delete Demo',
        summary: 'Right click should open one delete action.',
        appOrigin: 'slid_in',
        sourceDE: 'Review-DE',
        displayMode: 'cards',
        density: 'compact',
        deletable: true,
      },
      bind: {
        contextmenu: {
          write: {
            action: 'desktop_app_request_delete',
            value_ref: { t: 'json', v: { model_id: 2099, title: 'Context Delete Demo' } },
          },
        },
      },
      children: [],
    });
    assert.equal(typeof renderedCard.props?.onContextmenu, 'function', 'appcard_contextmenu_handler_missing');
    renderedCard.props.onContextmenu({
      clientX: 42,
      clientY: 64,
      preventDefault() {},
      stopPropagation() {},
    });
    const menu = dom.window.document.querySelector('.dy-app-context-menu');
    assert.ok(menu, 'right_click_must_open_context_menu');
    assert.match(menu.textContent || '', /删除/, 'context_menu_must_show_delete_action');
    const item = menu.querySelector('[role="menuitem"]');
    assert.ok(item, 'context_menu_delete_item_missing');
    item.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    assert.equal(emitted.length, 1, 'context_menu_delete_must_dispatch_once');
    assert.equal(emitted[0]?.v?.payload?.action, 'desktop_app_request_delete', 'context_menu_delete_action_mismatch');
    assert.equal(emitted[0]?.v?.payload?.value?.v?.model_id, 2099, 'context_menu_delete_target_model_id_mismatch');
    assert.equal(dom.window.document.querySelector('.dy-app-context-menu'), null, 'context_menu_must_close_after_delete_click');
    return { key: 'appcard_context_menu_dispatches_delete_once', status: 'PASS' };
  } finally {
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
    dom.window.close();
  }
}

function test_appcard_context_menu_outside_click_closes_without_delete() {
  const dom = new JSDOM('<!doctype html><html><body><main id="outside"></main></body></html>', {
    url: 'http://127.0.0.1:30900/',
    pretendToBeVisual: true,
  });
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  globalThis.document = dom.window.document;
  globalThis.window = dom.window;
  try {
    const emitted = [];
    const renderer = createEsmRenderer({
      host: {
        getSnapshot: () => ({ models: {} }),
        dispatchAddLabel: (label) => emitted.push(label),
        dispatchRmLabel: () => {},
      },
      vue: { h: (tag, props, children) => ({ tag, props: props || {}, children }), resolveComponent: (name) => name },
    });
    const renderedCard = renderer.renderVNode({
      id: 'context_menu_outside_click_fixture',
      type: 'AppCard',
      props: {
        title: 'Outside Click Demo',
        appOrigin: 'slid_in',
        sourceDE: 'Review-DE',
        displayMode: 'cards',
        deletable: true,
      },
      bind: {
        contextmenu: {
          write: {
            action: 'desktop_app_request_delete',
            value_ref: { t: 'json', v: { model_id: 2100, title: 'Outside Click Demo' } },
          },
        },
      },
      children: [],
    });
    renderedCard.props.onContextmenu({
      clientX: 42,
      clientY: 64,
      preventDefault() {},
      stopPropagation() {},
    });
    assert.ok(dom.window.document.querySelector('.dy-app-context-menu'), 'right_click_must_open_context_menu_before_outside_click');
    dom.window.document.getElementById('outside').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    assert.equal(dom.window.document.querySelector('.dy-app-context-menu'), null, 'outside_click_must_close_context_menu');
    assert.equal(emitted.length, 0, 'outside_click_must_not_dispatch_delete');
    return { key: 'appcard_context_menu_outside_click_closes_without_delete', status: 'PASS' };
  } finally {
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
    dom.window.close();
  }
}

function test_appcard_context_menu_reopen_cleans_old_listeners() {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    url: 'http://127.0.0.1:30900/',
    pretendToBeVisual: true,
  });
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  globalThis.document = dom.window.document;
  globalThis.window = dom.window;
  try {
    const emitted = [];
    const renderer = createEsmRenderer({
      host: {
        getSnapshot: () => ({ models: {} }),
        dispatchAddLabel: (label) => emitted.push(label),
        dispatchRmLabel: () => {},
      },
      vue: { h: (tag, props, children) => ({ tag, props: props || {}, children }), resolveComponent: (name) => name },
    });
    const makeCard = (modelId, title) => renderer.renderVNode({
      id: `context_menu_reopen_${modelId}`,
      type: 'AppCard',
      props: {
        title,
        appOrigin: 'slid_in',
        sourceDE: 'Review-DE',
        displayMode: 'cards',
        deletable: true,
      },
      bind: {
        contextmenu: {
          write: {
            action: 'desktop_app_request_delete',
            value_ref: { t: 'json', v: { model_id: modelId, title } },
          },
        },
      },
      children: [],
    });
    const firstCard = makeCard(2101, 'First Reopen Demo');
    const secondCard = makeCard(2102, 'Second Reopen Demo');
    firstCard.props.onContextmenu({
      clientX: 40,
      clientY: 50,
      preventDefault() {},
      stopPropagation() {},
    });
    assert.equal(dom.window.document.querySelectorAll('.dy-app-context-menu').length, 1, 'first_context_menu_must_open');
    secondCard.props.onContextmenu({
      clientX: 80,
      clientY: 100,
      preventDefault() {},
      stopPropagation() {},
    });
    assert.equal(dom.window.document.querySelectorAll('.dy-app-context-menu').length, 1, 'reopen_must_replace_old_context_menu');
    const item = dom.window.document.querySelector('.dy-app-context-menu [role="menuitem"]');
    assert.ok(item, 'reopened_context_menu_delete_item_missing');
    item.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    assert.equal(emitted.length, 1, 'reopened_context_menu_delete_must_dispatch_once');
    assert.equal(emitted[0]?.v?.payload?.value?.v?.model_id, 2102, 'reopened_context_menu_must_dispatch_latest_target');
    assert.equal(dom.window.document.querySelector('.dy-app-context-menu'), null, 'reopened_context_menu_must_close_after_delete_click');
    return { key: 'appcard_context_menu_reopen_cleans_old_listeners', status: 'PASS' };
  } finally {
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
    dom.window.close();
  }
}

function test_remote_store_route_override_supports_foreground_workspace_apps() {
  const localStore = createDemoStore({ uiMode: 'v1', adapterMode: 'v1' });
  const remoteStore = createRemoteStore({ baseUrl: 'http://127.0.0.1:30900', autoBootstrap: false });
  const remoteSnapshot = cloneJson(localStore.snapshot);
  remoteStore.snapshot.models = remoteSnapshot.models;
  remoteStore.snapshot.v1nConfig = remoteSnapshot.v1nConfig;
  remoteStore.snapshot.models['-2'].cells['0,0,0'].labels.ws_app_selected.v = 1082;
  remoteStore.setRoutePath('/');

  assert.equal(remoteStore.getUiAst()?.id, 'desktop_root', 'remote_store_default_getUiAst_must_use_current_route');
  const foregroundAst = remoteStore.getUiAst('/workspace');
  assert.ok(collectNodes(foregroundAst, (node) => node.id === 'tbl_home_cells').length === 1, 'remote_store_route_override_must_render_modeltable_1082_crud_surface');
  return { key: 'remote_store_route_override_supports_foreground_workspace_apps', status: 'PASS' };
}

async function test_foreground_shell_contract_ast() {
  let module;
  try {
    module = await import('../../packages/ui-model-demo-frontend/src/desktop_foreground_shell_ast.js');
  } catch (err) {
    throw new Error(`foreground_shell_ast_module_missing: ${err && err.message ? err.message : err}`);
  }
  assert.equal(typeof module.buildForegroundShellAst, 'function', 'foreground_shell_ast_builder_must_be_exported_for_contract_testing');
  const store = createDemoStore({ uiMode: 'v1', adapterMode: 'v1' });
  const ast = module.buildForegroundShellAst({
    id: 'workspace:100',
    kind: 'workspace',
    page: 'workspace',
    path: '/workspace',
    title: 'E2E 颜色生成器',
    model_id: 100,
  }, store.snapshot);
  const types = collectNodes(ast, (node) => typeof node.type === 'string').map((node) => node.type);
  assert.ok(!types.includes('QuickSettingsPanel'), 'foreground_must_not_render_inline_quick_settings_panel');
  assert.ok(!types.includes('SplitPaneWindow'), 'foreground_must_not_render_always_visible_split_pane');
  const buttons = collectNodes(ast, (node) => node.type === 'Button');
  assert.ok(!buttons.some((node) => node.bind?.write?.target_ref?.k === 'desktop_quick_settings_open'), 'foreground_must_not_keep_inline_settings_toggle');
  const settingsButton = buttons.find((node) => node.props?.label === '设置' || node.props?.label === 'Settings');
  assert.ok(settingsButton, 'foreground_settings_button_missing');
  assertLaunchTarget(settingsButton.bind?.write?.value_ref?.v, EXPECTED_BUILTIN_APPS.Settings, 'foreground_settings_button_must_open_settings_app');
  assert.ok(types.includes('Drawer'), 'foreground_must_use_drawer_for_app_auxiliary_panel');
  const drawer = collectNodes(ast, (node) => node.type === 'Drawer')[0];
  assert.equal(drawer?.props?.['data-testid'], 'desktop-app-detail-drawer', 'foreground_drawer_must_have_test_id');
  assert.equal(drawer?.props?.modelValue, false, 'foreground_detail_drawer_must_default_closed');
  assert.equal(drawer?.bind?.read?.k, 'desktop_app_detail_drawer_open', 'foreground_detail_drawer_must_have_open_read_binding');
  assert.equal(drawer?.bind?.write?.target_ref?.k, 'desktop_app_detail_drawer_open', 'foreground_detail_drawer_must_have_open_write_binding');
  const visibleAppWindowOutsideDrawer = collectNodesOutside(ast, drawer, (node) => {
    const text = nodeText(node);
    return node.type === 'SplitPaneWindow'
      || (node.type === 'WidgetPanel' && ['App Window', 'Details', '详情'].includes(String(node.props?.title ?? '')))
      || node.props?.['data-testid'] === 'desktop-window-inspector'
      || text.includes('Split-pane-ready frame')
      || text.includes('App Window');
  });
  assert.equal(visibleAppWindowOutsideDrawer.length, 0, 'foreground_app_window_auxiliary_content_must_not_render_outside_drawer');
  const rootStyle = ast.props?.style ?? {};
  assert.equal(rootStyle.width, '100%', 'foreground_root_must_fill_available_width_without_outer_scroll');
  assert.equal(rootStyle.height, '100%', 'embedded_foreground_root_must_fill_app_shell_content_slot');
  assert.equal(rootStyle.overflow, 'hidden', 'foreground_root_must_prevent_outer_scroll');
  const foregroundSource = readFileSync('packages/ui-model-demo-frontend/src/desktop_foreground_shell_ast.js', 'utf8');
  assert.match(foregroundSource, /buildAstFromCellwiseModel/, 'foreground_shell_must_load_cellwise_model_template');
  assert.match(readFileSync('packages/worker-base/system-models/desktop_catalog_ui.json', 'utf8'), /desktop_foreground_shell_model/, 'foreground_shell_template_must_be_in_cellwise_model_patch');
  return { key: 'foreground_shell_contract_source', status: 'PASS' };
}

async function test_focused_workspace_app_content_renders_app_itself() {
  let module;
  try {
    module = await import('../../packages/ui-model-demo-frontend/src/desktop_focused_app_content.js');
  } catch (err) {
    throw new Error(`focused_app_content_module_missing: ${err && err.message ? err.message : err}`);
  }
  assert.equal(typeof module.buildFocusedWorkspaceAppContentAst, 'function', 'focused_app_content_builder_must_be_exported');

  const store = createDemoStore({ uiMode: 'v1', adapterMode: 'v1' });
  const ast = module.buildFocusedWorkspaceAppContentAst({
    id: 'workspace:100',
    kind: 'workspace',
    page: 'workspace',
    path: '/workspace',
    title: 'E2E 颜色生成器',
    model_id: 100,
  }, store.snapshot);
  assert.ok(ast && typeof ast === 'object', 'focused_workspace_app_content_ast_missing');

  const texts = collectNodes(ast).map(nodeText).filter(Boolean);
  assert.ok(texts.includes('E2E 颜色生成器'), 'focused_app_must_render_selected_app_title');
  assert.ok(texts.includes('当前实际消息路径'), 'focused_app_must_render_selected_app_body');
  assert.ok(!texts.includes('资产树 ASSET TREE'), 'focused_app_must_not_render_workspace_asset_tree');
  assert.ok(!texts.includes('Sliding Flow Shell · E2E 颜色生成器'), 'focused_app_must_not_wrap_selected_app_in_old_flow_shell');
  assert.ok(!texts.includes('APP'), 'focused_app_must_not_render_old_flow_shell_app_heading');

  const source = readFileSync('packages/ui-model-demo-frontend/src/demo_app.js', 'utf8');
  assert.match(source, /buildFocusedWorkspaceAppContentAst/, 'foreground_player_must_use_focused_app_content_builder');
  assert.match(source, /watch\(desktopForegroundKey[\s\S]*setHashPath\(ROUTE_HOME\)/, 'foreground_modeltable_open_action_must_return_to_desktop_route');
  assert.doesNotMatch(
    source,
    /const content = app\.page === 'gallery' \? h\(GalleryRoot\) : h\(ForegroundRouteRoot\)/,
    'foreground_player_must_not_render_workspace_route_shell_for_focused_apps',
  );
  return { key: 'focused_workspace_app_content_renders_app_itself', status: 'PASS' };
}

const tests = [
  test_iteration_0390_registered_for_execution,
  test_drawer_and_dialog_are_model_components,
  test_desktop_is_simplified_fullscreen_launcher,
  test_dock_contains_only_home_tasks_mb_and_docs_is_listed,
  test_app_list_groups_builtin_and_slid_in_sources,
  test_settings_mt_matrix_docs_registry_contract,
  test_workspace_manager_install_complete_dialog_is_cellwise,
  test_desktop_supports_compact_cards_and_list_view,
  test_desktop_app_management_delete_contract,
  test_appcard_context_menu_dispatches_delete_once,
  test_appcard_context_menu_outside_click_closes_without_delete,
  test_appcard_context_menu_reopen_cleans_old_listeners,
  test_remote_store_route_override_supports_foreground_workspace_apps,
  test_foreground_shell_contract_ast,
  test_focused_workspace_app_content_renders_app_itself,
];

let failed = 0;
for (const test of tests) {
  try {
    const result = await test();
    console.log(`[PASS] ${result.key}`);
  } catch (err) {
    failed += 1;
    console.error(`[FAIL] ${test.name}: ${err && err.message ? err.message : err}`);
  }
}

if (failed > 0) {
  console.error(`${tests.length - failed} passed, ${failed} failed out of ${tests.length}`);
  process.exit(1);
}

console.log(`${tests.length} passed, 0 failed out of ${tests.length}`);
