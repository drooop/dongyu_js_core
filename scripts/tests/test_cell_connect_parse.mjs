import { createRequire } from 'node:module';
import assert from 'node:assert';

const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../../packages/worker-base/src/runtime.js');

function test_parse_endpoint_self() {
  const rt = new ModelTableRuntime();
  const r = rt._parseCellConnectEndpoint('(self, topic_cellA)');
  assert(r !== null, 'should parse self prefix');
  assert.strictEqual(r.prefix, 'self');
  assert.strictEqual(r.port, 'topic_cellA');
  return { key: 'parse_endpoint_self', status: 'PASS' };
}

function test_parse_endpoint_func() {
  const rt = new ModelTableRuntime();
  const r = rt._parseCellConnectEndpoint('(func, process_A1:in)');
  assert(r !== null, 'should parse func prefix');
  assert.strictEqual(r.prefix, 'func');
  assert.strictEqual(r.port, 'process_A1:in');
  return { key: 'parse_endpoint_func', status: 'PASS' };
}

function test_parse_endpoint_numeric() {
  const rt = new ModelTableRuntime();
  const r = rt._parseCellConnectEndpoint('(10, from_parent)');
  assert(r !== null, 'should parse numeric prefix');
  assert.strictEqual(r.prefix, '10');
  assert.strictEqual(r.port, 'from_parent');
  return { key: 'parse_endpoint_numeric', status: 'PASS' };
}

function test_parse_endpoint_no_space() {
  const rt = new ModelTableRuntime();
  const r = rt._parseCellConnectEndpoint('(self,cmd)');
  assert(r !== null, 'should parse without space after comma');
  assert.strictEqual(r.prefix, 'self');
  assert.strictEqual(r.port, 'cmd');
  return { key: 'parse_endpoint_no_space', status: 'PASS' };
}

function test_parse_endpoint_invalid() {
  const rt = new ModelTableRuntime();
  assert.strictEqual(rt._parseCellConnectEndpoint('invalid'), null, 'no parentheses');
  assert.strictEqual(rt._parseCellConnectEndpoint('(only_one)'), null, 'no comma');
  assert.strictEqual(rt._parseCellConnectEndpoint('(a, b, c)'), null, 'too many parts');
  assert.strictEqual(rt._parseCellConnectEndpoint('(, port)'), null, 'empty prefix');
  assert.strictEqual(rt._parseCellConnectEndpoint('(self, )'), null, 'empty port');
  assert.strictEqual(rt._parseCellConnectEndpoint('(abc, port)'), null, 'invalid prefix');
  return { key: 'parse_endpoint_invalid', status: 'PASS' };
}

function test_cell_connect_label_parse() {
  const rt = new ModelTableRuntime();
  const model = rt.createModel({ id: 999, name: 'test', type: 'test' });
  rt.addLabel(model, 1, 0, 0, {
    k: 'wiring',
    t: 'CELL_CONNECT',
    v: {
      '(self, cmd)': ['(func, process:in)'],
      '(func, process:out)': ['(self, result)'],
    },
  });
  const cellKey = '999|1|0|0';
  assert(rt.cellConnectGraph.has(cellKey), 'cellConnectGraph should have key');
  const graph = rt.cellConnectGraph.get(cellKey);
  assert(graph.has('self:cmd'), 'should have self:cmd endpoint');
  const targets = graph.get('self:cmd');
  assert.strictEqual(targets.length, 1);
  assert.strictEqual(targets[0].prefix, 'func');
  assert.strictEqual(targets[0].port, 'process:in');
  const outTargets = graph.get('func:process:out');
  assert(outTargets, 'should have func:process:out');
  assert.strictEqual(outTargets[0].prefix, 'self');
  assert.strictEqual(outTargets[0].port, 'result');
  return { key: 'cell_connect_label_parse', status: 'PASS' };
}

function test_cell_connect_bad_value() {
  const rt = new ModelTableRuntime();
  const model = rt.createModel({ id: 998, name: 'test', type: 'test' });
  rt.addLabel(model, 0, 0, 0, { k: 'wiring', t: 'CELL_CONNECT', v: 'not_an_object' });
  const errors = rt.eventLog._events.filter((e) => e.reason === 'cell_connect_invalid_value');
  assert(errors.length >= 1, 'should record error for invalid value');
  return { key: 'cell_connect_bad_value', status: 'PASS' };
}

function test_cell_connection_parse() {
  const rt = new ModelTableRuntime();
  const model = rt.createModel({ id: 999, name: 'test', type: 'test' });
  rt.addLabel(model, 0, 0, 0, {
    k: 'routing',
    t: 'cell_connection',
    v: [
      { from: [0, 0, 0, 'input'], to: [[1, 0, 0, 'cmd']] },
      { from: [1, 0, 0, 'result'], to: [[0, 0, 0, 'output']] },
    ],
  });
  const key1 = '999|0|0|0|input';
  assert(rt.cellConnectionRoutes.has(key1), 'should have route for input');
  const targets1 = rt.cellConnectionRoutes.get(key1);
  assert.strictEqual(targets1.length, 1);
  assert.strictEqual(targets1[0].model_id, 999);
  assert.strictEqual(targets1[0].p, 1);
  assert.strictEqual(targets1[0].k, 'cmd');
  const key2 = '999|1|0|0|result';
  assert(rt.cellConnectionRoutes.has(key2), 'should have route for result');
  return { key: 'cell_connection_parse', status: 'PASS' };
}

function test_cell_connection_wrong_position() {
  const rt = new ModelTableRuntime();
  const model = rt.createModel({ id: 997, name: 'test', type: 'test' });
  rt.addLabel(model, 1, 0, 0, { k: 'routing', t: 'cell_connection', v: [] });
  const errors = rt.eventLog._events.filter((e) => e.reason === 'cell_connection_wrong_position');
  assert(errors.length >= 1, 'should record error for wrong position');
  return { key: 'cell_connection_wrong_position', status: 'PASS' };
}

function test_multi_target_fanout() {
  const rt = new ModelTableRuntime();
  const model = rt.createModel({ id: 996, name: 'test', type: 'test' });
  rt.addLabel(model, 1, 0, 0, {
    k: 'wiring',
    t: 'CELL_CONNECT',
    v: {
      '(self, cmd)': ['(func, a:in)', '(func, b:in)'],
    },
  });
  const graph = rt.cellConnectGraph.get('996|1|0|0');
  const targets = graph.get('self:cmd');
  assert.strictEqual(targets.length, 2, 'should have 2 targets');
  return { key: 'multi_target_fanout', status: 'PASS' };
}

// --- Run all tests ---
const tests = [
  test_parse_endpoint_self,
  test_parse_endpoint_func,
  test_parse_endpoint_numeric,
  test_parse_endpoint_no_space,
  test_parse_endpoint_invalid,
  test_cell_connect_label_parse,
  test_cell_connect_bad_value,
  test_cell_connection_parse,
  test_cell_connection_wrong_position,
  test_multi_target_fanout,
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
