#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const overviewPath = 'docs/user-guide/slide_delivery_and_runtime_overview_v1.md';
const ingressSsotPath = 'docs/ssot/imported_slide_app_host_ingress_semantics_v1.md';

function readText(relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), 'utf8');
}

function assertIncludes(text, needle, label) {
  assert.ok(text.includes(needle), `${label} must include: ${needle}`);
}

function assertNotIncludes(text, needle, label) {
  assert.equal(text.includes(needle), false, `${label} must not include obsolete current wording: ${needle}`);
}

function test_slide_overview_has_four_current_truth_sections() {
  const text = readText(overviewPath);
  for (const heading of ['## 1. 安装交付', '## 2. App 结构', '## 3. 页面运行', '## 4. 外发回流']) {
    assertIncludes(text, heading, overviewPath);
  }
  for (const phrase of [
    'zip -> /api/media/upload -> mxc://... -> importer truth -> importer click pin -> materialize / mount',
    'root metadata',
    'UI projection layer',
    'optional program layer',
    'optional egress adapter',
    '本地 UI 草稿 / overlay 不算正式业务',
    '正式业务 ingress 必须进入 `bus_event_v2 -> Model 0 (0,0,0) pin.bus.in -> pin route -> target`',
    'app root pin.out -> host / mount relay -> Model 0 mt_bus_send -> pin.bus.out -> Matrix / MBR / MQTT -> return packet -> Model 0 -> owner materialization -> target model',
  ]) {
    assertIncludes(text, phrase, overviewPath);
  }
  return { key: 'slide_overview_has_four_current_truth_sections', status: 'PASS' };
}

function test_slide_docs_do_not_claim_direct_cell_formal_ingress() {
  const docs = [overviewPath, ingressSsotPath];
  for (const relPath of docs) {
    const text = readText(relPath);
    for (const obsolete of [
      'server 直接把目标 pin 写到目标 cell',
      '浏览器事件先直达目标 cell',
      '前端 pin 事件仍可直达目标 cell',
      '前端 pin 事件可以直接写目标模型、目标单元格、目标 pin。',
      '并不是所有正式事件都已经统一先进 `Model 0`。',
      '不应把本页内容改写成“当前已实现事实”',
      '在对应实现迭代完成前，这仍然只是候选架构，不是 live code 事实。',
      '本页只作为 **候选正式架构冻结** 使用。',
      '当前事实与候选规约的分界',
      '候选规约',
      '不再是候选',
    ]) {
      assertNotIncludes(text, obsolete, relPath);
    }
  }
  return { key: 'slide_docs_do_not_claim_direct_cell_formal_ingress', status: 'PASS' };
}

function test_imported_slide_ingress_ssot_marks_old_direct_path_historical() {
  const text = readText(ingressSsotPath);
  assertIncludes(text, '0326 之后的 current truth', ingressSsotPath);
  assertIncludes(text, '`bus_event_v2 -> Model 0 (0,0,0) pin.bus.in`', ingressSsotPath);
  assertIncludes(text, '本地 UI 草稿', ingressSsotPath);
  assertIncludes(text, '正式业务 ingress', ingressSsotPath);
  return { key: 'imported_slide_ingress_ssot_marks_old_direct_path_historical', status: 'PASS' };
}

async function main() {
  const tests = [
    test_slide_overview_has_four_current_truth_sections,
    test_slide_docs_do_not_claim_direct_cell_formal_ingress,
    test_imported_slide_ingress_ssot_marks_old_direct_path_historical,
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
