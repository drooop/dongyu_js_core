---
title: "Iteration 0160-ft-system-models-migration Runlog"
doc_type: iteration-runlog
status: active
updated: 2026-03-21
source: ai
iteration_id: 0160-ft-system-models-migration
id: 0160-ft-system-models-migration
phase: phase3
---

# Iteration 0160-ft-system-models-migration Runlog

## Environment

- Date: 2026-03-06
- Branch: `dev_0160-ft-system-models-migration`
- Runtime: Node.js
- fill-table-only: ON (branch-level auto gate)

## Review Gate Record

### Record 1

- Iteration ID: 0160-ft-system-models-migration
- Review Date: 2026-03-06
- Review Type: User
- Review Index: 1
- Decision: Approved
- Notes:
  - 用户要求按 v4 定稿继续实施。

## Compact Checkpoint

### CP-001 (before implementation)

- Completed iterations:
  - 0157a docs gate
  - 0157b runtime merge
  - 0158 runtime new label types
  - 0159 filltable policy/prompt update
- Current target:
  - 0160 system-models + deploy JSON migration
- Planned write scope:
  - `packages/worker-base/system-models/*.json` (exclude `*.legacy*`)
  - `deploy/sys-v1ns/**/*.json`
  - `docs/iterations/0160.../*`
- Hard constraints snapshot:
  - No runtime/server/worker code changes in this iteration
  - fixtures JSON deferred to 0161

## Execution Records

### Step 0 — Plan/Resolution/Runlog filed + compact checkpoint

- Result: PASS

### Step 1 — 批量迁移 system-models/deploy JSON

- Command:
  - 执行 Node 批处理脚本，针对 `packages/worker-base/system-models/*.json` 与 `deploy/sys-v1ns/**/*.json`（排除 `.legacy`）做类型与值格式转换。
- Key output:
  - `changed_files=12`
  - `type_changes=30`
  - `function_value_changes=26`
  - `cell_connect_value_changes=2`
  - `exclude_label_types_changes=9`
  - 更新文件：
    - `packages/worker-base/system-models/{system_models,intent_handlers_*,cognition_handlers,ui_to_matrix_forwarder,test_model_100_full,test_model_100_ui,server_config}.json`
    - `deploy/sys-v1ns/{mbr/patches/mbr_role_v0,remote-worker/patches/10_model100}.json`
- Result: PASS

### Step 2 — 零残留扫描与 JSON 解析

- Command:
  - `rg -n '"t"\\s*:\\s*"function"|"t"\\s*:\\s*"CELL_CONNECT"|"t"\\s*:\\s*"cell_connection"|"t"\\s*:\\s*"BUS_IN"|"t"\\s*:\\s*"BUS_OUT"|"t"\\s*:\\s*"MODEL_IN"|"t"\\s*:\\s*"MODEL_OUT"|"t"\\s*:\\s*"subModel"' ...`
  - `node` 批量 `JSON.parse` 改动文件
- Key output:
  - 旧类型命中仅 `remote_worker_model.legacy.json`（符合“legacy 不迁移”约束）
  - `json_parse_pass=13`
- Result: PASS

### Step 3 — 门禁与关键回归

- Command:
  - `node scripts/validate_fill_table_only_mode.mjs --mode fill-table-only --paths ...`
  - `node scripts/tests/test_0146_fill_table_only_mode_guard.mjs`
  - `node scripts/tests/test_0147_fill_table_only_auto_gate.mjs`
  - `node scripts/tests/test_0155_prompt_filltable_policy.mjs`
  - `node scripts/tests/test_0158_new_label_types.mjs`
  - `node scripts/tests/test_0158_func_value_compat.mjs`
- Key output:
  - fill-table-only guard: `[PASS] checked_files=13`
  - `0146`: `5 passed, 0 failed`
  - `0147`: `4 passed, 0 failed`
  - `0155`: `9 passed, 0 failed`
  - `0158_new_label_types`: `3 passed, 0 failed`
  - `0158_func_value_compat`: `3 passed, 0 failed`
- Result: PASS

## Docs Updated

- [x] `docs/ssot/runtime_semantics_modeltable_driven.md` reviewed（本次为系统模型数据迁移，runtime 语义条款无新增）
- [x] `docs/user-guide/modeltable_user_guide.md` reviewed（无新增终端用户操作面）
- [x] `docs/ssot/execution_governance_ultrawork_doit.md` reviewed（治理规则未变更）

## Current Conclusion

- 0160 完成：system-models/deploy JSON 已迁移到新类型，legacy 文件保留未动。
- 可进入 0161（server/workers/deploy 余项与 fixtures 迁移）。
