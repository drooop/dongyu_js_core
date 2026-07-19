#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const expectedExactKeys = [
  '__mt_payload_kind',
  '__mt_request_id',
  'op_id',
  'request_id',
  'correlation_id',
  'message_role',
  'bus',
  'bus_out_key',
  'route_kind',
  'topic',
  'response_topic',
  'timestamp',
  'payload',
  'payload_model_id',
  'bundle_record_id_offset',
  'worker_id',
  'model_id',
  'table_id',
  'pin',
  'principal_ref',
  'principal_id',
  'authority',
  'identity',
  'source_model_id',
  'route',
  'reply_to',
  'route.reply_to',
  'response_pin',
  'return_topic',
  'returnTopic',
  'result_topic',
  'envelope_extension_keys',
];
const expectedPrefixes = [
  '__mt_',
  'endpoint_',
  'origin_',
  'reply_target_',
  'principal_',
  'owner_',
  'payload_',
  'response_',
  'return_',
  'route_',
  'source_',
  'model_',
  'sys_',
];

async function loadRules() {
  try {
    return await import('../../packages/worker-base/src/pin_payload_envelope_extensions.mjs');
  } catch (error) {
    assert.fail(`missing shared envelope-extension rule module: ${error && error.message ? error.message : error}`);
  }
}

async function test_shared_rule_surface_is_exact_and_fail_closed() {
  const rules = await loadRules();
  assert.equal(rules.MAX_PIN_PAYLOAD_ENVELOPE_EXTENSION_KEYS, 16);
  assert.equal(rules.MAX_PIN_PAYLOAD_ENVELOPE_EXTENSION_KEY_LENGTH, 64);
  assert.deepEqual([...rules.PIN_PAYLOAD_ENVELOPE_EXTENSION_RESERVED_EXACT_KEYS], expectedExactKeys);
  assert.deepEqual([...rules.PIN_PAYLOAD_ENVELOPE_EXTENSION_RESERVED_PREFIXES], expectedPrefixes);
  assert.equal(String(rules.PIN_PAYLOAD_ENVELOPE_EXTENSION_KEY_PATTERN), '/^[a-z][a-z0-9_]*$/u');
  assert.equal(typeof rules.validatePinPayloadEnvelopeExtensionKeys, 'function');

  assert.deepEqual(
    rules.validatePinPayloadEnvelopeExtensionKeys(['custom_trace', 'is_need_response']),
    { ok: true, keys: ['custom_trace', 'is_need_response'] },
  );
  const exactlyMaxKeys = Array.from(
    { length: rules.MAX_PIN_PAYLOAD_ENVELOPE_EXTENSION_KEYS },
    (_, index) => `custom_${index}`,
  );
  assert.deepEqual(
    rules.validatePinPayloadEnvelopeExtensionKeys(exactlyMaxKeys),
    { ok: true, keys: exactlyMaxKeys },
    'the declared maximum of 16 unique keys must be accepted',
  );
  const exactlyMaxLengthKey = `x${'a'.repeat(rules.MAX_PIN_PAYLOAD_ENVELOPE_EXTENSION_KEY_LENGTH - 1)}`;
  assert.equal(exactlyMaxLengthKey.length, 64);
  assert.deepEqual(
    rules.validatePinPayloadEnvelopeExtensionKeys([exactlyMaxLengthKey]),
    { ok: true, keys: [exactlyMaxLengthKey] },
    'a valid key exactly 64 characters long must be accepted',
  );
  for (const key of expectedExactKeys) {
    assert.equal(rules.validatePinPayloadEnvelopeExtensionKeys([key]).ok, false, `exact reserved key must reject: ${key}`);
  }
  for (const prefix of expectedPrefixes) {
    const key = `${prefix}shadow`.replace(/[^a-z0-9_]/gu, '_');
    assert.equal(rules.validatePinPayloadEnvelopeExtensionKeys([key]).ok, false, `reserved prefix must reject: ${prefix}`);
  }
  for (const invalid of [
    null,
    'custom_trace',
    { key: 'custom_trace' },
    [],
    [null],
    [7],
    [{ key: 'custom_trace' }],
    [''],
    ['Bad-Key'],
    [' custom_trace'],
    ['custom_trace', 'custom_trace'],
  ]) {
    const result = rules.validatePinPayloadEnvelopeExtensionKeys(invalid);
    if (Array.isArray(invalid) && invalid.length === 0) {
      assert.deepEqual(result, { ok: true, keys: [] });
    } else {
      assert.equal(result.ok, false, `invalid declaration must reject: ${JSON.stringify(invalid)}`);
    }
  }
  assert.equal(
    rules.validatePinPayloadEnvelopeExtensionKeys([...exactlyMaxKeys, 'custom_overflow']).ok,
    false,
    '17 declared keys must be rejected',
  );
  const overMaxLengthKey = `${exactlyMaxLengthKey}a`;
  assert.equal(overMaxLengthKey.length, 65);
  assert.equal(
    rules.validatePinPayloadEnvelopeExtensionKeys([overMaxLengthKey]).ok,
    false,
    'a 65-character key must be rejected',
  );

  return { key: 'shared_rule_surface_is_exact_and_fail_closed', status: 'PASS' };
}

