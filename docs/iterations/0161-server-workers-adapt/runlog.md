---
title: "Iteration 0161-server-workers-adapt Runlog"
doc_type: iteration-runlog
status: active
updated: 2026-04-21
source: ai
iteration_id: 0161-server-workers-adapt
id: 0161-server-workers-adapt
phase: phase3
---

# Iteration 0161-server-workers-adapt Runlog

## Environment

- Date: 2026-03-06
- Branch: `dev_0161-server-workers-adapt`
- Runtime: Node.js
- fill-table-only: OFF

## Review Gate Record

### Record 1

- Iteration ID: 0161-server-workers-adapt
- Review Date: 2026-03-06
- Review Type: User
- Review Index: 1
- Decision: Approved
- Notes:
  - 用户要求继续实施（在 0160 完成后继续下一迭代）。

## Compact Checkpoint

### CP-001 (before implementation)

- Completed iterations:
  - 0157a / 0157b / 0158 / 0159 / 0160
- Current target:
  - 0161 server + worker function-label adaptation
- Planned write scope:
  - `packages/ui-model-demo-server/server.mjs`
  - `scripts/worker_engine_v0.mjs`
  - optional: `deploy/sys-v1ns/remote-worker/patches/00_remote_worker_config.json`
- Hard constraints snapshot:
  - 不修改 runtime 兼容层
  - 不执行 0162 的全量测试迁移

## Execution Records

### Step 0 — Plan/Resolution/Runlog filed + compact checkpoint

- Result: PASS

### Step 1 — server.mjs 适配 `func.js` + 结构化值

- Changed:
  - `packages/ui-model-demo-server/server.mjs`
- Implemented:
  - 新增函数标签判定 helper：`func.js/func.python/function`。
  - `firstSystemModel` 不再仅依赖 `label.t === 'function'`。
  - `refreshFunctionRegistry` 只注册可执行 JS 函数（`func.js` + 兼容 `function`）。
  - 函数代码提取改为 `v.code || v`。
- Result: PASS

### Step 2 — worker_engine_v0 适配 `func.js` + 结构化值

- Changed:
  - `scripts/worker_engine_v0.mjs`
- Implemented:
  - `executeFunction` 从 `func.js`/legacy `function` 提取代码（`v.code || v`）。
  - `_processRunTriggers` 函数存在性判定支持 `func.js`。
- Result: PASS

### Step 3 — deploy/fixtures 复核

- Checked:
  - `deploy/sys-v1ns/remote-worker/patches/00_remote_worker_config.json`
  - `scripts/fixtures/**`
- Key output:
  - 未发现旧类型残留；本步无需文件修改。
- Result: PASS

### Step 4 — 回归验证

- Commands:
  - `node scripts/tests/test_0155_prompt_filltable_policy.mjs`
  - `node scripts/tests/test_0158_new_label_types.mjs`
  - `node scripts/tests/test_0158_func_value_compat.mjs`
  - `node scripts/tests/test_0161_worker_engine_funcjs.mjs`
  - `node scripts/validate_model100_records_e2e_v0.mjs`
- Key output:
  - `0155`: `9 passed, 0 failed`
  - `0158_new_label_types`: `3 passed, 0 failed`
  - `0158_func_value_compat`: `3 passed, 0 failed`
  - `0161_worker_engine_funcjs`: `2 passed, 0 failed`
  - `validate_model100_records_e2e_v0`: `PASS`
- Result: PASS

### Note — 非门槛失败复核

- Command:
  - `node scripts/validate_intent_dispatch_pin_v0.mjs`
- Output:
  - `VALIDATION FAILED: missing_intent_dispatch_function`（后续临时兼容后变为 `pin_register should subscribe model topic`）
- Conclusion:
  - 该脚本语义与当前系统模型 `intent_dispatch` 口径不一致，属于 0162 测试迁移范围，不作为 0161 门槛。

## Docs Updated

- [x] `docs/ssot/runtime_semantics_modeltable_driven.md` reviewed（本次为 server/worker 适配，不新增 runtime 语义条款）
- [x] `docs/user-guide/modeltable_user_guide.md` reviewed（无新增用户交互流程）
- [x] `docs/ssot/execution_governance_ultrawork_doit.md` reviewed（治理规则未变）

## Current Conclusion

- 0161 完成：server/worker 对 `func.js` 结构化值适配完成并通过关键回归。
- 下一步进入 0162（测试与 validate 脚本迁移，含 `validate_intent_dispatch_pin_v0` 口径修正）。
