import assert from 'node:assert';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../../packages/worker-base/src/runtime.js');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const mt = (k, t, v) => [{ id: 0, p: 0, r: 0, c: 0, k, t, v }];

async function test_func_js_structured_value_executes() {
  const rt = new ModelTableRuntime();
  rt.setRuntimeMode('edit');
  rt.setRuntimeMode('running');
  const m = rt.createModel({ id: 300, name: 'm300', type: 'app' });
  rt.addLabel(m, 1, 0, 0, { k: 'cmd', t: 'pin.in', v: null });
  rt.addLabel(m, 1, 0, 0, { k: 'result', t: 'pin.out', v: null });

  rt.addLabel(m, 1, 0, 0, {
    k: 'wiring',
    t: 'pin.connect.label',
    v: [
      { from: 'cmd', to: ['echo:in'] },
      { from: 'echo:out', to: ['result'] },
    ],
  });
  rt.addLabel(m, 1, 0, 0, {
    k: 'echo',
    t: 'func.js',
    v: { code: "const rec = Array.isArray(label.v) ? label.v.find((r) => r && r.k === 'message') : null;\nreturn [{ id: 0, p: 0, r: 0, c: 0, k: 'message', t: 'str', v: String(rec && rec.v || '') + '!' }];", modelName: 'm300' },
  });

  rt.addLabel(m, 1, 0, 0, { k: 'cmd', t: 'pin.in', v: mt('message', 'str', 'ok') });
  await sleep(30);

  const result = rt.getCell(m, 1, 0, 0).labels.get('result');
  assert.deepEqual(result?.v, mt('message', 'str', 'ok!'), 'func.js structured value should execute');
  return { key: 'func_js_structured_value_executes', status: 'PASS' };
}

async function test_func_js_string_value_is_ignored() {
  const rt = new ModelTableRuntime();
  rt.setRuntimeMode('edit');
  rt.setRuntimeMode('running');
  const m = rt.createModel({ id: 301, name: 'm301', type: 'app' });
  rt.addLabel(m, 1, 0, 0, { k: 'cmd', t: 'pin.in', v: null });
  rt.addLabel(m, 1, 0, 0, { k: 'result', t: 'pin.out', v: null });

  rt.addLabel(m, 1, 0, 0, {
    k: 'wiring',
    t: 'pin.connect.label',
    v: [
      { from: 'cmd', to: ['legacy:in'] },
      { from: 'legacy:out', to: ['result'] },
    ],
  });
  rt.addLabel(m, 1, 0, 0, { k: 'legacy', t: 'func.js', v: 'return label.v + "_legacy";' });
  rt.addLabel(m, 1, 0, 0, { k: 'cmd', t: 'pin.in', v: mt('message', 'str', 'ok') });
  await sleep(30);

  const result = rt.getCell(m, 1, 0, 0).labels.get('result');
  assert.equal(result?.v, null, 'func.js string value should be ignored after compat cleanup');
  return { key: 'func_js_string_value_is_ignored', status: 'PASS' };
}

async function test_func_python_without_worker_writes_error() {
  const rt = new ModelTableRuntime();
  rt.setRuntimeMode('edit');
  rt.setRuntimeMode('running');
  const m = rt.createModel({ id: 302, name: 'm302', type: 'app' });
  rt.addLabel(m, 1, 0, 0, { k: 'cmd', t: 'pin.in', v: null });

  rt.addLabel(m, 1, 0, 0, {
    k: 'wiring',
    t: 'pin.connect.label',
    v: [{ from: 'cmd', to: ['pyfn:in'] }],
  });
  rt.addLabel(m, 1, 0, 0, {
    k: 'pyfn',
    t: 'func.python',
    v: { code: 'def run(ctx, label):\n  return label["v"]', modelName: 'm302' },
  });

  rt.addLabel(m, 1, 0, 0, { k: 'cmd', t: 'pin.in', v: mt('message', 'str', 'ok') });
  await sleep(30);

  const err = rt.getCell(m, 1, 0, 0).labels.get('__error_pyfn');
  assert(err, 'func.python without worker should write error label');
  return { key: 'func_python_without_worker_writes_error', status: 'PASS' };
}

const tests = [
  test_func_js_structured_value_executes,
  test_func_js_string_value_is_ignored,
  test_func_python_without_worker_writes_error,
];

let passed = 0;
let failed = 0;
for (const t of tests) {
  try {
    const r = await t();
    console.log(`[${r.status}] ${r.key}`);
    passed += 1;
  } catch (err) {
    console.log(`[FAIL] ${t.name}: ${err.message}`);
    failed += 1;
  }
}

console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
process.exit(failed > 0 ? 1 : 0);
