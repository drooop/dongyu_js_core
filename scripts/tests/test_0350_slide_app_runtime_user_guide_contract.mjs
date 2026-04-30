#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');

const guidePath = 'docs/user-guide/slide-app-runtime/slide_app_runtime_developer_guide.md';
const indexPath = 'docs/user-guide/slide-app-runtime/README.md';
const htmlPath = 'docs/user-guide/slide-app-runtime/slide_app_runtime_flow_visualized.html';
const userGuideIndexPath = 'docs/user-guide/README.md';
const defaultProgramsPath = 'packages/worker-base/system-models/default_table_programs.json';
const rendererPath = 'packages/ui-renderer/src/renderer.mjs';
const remoteStorePath = 'packages/ui-model-demo-frontend/src/remote_store.js';
const serverPath = 'packages/ui-model-demo-server/server.mjs';

function readText(relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), 'utf8');
}

function readJson(relPath) {
  return JSON.parse(readText(relPath));
}

function assertIncludes(text, needle, label) {
  assert.ok(text.includes(needle), `${label} must include: ${needle}`);
}

function assertNotIncludes(text, needle, label) {
  assert.equal(text.includes(needle), false, `${label} must not include: ${needle}`);
}

function test_guide_covers_required_slide_runtime_sections() {
  const text = readText(guidePath);
  for (const heading of [
    '## 2. root 第 0 格默认有什么',
    '## 3. 编写一个滑动 APP',
    '## 4. 安装部署过程',
    '## 5. 安装时哪些引脚会自动建立',
    '## 6. 点击按钮后怎样到达后端目标 cell',
    '## 7. 后端程序模型如何编写和触发',
    '## 8. UI 模型怎样向自己的第 0 格发管理总线消息',
  ]) {
    assertIncludes(text, heading, guidePath);
  }
  for (const phrase of [
    'zip -> /api/media/upload -> mxc://... -> importer truth -> importer click pin -> materialize / mount',
    '正式业务数据在传输过程中使用临时 ModelTable record array',
    '不要把它理解成三对普通业务引脚',
    'bus_event_v2 -> Model 0 (0,0,0) pin.bus.in -> pin route -> target',
    'host_ingress_v1',
    '__host_ingress_submit',
    'imported_host_submit_<modelId>',
    '__host_egress_submit_relay_<modelId>',
    'bridge_imported_submit_to_mt_bus_send_<modelId>',
    'mt_bus_send_in',
    'pin.bus.out',
    'owner materialization',
  ]) {
    assertIncludes(text, phrase, guidePath);
  }
  for (const obsolete of [
    '浏览器事件先直达目标 cell',
    '前端直接写目标业务 truth',
    'ctx.writeLabel / ctx.getLabel 口径仍可使用',
  ]) {
    assertNotIncludes(text, obsolete, guidePath);
  }
  return { key: 'guide_covers_required_slide_runtime_sections', status: 'PASS' };
}

function test_visualized_html_is_self_contained_and_has_all_stages() {
  const text = readText(htmlPath);
  for (const id of ['author', 'install', 'auto-pins', 'click', 'backend', 'egress']) {
    assertIncludes(text, `id="${id}"`, htmlPath);
    assertIncludes(text, `data-target="${id}"`, htmlPath);
  }
  for (const phrase of [
    'ModelTable-driven Slide App',
    'zip / upload / importer / mount',
    'host ingress / host egress',
    'bus_event_v2 / Model 0 / target cell',
    'mt_bus_send / pin.bus.out / owner materialization',
  ]) {
    assertIncludes(text, phrase, htmlPath);
  }
  assertNotIncludes(text, 'https://', htmlPath);
  assertNotIncludes(text, 'http://', htmlPath);
  return { key: 'visualized_html_is_self_contained_and_has_all_stages', status: 'PASS' };
}

function test_indexes_link_new_slide_runtime_folder() {
  assertIncludes(readText(userGuideIndexPath), 'slide-app-runtime/', userGuideIndexPath);
  assertIncludes(readText(indexPath), 'slide_app_runtime_developer_guide.md', indexPath);
  assertIncludes(readText(indexPath), 'slide_app_runtime_flow_visualized.html', indexPath);
  return { key: 'indexes_link_new_slide_runtime_folder', status: 'PASS' };
}

function test_default_root_program_contract_matches_guide() {
  const records = readJson(defaultProgramsPath).records || [];
  const byKey = new Map(records.map((record) => [record.k, record]));
  const expected = {
    mt_write: 'func.js',
    mt_write_req: 'pin.in',
    mt_write_result: 'pin.out',
    mt_write_req_route: 'pin.connect.label',
    mt_bus_receive: 'func.js',
    mt_bus_receive_in: 'pin.in',
    mt_bus_receive_wiring: 'pin.connect.label',
    mt_bus_send: 'func.js',
    mt_bus_send_in: 'pin.in',
    mt_bus_send_wiring: 'pin.connect.label',
  };
  for (const [key, type] of Object.entries(expected)) {
    assert.equal(byKey.get(key)?.t, type, `default root program label ${key} must remain ${type}`);
  }
  return { key: 'default_root_program_contract_matches_guide', status: 'PASS' };
}

function test_runtime_code_still_supports_documented_event_and_adapter_path() {
  const renderer = readText(rendererPath);
  const remoteStore = readText(remoteStorePath);
  const server = readText(serverPath);
  for (const phrase of [
    "target.bus_event_v2 === true",
    "type: 'bus_event_v2'",
    'buildBusDispatchLabel(envelope)',
  ]) {
    assertIncludes(renderer, phrase, rendererPath);
  }
  assertIncludes(remoteStore, "const BUS_EVENT_ENDPOINT_PATH = '/bus_event';", remoteStorePath);
  assertIncludes(remoteStore, "rawEnvelope && rawEnvelope.type === 'bus_event_v2'", remoteStorePath);
  for (const phrase of [
    "const SLIDE_IMPORT_HOST_INGRESS_LABEL = 'host_ingress_v1';",
    'function buildImportedHostIngressKeys',
    'function materializeImportedHostIngressAdapter',
    'function materializeImportedHostEgressAdapter',
    "V1N.addLabel('mt_bus_send_in', 'pin.in', [",
    "t: 'pin.bus.in'",
    "t: 'pin.bus.out'",
    "runtime.addLabel(model0, 0, 0, 0, {",
  ]) {
    assertIncludes(server, phrase, serverPath);
  }
  return { key: 'runtime_code_still_supports_documented_event_and_adapter_path', status: 'PASS' };
}

async function main() {
  const tests = [
    test_guide_covers_required_slide_runtime_sections,
    test_visualized_html_is_self_contained_and_has_all_stages,
    test_indexes_link_new_slide_runtime_folder,
    test_default_root_program_contract_matches_guide,
    test_runtime_code_still_supports_documented_event_and_adapter_path,
  ];
  const results = [];
  for (const test of tests) {
    results.push(await test());
  }
  console.log(JSON.stringify({ ok: true, results }, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
