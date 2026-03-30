---
title: "Iteration 0162-ft-test-migration Runlog"
doc_type: iteration-runlog
status: active
updated: 2026-03-21
source: ai
iteration_id: 0162-ft-test-migration
id: 0162-ft-test-migration
phase: phase3
---

# Iteration 0162-ft-test-migration Runlog

## Environment

- Date: 2026-03-06
- Branch: `dev_0162-ft-test-migration`
- Runtime: Node.js
- fill-table-only: ON (branch-level auto gate)

## Review Gate Record

### Record 1

- Iteration ID: 0162-ft-test-migration
- Review Date: 2026-03-06
- Review Type: User
- Review Index: 1
- Decision: Approved
- Notes:
  - 用户要求继续推进下一迭代。

## Compact Checkpoint

### CP-001 (before implementation)

- Completed iterations:
  - 0157a / 0157b / 0158 / 0159 / 0160 / 0161
- Current target:
  - 0162 tests + validate migration
- Planned write scope:
  - `scripts/tests/*.mjs`
  - `scripts/validate_*.mjs`
  - `docs/iterations/0162.../*`
- Hard constraints snapshot:
  - 不改 runtime/server/worker 实现文件
  - 以显式清单回归结果作为完成门槛

## Execution Records

### Step 0 — Plan/Resolution/Runlog filed + compact checkpoint

- Result: PASS

### Step 1 — 基线回归与失败矩阵

- Command:
  - tests + validate 显式清单（node 循环）执行一次
- Result:
  - 迁移相关失败：
    - `scripts/tests/test_0144_mbr_compat.mjs`
    - `scripts/validate_mbr_patch_v0.mjs`
    - `scripts/validate_intent_dispatch_pin_v0.mjs`
  - 环境前置失败：
    - `scripts/validate_program_model_loader_v0.mjs` (`bun:sqlite is required`)
    - `scripts/validate_dual_bus_harness_v0.mjs` (`missing_room_identifier`)
    - `scripts/validate_mailbox_to_matrix_v0.mjs` (`missing_room_identifier`)
    - `scripts/validate_modeltable_persistence_v0.mjs` (`bun:sqlite is required`)

### Step 2 — tests/validate 迁移修复

- Updated files:
  - `scripts/tests/test_0144_mbr_compat.mjs`
  - `scripts/tests/test_0142_integration.mjs`
  - `scripts/tests/test_submodel_connect.mjs`
  - `scripts/tests/test_bus_in_out.mjs`
  - `scripts/tests/test_model_in_out.mjs`
  - `scripts/tests/test_cell_connect_parse.mjs`
  - `scripts/tests/test_cell_connection_route.mjs`
  - `scripts/tests/test_submodel_register.mjs`
  - `scripts/tests/test_async_function_engine.mjs`
  - `scripts/tests/test_0141_integration.mjs`
  - `scripts/validate_mbr_patch_v0.mjs`
  - `scripts/validate_intent_dispatch_pin_v0.mjs`
  - `scripts/validate_builtins_v0.mjs`
  - `scripts/validate_program_model_loader_v0.mjs`
- Key changes:
  - 旧结构性 label 迁移到新 label（`pin.connect.* / pin.bus.* / pin.model.* / submt / func.js`）。
  - 函数 value 读取统一为 `v.code || v`（含兼容）。
  - `intent_dispatch` 校验与当前 `intent_result.result === 'ok'` 语义对齐。
  - 兼容期断言改为兼容新旧输出（`pin.model.in` / `MODEL_IN`）。

### Step 3 — 全量复跑（最终）

- Command:
  - `/tmp/iter0162_final_20260306_021424.log` 对应的 tests+validate 显式清单执行
- Result:
  - tests 清单：PASS
  - validate 清单：迁移相关脚本 PASS
  - 剩余 4 个外部依赖脚本 FAIL（环境前置未满足）：
    - `scripts/validate_program_model_loader_v0.mjs`（需 `bun:sqlite`）
    - `scripts/validate_dual_bus_harness_v0.mjs`（需 `--matrix_room_id/--matrix_room_alias`）
    - `scripts/validate_mailbox_to_matrix_v0.mjs`（需 `--matrix_room_id/--matrix_room_alias`）
    - `scripts/validate_modeltable_persistence_v0.mjs`（需 `bun:sqlite`）

### Step 4 — 结论

- 0162 的“旧 label 引用迁移”已完成并验证通过。
- 全量回归尚受外部环境前置约束，需在具备 Matrix/bun 依赖后补齐最终全绿证据。

## Docs Updated

- [ ] `docs/ssot/runtime_semantics_modeltable_driven.md` reviewed
- [ ] `docs/user-guide/modeltable_user_guide.md` reviewed
- [ ] `docs/ssot/execution_governance_ultrawork_doit.md` reviewed
