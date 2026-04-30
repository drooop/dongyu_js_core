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

function test_visualized_doc_explains_provider_flow() {
  const doc = readRepoText(VISUAL_DOC_PATH);
  assertIncludes(doc, 'cellwise UI labels', VISUAL_DOC_PATH);
  assertIncludes(doc, '临时 ModelTable records', VISUAL_DOC_PATH);
  assertIncludes(doc, 'handle_submit', VISUAL_DOC_PATH);
  assertIncludes(doc, 'display_text', VISUAL_DOC_PATH);
  assertIncludes(doc, 'host_ingress_v1', VISUAL_DOC_PATH);
  assertIncludes(doc, 'submit_request', VISUAL_DOC_PATH);
  assertIncludes(doc, 'V1N.addLabel', VISUAL_DOC_PATH);
  assertMatches(doc, /```mermaid\nflowchart LR/u, VISUAL_DOC_PATH);
  assertMatches(doc, /```mermaid\nsequenceDiagram/u, VISUAL_DOC_PATH);
  assertMatches(doc, /\|\s*`\(2,2,0\)`\s*\|\s*输入框/u, VISUAL_DOC_PATH);
  assertMatches(doc, /\|\s*`\(2,3,0\)`\s*\|\s*Submit 按钮/u, VISUAL_DOC_PATH);
  return { key: 'visualized_doc_explains_provider_flow', status: 'PASS' };
}

function test_visualized_doc_rejects_legacy_and_host_owned_shortcuts() {
  const doc = readRepoText(VISUAL_DOC_PATH);
  assertIncludes(doc, '按钮直接写 `display_text`', VISUAL_DOC_PATH);
  assertIncludes(doc, '宿主 Model 0 路由', VISUAL_DOC_PATH);
  assertIncludes(doc, '整页 HTML 字符串', VISUAL_DOC_PATH);
  assert.equal(/ctx\.(writeLabel|getLabel|rmLabel)\s*\(/u.test(doc), false, 'visualized doc must not show callable legacy ctx label APIs');
  assert.equal(/V1N\.writeLabel/u.test(doc), false, 'visualized doc must not show transitional V1N.writeLabel');
  return { key: 'visualized_doc_rejects_legacy_and_host_owned_shortcuts', status: 'PASS' };
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

function test_interactive_html_covers_submit_simulation_contract() {
  const html = readRepoText(INTERACTIVE_DOC_PATH);
  for (const id of ['demoInput', 'demoSubmit', 'demoOutput', 'inlinePayloadPreview', 'payloadPreview', 'handlerPreview']) {
    assertMatches(html, new RegExp(`id=["']${id}["']`, 'u'), INTERACTIVE_DOC_PATH);
  }
  for (const stage of ['mental', 'cells', 'payload', 'program', 'package']) {
    assertMatches(html, new RegExp(`data-stage=["']${stage}["']`, 'u'), INTERACTIVE_DOC_PATH);
    assertIncludes(html, `id="stage-${stage}"`, INTERACTIVE_DOC_PATH);
  }
  assertIncludes(html, "k: '__mt_payload_kind'", INTERACTIVE_DOC_PATH);
  assertIncludes(html, "v: 'ui_event.v1'", INTERACTIVE_DOC_PATH);
  assertIncludes(html, "k: 'text'", INTERACTIVE_DOC_PATH);
  assertIncludes(html, "output.textContent = text ? `Submitted: ${text}` : 'Submitted: (empty)';", INTERACTIVE_DOC_PATH);
  assertIncludes(html, 'inlinePayloadPreview.textContent = json;', INTERACTIVE_DOC_PATH);
  assert.equal(/submit\.addEventListener\('click'[\s\S]*showStage\('payload'\)/u.test(html), false, 'submit must keep display-label preview visible after writeback');
  assertIncludes(html, "V1N.addLabel('display_text', 'str', displayText);", INTERACTIVE_DOC_PATH);
  assert.equal(/ctx\.(writeLabel|getLabel|rmLabel)\s*\(/u.test(html), false, 'interactive doc must not show callable legacy ctx label APIs');
  return { key: 'interactive_html_covers_submit_simulation_contract', status: 'PASS' };
}

function test_user_guide_indexes_link_visual_and_interactive_docs() {
  const rootReadme = readRepoText(ROOT_README_PATH);
  const slideReadme = readRepoText(SLIDE_README_PATH);
  assertIncludes(rootReadme, '0352', ROOT_README_PATH);
  assertIncludes(rootReadme, '可视化说明和交互式 HTML', ROOT_README_PATH);
  assertIncludes(slideReadme, 'minimal_submit_app_provider_visualized.md', SLIDE_README_PATH);
  assertIncludes(slideReadme, 'minimal_submit_app_provider_interactive.html', SLIDE_README_PATH);
  return { key: 'user_guide_indexes_link_visual_and_interactive_docs', status: 'PASS' };
}

const tests = [
  test_visualized_doc_explains_provider_flow,
  test_visualized_doc_rejects_legacy_and_host_owned_shortcuts,
  test_interactive_html_is_self_contained,
  test_interactive_html_covers_submit_simulation_contract,
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