function assertNamedValidatorConsumer(source, moduleSpecifier, consumerName) {
  const escapedSpecifier = moduleSpecifier.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  const importPattern = new RegExp(
    `import\\s*\\{([^}]*)\\}\\s*from\\s*['"]${escapedSpecifier}['"]\\s*;?`,
    'u',
  );
  const importMatch = source.match(importPattern);
  assert.ok(importMatch, `${consumerName} must use a named import from the shared rule module`);
  assert.match(
    importMatch[1],
    /\bvalidatePinPayloadEnvelopeExtensionKeys\b/u,
    `${consumerName} must import the named validator`,
  );
  const withoutSharedImport = source.replace(importMatch[0], '');
  const assignmentMatch = withoutSharedImport.match(
    /\b(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*validatePinPayloadEnvelopeExtensionKeys\s*\(/u,
  );
  assert.ok(assignmentMatch, `${consumerName} must assign the shared validator result`);
  const resultName = assignmentMatch[1];
  const escapedResultName = resultName.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  assert.match(
    withoutSharedImport,
    new RegExp(`\\bif\\s*\\(\\s*!\\s*${escapedResultName}\\.ok\\s*\\)`, 'u'),
    `${consumerName} must fail closed from the shared validator .ok result`,
  );
  assert.match(
    withoutSharedImport,
    new RegExp(`\\b${escapedResultName}\\.keys\\b`, 'u'),
    `${consumerName} must consume the shared validator normalized .keys result`,
  );
  assert.doesNotMatch(
    withoutSharedImport,
    /\b(?:const|let|var|function)\s+validatePinPayloadEnvelopeExtensionKeys\b/u,
    `${consumerName} must not shadow the shared validator`,
  );
  assert.doesNotMatch(
    withoutSharedImport,
    /\b(?:const|let|var)\s+(?=[A-Za-z0-9_$]*(?:reserved))(?=[A-Za-z0-9_$]*(?:envelope|extension|pin_payload))[A-Za-z_$][\w$]*\s*=/iu,
    `${consumerName} must not maintain a local reserved envelope-extension set`,
  );
  assert.doesNotMatch(
    withoutSharedImport,
    /\b(?:const|let|var)\s+(?=[A-Za-z0-9_$]*(?:reserved|blocked|forbidden|denied|protected|disallowed))(?=[A-Za-z0-9_$]*(?:key|prefix))[A-Za-z_$][\w$]*\s*=\s*(?:new\s+Set\s*\(|\[)/iu,
    `${consumerName} must not hide a second blocked key/prefix rule set under a generic name`,
  );
  assert.doesNotMatch(
    withoutSharedImport,
    /\/\^\[a-z\]\[a-z0-9_\]\*\$\/u/u,
    `${consumerName} must not duplicate the shared extension-key grammar`,
  );
}

function test_ui_server_and_runtime_call_the_same_named_validator() {
  const server = readFileSync(resolve(repoRoot, 'packages/ui-model-demo-server/server.mjs'), 'utf8');
  const runtime = readFileSync(resolve(repoRoot, 'packages/worker-base/src/runtime.mjs'), 'utf8');
  assertNamedValidatorConsumer(
    server,
    '../worker-base/src/pin_payload_envelope_extensions.mjs',
    'UI Server',
  );
  assertNamedValidatorConsumer(
    runtime,
    './pin_payload_envelope_extensions.mjs',
    'ESM runtime',
  );
  return { key: 'ui_server_and_runtime_call_the_same_named_validator', status: 'PASS' };
}

const tests = [
  test_shared_rule_surface_is_exact_and_fail_closed,
  test_ui_server_and_runtime_call_the_same_named_validator,
];

let failed = 0;
for (const test of tests) {
  try {
    const result = await test();
    process.stdout.write(`[PASS] ${result.key}\n`);
  } catch (error) {
    failed += 1;
    process.stderr.write(`[FAIL] ${test.name}\n${error?.stack || error}\n`);
  }
}
process.stdout.write(`${tests.length - failed} passed, ${failed} failed out of ${tests.length}\n`);
if (failed > 0) process.exit(1);
