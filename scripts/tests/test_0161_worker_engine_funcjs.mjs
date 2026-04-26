#!/usr/bin/env node

import assert from 'node:assert';
import { createRequire } from 'node:module';
import { WorkerEngineV0 } from '../worker_engine_v0.mjs';

const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../../packages/worker-base/src/runtime.js');

function test_worker_engine_executes_structured_func_js() {
  const rt = new ModelTableRuntime();
  rt.createModel({ id: -10, name: 'system', type: 'system' });
  const sys = rt.getModel(-10);
  assert(sys, 'system model missing');

  rt.addLabel(sys, 0, 0, 0, {
    k: 'demo_func',
    t: 'func.js',
    v: {
      code: "ctx.hostApi.writeCrossModel(-10, 0, 0, 0, 'demo_out', 'str', 'ok');",
      modelName: 'test_0161_worker_engine_funcjs',
    },
  });
  rt.addLabel(sys, 0, 0, 0, { k: 'run_demo_func', t: 'str', v: '1' });

  rt.setRuntimeMode('edit');
  rt.setRuntimeMode('running');
  const engine = new WorkerEngineV0({ runtime: rt });
  engine.tick();

  const cell = rt.getCell(sys, 0, 0, 0);
  assert.strictEqual(cell.labels.get('demo_out')?.v, 'ok', 'func.js should execute and write demo_out');
  assert.strictEqual(cell.labels.has('run_demo_func'), false, 'run_* trigger should be removed after execution');
  return { key: 'worker_engine_executes_structured_func_js', status: 'PASS' };
}

function test_worker_engine_ignores_non_funcjs_labels() {
  const rt = new ModelTableRuntime();
  rt.createModel({ id: -10, name: 'system', type: 'system' });
  const sys = rt.getModel(-10);
  assert(sys, 'system model missing');

  rt.addLabel(sys, 0, 0, 0, {
    k: 'legacy_func',
    t: 'str',
    v: "ctx.hostApi.writeCrossModel(-10, 0, 0, 0, 'legacy_out', 'str', 'ok');",
  });
  rt.addLabel(sys, 0, 0, 0, { k: 'run_legacy_func', t: 'str', v: '1' });

  rt.setRuntimeMode('edit');
  rt.setRuntimeMode('running');
  const engine = new WorkerEngineV0({ runtime: rt });
  engine.tick();

  const cell = rt.getCell(sys, 0, 0, 0);
  assert.strictEqual(cell.labels.has('legacy_out'), false, 'non-func.js labels should not execute');
  assert.strictEqual(cell.labels.has('run_legacy_func'), true, 'trigger remains when function label is invalid');
  return { key: 'worker_engine_ignores_non_funcjs_labels', status: 'PASS' };
}

const tests = [
  test_worker_engine_executes_structured_func_js,
  test_worker_engine_ignores_non_funcjs_labels,
];

let passed = 0;
let failed = 0;
for (const t of tests) {
  try {
    const r = t();
    console.log(`[${r.status}] ${r.key}`);
    passed += 1;
  } catch (err) {
    console.log(`[FAIL] ${t.name}: ${err.message}`);
    failed += 1;
  }
}
console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
process.exit(failed > 0 ? 1 : 0);
