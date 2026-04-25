---
title: "Iteration 0158-runtime-new-label-types Runlog"
doc_type: iteration-runlog
status: active
updated: 2026-04-21
source: ai
iteration_id: 0158-runtime-new-label-types
id: 0158-runtime-new-label-types
phase: phase3
---

# Iteration 0158-runtime-new-label-types Runlog

## Environment

- Date: 2026-03-06
- Branch: `dev_0156-ui-renderer-component-registry`（当前工作区）
- Mode: phase3 execution
- fill-table-only: OFF

## Review Gate Record

### Record 1

- Iteration ID: 0158-runtime-new-label-types
- Review Date: 2026-03-06
- Review Type: User
- Review Index: 1
- Decision: Approved
- Notes:
  - 用户要求先落盘后执行，并要求 compact 一次后继续。

## Compact Checkpoint

### CP-001 (before implementation)

- Completed iterations:
  - 0157a docs gate completed
  - 0157b runtime merge completed
- Current target:
  - 0158 runtime new label types + compatibility
- Planned code scope:
  - `packages/worker-base/src/runtime.mjs`
  - `scripts/tests/test_0158_new_label_types.mjs`
  - `scripts/tests/test_0158_func_value_compat.mjs`
- Hard constraints snapshot:
  - pin.model.* excludes model_id=0
  - old label types remain DEPRECATED compatibility only
  - explicit-file test loop for verification

## Execution Records

### Step 0 — Plan filed + compact checkpoint written

- Result: PASS

### Step 1 — RED: 新增 0158 测试并验证失败

- Commands:
  - `node scripts/tests/test_0158_new_label_types.mjs`
  - `node scripts/tests/test_0158_func_value_compat.mjs`
- Key output:
  - `test_0158_new_label_types`: `0 passed, 3 failed`
  - `test_0158_func_value_compat`: `1 passed, 2 failed`
- Result: PASS（符合 TDD 预期）

### Step 2 — GREEN: runtime 新类型与兼容层实现

- Changed:
  - `packages/worker-base/src/runtime.mjs`
- Implemented:
  - `_resolveLabelType` + alias map（旧 label.t → 新 label.t）
  - `_applyLabelTypes` 支持 `func.js`/`func.python`
  - `pin.connect.label` 支持旧 map 与新 `{from,to}` 数组格式
  - 新增 `pin.connect.model` 解析与路由（`modelConnectionRoutes`）
  - `_applyBuiltins` 统一按 resolved type 分发，支持：
    - `pin.in/out`、`pin.model.in/out`、`pin.bus.in/out`
    - `pin.log.*`
    - `pin.connect.label/cell/model`
    - `submt`
  - `pin.model.*` on `model_id=0` 拒绝并记录错误
  - `_executeFuncViaCellConnect`：
    - 匹配 `func.js`/`func.python`（含旧 `function` 兼容）
    - 兼容 `value` 为 string 或 `{code,...}`
    - `func.python` 无 worker 时写 `__error_<func>`

- Result: PASS

### Step 3 — GREEN: 新测试转绿

- Commands:
  - `node scripts/tests/test_0158_new_label_types.mjs`
  - `node scripts/tests/test_0158_func_value_compat.mjs`
- Key output:
  - `test_0158_new_label_types`: `3 passed, 0 failed`
  - `test_0158_func_value_compat`: `3 passed, 0 failed`
- Result: PASS

### Step 4 — 回归验证（显式清单）

- Command:
  - 显式循环执行 17 个测试文件：
    - `test_0141_integration.mjs`
    - `test_0142_integration.mjs`
    - `test_0143_e2e.mjs`
    - `test_0144_mbr_compat.mjs`
    - `test_0144_remote_worker.mjs`
    - `test_0146_fill_table_only_mode_guard.mjs`
    - `test_0147_fill_table_only_auto_gate.mjs`
    - `test_async_function_engine.mjs`
    - `test_bus_in_out.mjs`
    - `test_cell_connect_parse.mjs`
    - `test_cell_connection_route.mjs`
    - `test_model_in_out.mjs`
    - `test_submodel_connect.mjs`
    - `test_submodel_register.mjs`
    - `test_0157b_runtime_cjs_shim.mjs`
    - `test_0158_new_label_types.mjs`
    - `test_0158_func_value_compat.mjs`
- Key output:
  - 全部 PASS，未出现 FAIL。
- Result: PASS

## Current Conclusion

- 0158 目标完成：runtime 新 label.t 兼容层与新语义均已实现并通过回归。
- 可进入 0159（filltable_policy + FT skill）。
