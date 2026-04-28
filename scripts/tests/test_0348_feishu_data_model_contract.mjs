import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const repoRoot = process.cwd();

const checks = [
  {
    file: 'docs/ssot/feishu_data_model_contract_v1.md',
    required: [
      'Feishu Data Model Contract v1',
      'Data.Array.One',
      'Data.Array.Two',
      'Data.Array.Three',
      'Data.CircularBuffer',
      'Data.LinkedList',
      'Data.FlowTicket',
      '`add_data:in`',
      '`update_data:in`',
      'Temporary ModelTable Message',
      'implementation debt',
    ],
  },
  {
    file: 'docs/ssot/runtime_semantics_modeltable_driven.md',
    required: [
      'feishu_data_model_contract_v1.md',
      '`add_data:in`',
      '`update_data:in`',
      '0296-era underscore pins',
    ],
    forbidden: [
      '`add_data_in`（pin.in）：添加数据',
      '`get_data_out`（pin.out）：获取数据响应',
      '`get_size_out`（pin.out）：获取数据量响应',
    ],
  },
  {
    file: 'docs/ssot/label_type_registry.md',
    required: [
      'feishu_data_model_contract_v1.md',
      '`add_data:in`',
      '`update_data:in`',
      '0296-era names',
    ],
    forbidden: [
      '| `add_data_in` | pin.in | 添加数据 |',
      '| `get_data_out` | pin.out | 获取数据（响应） |',
      '| `get_size_out` | pin.out | 获取数据量（响应） |',
    ],
  },
  {
    file: 'docs/ssot/feishu_alignment_decisions_v0.md',
    required: [
      'Data.Array.One',
      'Data.Array.Two',
      'Data.Array.Three',
      '`add_data:in`',
      '`update_data:in`',
      '0296-era',
    ],
    forbidden: [
      '先做 `Data.Array` 模板能力',
    ],
  },
  {
    file: 'docs/ssot/temporary_modeltable_payload_v1.md',
    required: [
      'Temporary ModelTable Message',
      'format is ModelTable-like; persistence is explicit materialization',
      'feishu_data_model_contract_v1.md',
    ],
  },
  {
    file: 'docs/user-guide/data_models_filltable_guide.md',
    required: [
      'feishu_data_model_contract_v1.md',
      'Data.Array.One',
      'Data.Array.Two',
      'Data.Array.Three',
      'Data.CircularBuffer',
      'Data.LinkedList',
      'Data.FlowTicket',
      '`add_data:in`',
      '`update_data:in`',
      'Known implementation debt',
    ],
    forbidden: [
      '### 输入 pin',
      '### `dequeue_data_out` 示例',
      '### `pop_data_out` 示例',
    ],
  },
  {
    file: 'docs/user-guide/modeltable_user_guide.md',
    required: [
      'feishu_data_model_contract_v1.md',
      '0348 Feishu-aligned `Data.*` 目标合同',
      'Data.Array.One/Two/Three',
      '`add_data:in`',
      '当前实现债务',
    ],
    forbidden: [
      '例如 `submit_request`、`add_data_in`、`write_label_req`',
      '说明 `Data.Array / Data.Queue / Data.Stack` 的新合同下使用方式',
    ],
  },
  {
    file: 'docs/user-guide/README.md',
    required: [
      '0348 数据模型入口',
      'Feishu-aligned `Data.*` 目标合同',
      '0296-era 模板仍待迁移',
    ],
    forbidden: [
      '0296 数据模型入口',
      '说明 `Data.Array / Data.Queue / Data.Stack` 在新 pin/payload 合同下的填表结构',
    ],
  },
];

let failed = false;

for (const check of checks) {
  const absolute = path.join(repoRoot, check.file);
  const text = fs.readFileSync(absolute, 'utf8');
  const missing = (check.required ?? []).filter((needle) => !text.includes(needle));
  const presentForbidden = (check.forbidden ?? []).filter((needle) => text.includes(needle));

  if (missing.length > 0 || presentForbidden.length > 0) {
    failed = true;
    console.error(`[FAIL] ${check.file}`);
    for (const needle of missing) {
      console.error(`  missing: ${needle}`);
    }
    for (const needle of presentForbidden) {
      console.error(`  forbidden present: ${needle}`);
    }
  } else {
    console.log(`[PASS] ${check.file}`);
  }
}

if (failed) {
  process.exit(1);
}

console.log('[PASS] 0348 Feishu Data Model contract docs');
