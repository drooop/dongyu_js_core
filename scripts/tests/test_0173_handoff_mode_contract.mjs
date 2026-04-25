#!/usr/bin/env node

import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..', '..');
const agentsPath = resolve(repoRoot, 'AGENTS.md');
const docPath = resolve(repoRoot, 'CODEX_HANDOFF_MODE.md');

function readText(path) {
  return readFileSync(path, 'utf8');
}

function test_agents_points_to_handoff_doc() {
  const text = readText(agentsPath);
  assert(text.includes('CODEX_HANDOFF_MODE.md'));
  assert(text.includes('Codex developer workflow supplements'));
  return { key: 'agents_points_to_handoff_doc', status: 'PASS' };
}

function test_handoff_doc_contains_toggle_and_confirmations() {
  const text = readText(docPath);
  assert(text.includes('$dropmode'));
  assert(text.includes('正常 skill 触发机制'));
  assert(text.includes('只在最终输出执行'));
  assert(text.includes('升级后继续'));
  assert(text.includes('降级后继续'));
  assert(text.includes('compact_handoff'));
  assert(text.includes('effort_suggestion'));
  return { key: 'handoff_doc_contains_toggle_and_confirmations', status: 'PASS' };
}

function test_handoff_doc_states_default_and_ignore_behavior() {
  const text = readText(docPath);
  assert(text.includes('`dropmode` 默认开启'));
  assert(text.includes('用户未明确同意迁移前'));
  assert(text.includes('必须继续当前对话'));
  assert(text.includes('dropmode_session_mode'));
  assert(text.includes('/status'));
  assert(text.includes('配置或 profile 线索'));
  return { key: 'handoff_doc_states_default_and_ignore_behavior', status: 'PASS' };
}

function test_handoff_doc_requires_exact_toggle_and_pending_confirmation() {
  const text = readText(docPath);
  assert(text.includes('只输出一条结果语句'));
  assert(text.includes('不得输出交接摘要'));
  assert(text.includes('当前没有匹配的 pending 建议'));
  assert(text.includes('target session mode'));
  assert(text.includes('commentary'));
  return { key: 'handoff_doc_requires_exact_toggle_and_pending_confirmation', status: 'PASS' };
}

const tests = [
  test_agents_points_to_handoff_doc,
  test_handoff_doc_contains_toggle_and_confirmations,
  test_handoff_doc_states_default_and_ignore_behavior,
  test_handoff_doc_requires_exact_toggle_and_pending_confirmation,
];

let failed = 0;
for (const testFn of tests) {
  try {
    const result = testFn();
    console.log(`[${result.status}] ${result.key}`);
  } catch (error) {
    failed += 1;
    console.error(`[FAIL] ${testFn.name}: ${error.message}`);
  }
}

if (failed > 0) {
  process.exit(1);
}

console.log('PASS test_0173_handoff_mode_contract');
