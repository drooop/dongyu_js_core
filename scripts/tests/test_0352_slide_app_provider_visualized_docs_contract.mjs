#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..', '..');
const VISUAL = 'docs/user-guide/slide-app-runtime/minimal_submit_app_provider_visualized.md';
const HTML = 'docs/user-guide/slide-app-runtime/minimal_submit_app_provider_interactive.html';
function read(path) { return fs.readFileSync(resolve(repoRoot, path), 'utf8'); }
function assertIncludes(text, needle, label) { assert.equal(text.includes(needle), true, label + ' missing: ' + needle); }
function assertNoOld(text, label) {
  assert.equal(text.includes('/1050/'), false, label + ' must not mention old 1050 topics');
  assert.equal(text.includes('bus_event_submit_1050_0_0_0'), false, label + ' must not mention old fixed bus key');
  assert.equal(text.includes('mbr_route_'), false, label + ' must not mention static MBR routes');
}

function test_visualized_doc_explains_route_flow() {
  const doc = read(VISUAL);
  assertIncludes(doc, 'route.to', VISUAL);
  assertIncludes(doc, 'route.reply_to', VISUAL);
  assertIncludes(doc, 'submit1_route', VISUAL);
  assertIncludes(doc, 'worker/RE/model/3000/pin/submit1', VISUAL);
  assertIncludes(doc, 'worker/ui-server-U1/model/2000/pin/result', VISUAL);
  assertNoOld(doc, VISUAL);
  return { key: 'visualized_doc_explains_route_flow', status: 'PASS' };
}

function test_interactive_html_covers_route_contract() {
  const html = read(HTML);
  assertIncludes(html, 'route.to', HTML);
  assertIncludes(html, 'route.reply_to', HTML);
  assertIncludes(html, 'submit1_route', HTML);
  assertIncludes(html, 'UIPUT/ws/dam/pic/de/sw/worker/RE/model/3000/pin/submit1', HTML);
  assertIncludes(html, 'UIPUT/ws/dam/pic/de/sw/worker/ui-server-U1/model/2000/pin/result', HTML);
  assertNoOld(html, HTML);
  return { key: 'interactive_html_covers_route_contract', status: 'PASS' };
}

function test_interactive_html_is_self_contained() {
  const html = read(HTML);
  assert.match(html, /<!doctype html>|<!DOCTYPE html>/u, 'interactive HTML must be standalone');
  assert.equal(/<script[^>]+src=/u.test(html), false, 'interactive HTML must not require external scripts');
  assert.equal(/<link[^>]+rel=["']stylesheet["'][^>]+href=/u.test(html), false, 'interactive HTML must not require external stylesheets');
  return { key: 'interactive_html_is_self_contained', status: 'PASS' };
}

function test_user_guide_indexes_link_visual_and_interactive_docs() {
  const index = read('docs/user-guide/slide-app-runtime/README.md');
  assertIncludes(index, 'minimal_submit_app_provider_visualized.md', 'slide-app-runtime README');
  assertIncludes(index, 'minimal_submit_app_provider_interactive.html', 'slide-app-runtime README');
  return { key: 'user_guide_indexes_link_visual_and_interactive_docs', status: 'PASS' };
}

const tests = [test_visualized_doc_explains_route_flow, test_interactive_html_covers_route_contract, test_interactive_html_is_self_contained, test_user_guide_indexes_link_visual_and_interactive_docs];
let passed = 0;
let failed = 0;
for (const test of tests) {
  try { const result = test(); console.log('[' + result.status + '] ' + result.key); passed += 1; }
  catch (error) { console.log('[FAIL] ' + test.name + ': ' + (error.stack || error.message)); failed += 1; }
}
console.log('\n' + passed + ' passed, ' + failed + ' failed out of ' + tests.length);
process.exit(failed > 0 ? 1 : 0);
