#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const guide = readFileSync('docs/handover/dam-worker-guide.md', 'utf8');

function sectionBetween(text, startHeading, endHeading) {
  const start = text.indexOf(startHeading);
  assert.notEqual(start, -1, `missing start heading: ${startHeading}`);
  const end = text.indexOf(endHeading, start + startHeading.length);
  assert.notEqual(end, -1, `missing end heading: ${endHeading}`);
  return text.slice(start, end);
}

function test_dam_bus_examples_use_temporary_modeltable_payloads() {
  const section = sectionBetween(guide, '### 8.3 总线交互示例', '### 8.4 mxc:// URI 说明');
  assert.match(section, /临时 ModelTable record array/u, 'DAM bus examples must name the current temporary ModelTable payload contract');
  assert.doesNotMatch(section, /"version":\s*"mt\.v0"/u, 'DAM bus examples must not use mt.v0 patch envelopes as pin payloads');
  assert.doesNotMatch(section, /"records":\s*\[/u, 'DAM bus examples must not use records[] envelopes as pin payloads');
  assert.doesNotMatch(section, /"op":\s*"add_label"/u, 'DAM bus examples must not use legacy op records as pin payloads');
  assert.doesNotMatch(section, /"model_id":\s*1010/u, 'DAM bus examples must not carry model_id in temporary payload records');
}

function test_dam_e2e_flow_does_not_describe_bus_payload_as_mt_v0_patch() {
  const section = sectionBetween(guide, '## 6. 完整 E2E 数据流', '## 7. 函数执行模型');
  assert.match(section, /临时 ModelTable record array/u, 'DAM E2E flow must name the current temporary ModelTable payload contract');
  assert.doesNotMatch(section, /MBR 构造 mt\.v0 patch/u, 'DAM E2E flow must not describe formal pin payloads as mt.v0 patches');
  assert.doesNotMatch(section, /op:\s*"add_label"/u, 'DAM E2E flow must not show legacy op records in formal pin payloads');
}

function test_dam_mbr_bridge_section_uses_pin_payload_transport() {
  const section = sectionBetween(guide, '## 10. MBR 桥接逻辑', '## 11. DAM Worker 开发 Checklist');
  assert.match(section, /pin_payload v1/u, 'MBR bridge section must describe current pin_payload v1 transport');
  assert.match(section, /临时 ModelTable record array/u, 'MBR bridge section must describe nested temporary ModelTable payloads');
  assert.doesNotMatch(section, /构造 mt\.v0 patch/u, 'MBR bridge section must not claim Matrix-to-MQTT constructs mt.v0 patches');
  assert.doesNotMatch(section, /验证 mt\.v0 格式/u, 'MBR bridge section must not claim MQTT-to-Matrix validates mt.v0 patches');
  assert.doesNotMatch(section, /snapshot_delta/u, 'MBR bridge section must not claim current return path is snapshot_delta');
}

const tests = [
  test_dam_bus_examples_use_temporary_modeltable_payloads,
  test_dam_e2e_flow_does_not_describe_bus_payload_as_mt_v0_patch,
  test_dam_mbr_bridge_section_uses_pin_payload_transport,
];

let passed = 0;
let failed = 0;
for (const test of tests) {
  try {
    test();
    console.log(`[PASS] ${test.name}`);
    passed += 1;
  } catch (err) {
    console.log(`[FAIL] ${test.name}: ${err.message}`);
    failed += 1;
  }
}

console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
process.exit(failed > 0 ? 1 : 0);
