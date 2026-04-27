import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const repoRoot = process.cwd();

const checks = [
  {
    file: 'docs/ssot/temporary_modeltable_payload_v1.md',
    required: [
      'Temporary ModelTable Message',
      'format is ModelTable-like; persistence is explicit materialization',
      'message-local',
      '不是正式 `model_id`',
      '不是业务 ModelTable truth',
    ],
  },
  {
    file: 'docs/ssot/program_model_pin_and_payload_contract_vnext.md',
    required: [
      'Temporary ModelTable Message',
      'format is ModelTable-like; persistence is explicit materialization',
      '不是正式 `model_id`',
      'owner / D0 / importer materialization',
    ],
  },
  {
    file: 'docs/ssot/label_type_registry.md',
    required: [
      'Temporary ModelTable Message',
      'format is ModelTable-like; persistence is explicit materialization',
      '不是正式 `model_id`',
      '不自动创建或更新',
    ],
  },
  {
    file: 'docs/ssot/runtime_semantics_modeltable_driven.md',
    required: [
      'Temporary ModelTable Message',
      'format is ModelTable-like; persistence is explicit materialization',
      '不是正式 `model_id`',
      '不自动 materialize',
    ],
  },
  {
    file: 'docs/user-guide/data_models_filltable_guide.md',
    required: [
      'Temporary ModelTable Message',
      'format is ModelTable-like; persistence is explicit materialization',
      '不是正式 `model_id`',
      '正式 materialization',
    ],
  },
  {
    file: 'docs/user-guide/modeltable_user_guide.md',
    required: [
      'format is ModelTable-like; persistence is explicit materialization',
      '临时消息',
      '不会自动变成正式业务数据',
    ],
  },
];

let failed = false;

for (const check of checks) {
  const absolute = path.join(repoRoot, check.file);
  const text = fs.readFileSync(absolute, 'utf8');
  const missing = check.required.filter((needle) => !text.includes(needle));
  if (missing.length > 0) {
    failed = true;
    console.error(`[FAIL] ${check.file}`);
    for (const needle of missing) {
      console.error(`  missing: ${needle}`);
    }
  } else {
    console.log(`[PASS] ${check.file}`);
  }
}

if (failed) {
  process.exit(1);
}

console.log('[PASS] 0347 Temporary ModelTable Message contract docs');
