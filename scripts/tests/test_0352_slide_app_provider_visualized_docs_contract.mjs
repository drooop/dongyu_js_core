#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const VISUAL_DOC_PATH = 'docs/user-guide/slide-app-runtime/minimal_submit_app_provider_visualized.md';
const INTERACTIVE_DOC_PATH = 'docs/user-guide/slide-app-runtime/minimal_submit_app_provider_interactive.html';
const ROOT_README_PATH = 'docs/user-guide/README.md';
const SLIDE_README_PATH = 'docs/user-guide/slide-app-runtime/README.md';

function readRepoText(path) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
}

function assertIncludes(text, needle, label) {
  assert.ok(text.includes(needle), `${label} missing: ${needle}`);
}

function assertMatches(text, pattern, label) {
  assert.match(text, pattern, `${label} missing pattern: ${pattern}`);
}

function assertNoLegacyCalls(text, label) {
  assert.equal(/ctx\.(writeLabel|getLabel|rmLabel)\s*\(/u.test(text), false, `${label} must not call legacy ctx label APIs`);
}

function test_visualized_doc_explains_dual_bus_flow() {
  const doc = readRepoText(VISUAL_DOC_PATH);
  assertIncludes(doc, '最小 Submit 双总线示例', VISUAL_DOC_PATH);
  assertIncludes(doc, 'remote-worker R1', VISUAL_DOC_PATH);
  assertIncludes(doc, 'bus_event_submit_1050_0_0_0', VISUAL_DOC_PATH);
  assertIncludes(doc, 'dy.bus.v0', VISUAL_DOC_PATH);
  assertIncludes(doc, 'UIPUT/ws/dam/pic/de/sw/1050/submit', VISUAL_DOC_PATH);
  assertIncludes(doc, 'UIPUT/ws/dam/pic/de/sw/1050/result', VISUAL_DOC_PATH);
  assertIncludes(doc, 'Workspace 导入过程', VISUAL_DOC_PATH);
  assertIncludes(doc, 'app_payload.json', VISUAL_DOC_PATH);
  assertIncludes(doc, 'Submitted: <输入内容>', VISUAL_DOC_PATH);
  assertMatches(doc, /```mermaid\nsequenceDiagram/u, VISUAL_DOC_PATH);
  assertMatches(doc, /```mermaid\nflowchart TB/u, VISUAL_DOC_PATH);
  assertNoLegacyCalls(doc, VISUAL_DOC_PATH);
  return { key: 'visualized_doc_explains_dual_bus_flow', status: 'PASS' };
}

function test_visualized_doc_rejects_legacy_and_fallbacks() {
  const doc = readRepoText(VISUAL_DOC_PATH);
  assertIncludes(doc, '不接受 `input_value` 旧字段兜底', VISUAL_DOC_PATH);
  assertIncludes(doc, '无 `pin.connect.model`', VISUAL_DOC_PATH);
  assertIncludes(doc, '无 `ctx.writeLabel/getLabel/rmLabel`', VISUAL_DOC_PATH);
  assertIncludes(doc, '无 `input_value` 兼容兜底', VISUAL_DOC_PATH);
  assert.equal(/V1N\.writeLabel/u.test(doc), false, 'visualized doc must not show transitional V1N.writeLabel');
  return { key: 'visualized_doc_rejects_legacy_and_fallbacks', status: 'PASS' };
}

function test_interactive_html_is_self_contained() {
  const html = readRepoText(INTERACTIVE_DOC_PATH);
  assertIncludes(html, '<!DOCTYPE html>', INTERACTIVE_DOC_PATH);
  assertIncludes(html, '<link rel="icon" href="data:,">', INTERACTIVE_DOC_PATH);
  assert.equal(/<script\s+[^>]*src=/iu.test(html), false, 'interactive doc must not load external scripts');
  assert.equal(/<link\s+[^>]*href=(?!["']data:,)/iu.test(html), false, 'interactive doc must not load external styles/fonts/images');
  assert.equal(/https?:\/\//iu.test(html), false, 'interactive doc must not reference network resources');
  return { key: 'interactive_html_is_self_contained', status: 'PASS' };
}

function test_interactive_html_covers_dual_bus_contract() {
  const html = readRepoText(INTERACTIVE_DOC_PATH);
  for (const id of ['demoInput', 'demoSubmit', 'demoOutput', 'demoStatus', 'inlinePayloadPreview', 'payloadPreview']) {
    assertMatches(html, new RegExp(`id=["']${id}["']`, 'u'), INTERACTIVE_DOC_PATH);
  }
  for (const stage of ['overview', 'r1', 'ui', 'import', 'external', 'guard']) {
    assertMatches(html, new RegExp(`data-stage=["']${stage}["']`, 'u'), INTERACTIVE_DOC_PATH);
    assertIncludes(html, `id="stage-${stage}"`, INTERACTIVE_DOC_PATH);
  }
  assertIncludes(html, '最小 Submit 双总线示例', INTERACTIVE_DOC_PATH);
  assertIncludes(html, 'bus_event_submit_1050_0_0_0', INTERACTIVE_DOC_PATH);
  assertIncludes(html, 'UIPUT/ws/dam/pic/de/sw/1050/submit', INTERACTIVE_DOC_PATH);
  assertIncludes(html, 'UIPUT/ws/dam/pic/de/sw/1050/result', INTERACTIVE_DOC_PATH);
  assertIncludes(html, 'minimal-submit-dual-bus.zip', INTERACTIVE_DOC_PATH);
  assertIncludes(html, 'app_payload.json', INTERACTIVE_DOC_PATH);
  assertIncludes(html, "k: 'text'", INTERACTIVE_DOC_PATH);
  assertIncludes(html, "status.textContent = 'REMOTE remote_processed';", INTERACTIVE_DOC_PATH);
  assertNoLegacyCalls(html, INTERACTIVE_DOC_PATH);
  return { key: 'interactive_html_covers_dual_bus_contract', status: 'PASS' };
}

function test_user_guide_indexes_link_visual_and_interactive_docs() {
  const rootReadme = readRepoText(ROOT_README_PATH);
  const slideReadme = readRepoText(SLIDE_README_PATH);
  assertIncludes(rootReadme, '0360', ROOT_README_PATH);
  assertIncludes(rootReadme, '可视化说明和交互式 HTML', ROOT_README_PATH);
  assertIncludes(slideReadme, 'minimal_submit_app_provider_visualized.md', SLIDE_README_PATH);
  assertIncludes(slideReadme, 'minimal_submit_app_provider_interactive.html', SLIDE_README_PATH);
  return { key: 'user_guide_indexes_link_visual_and_interactive_docs', status: 'PASS' };
}

const tests = [
  test_visualized_doc_explains_dual_bus_flow,
  test_visualized_doc_rejects_legacy_and_fallbacks,
  test_interactive_html_is_self_contained,
  test_interactive_html_covers_dual_bus_contract,
  test_user_guide_indexes_link_visual_and_interactive_docs,
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
