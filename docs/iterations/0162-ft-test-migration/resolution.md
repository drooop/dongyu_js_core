---
title: "0162 — Resolution (HOW)"
doc_type: iteration-resolution
status: planned
updated: 2026-03-21
source: ai
iteration_id: 0162-ft-test-migration
id: 0162-ft-test-migration
phase: phase1
---

# 0162 — Resolution (HOW)

## 0. Strategy

先跑显式测试清单拿失败矩阵，再逐文件做最小迁移，最后全量回归复跑。

## 1. Steps

| Step | Scope | Files | Verify |
|---|---|---|---|
| 1 | 建立失败矩阵 | tests + validate 清单 | 输出失败文件/原因 |
| 2 | 迁移 tests 断言 | `scripts/tests/*.mjs` | tests 清单 PASS |
| 3 | 迁移 validate 读取逻辑 | `scripts/validate_*.mjs` | validate 清单 PASS |
| 4 | 全量复跑与归档 | runlog + ITERATIONS | 全绿并落盘 |

## 2. Verification Commands

1. `for f in scripts/tests/test_0141_integration.mjs scripts/tests/test_0142_integration.mjs scripts/tests/test_0143_e2e.mjs scripts/tests/test_0144_mbr_compat.mjs scripts/tests/test_0144_remote_worker.mjs scripts/tests/test_0146_fill_table_only_mode_guard.mjs scripts/tests/test_0147_fill_table_only_auto_gate.mjs scripts/tests/test_async_function_engine.mjs scripts/tests/test_bus_in_out.mjs scripts/tests/test_cell_connect_parse.mjs scripts/tests/test_cell_connection_route.mjs scripts/tests/test_model_in_out.mjs scripts/tests/test_submodel_connect.mjs scripts/tests/test_submodel_register.mjs scripts/tests/test_0158_new_label_types.mjs scripts/tests/test_0158_func_value_compat.mjs scripts/tests/test_0161_worker_engine_funcjs.mjs; do [ -f "$f" ] || continue; echo "=== $f ==="; node "$f" || exit 1; done`
2. `for f in scripts/validate_builtins_v0.mjs scripts/validate_mbr_patch_v0.mjs scripts/validate_model100_records_e2e_v0.mjs scripts/validate_program_model_loader_v0.mjs scripts/validate_intent_dispatch_pin_v0.mjs scripts/validate_dual_bus_harness_v0.mjs scripts/validate_mailbox_to_matrix_v0.mjs scripts/validate_modeltable_persistence_v0.mjs; do [ -f "$f" ] || continue; echo "=== $f ==="; node "$f" || exit 1; done`

## 3. Gate Notes

- 分支：`dev_0162-ft-test-migration`（`-ft-` 自动门禁）。
- 本迭代不改 runtime/server/worker 实现文件。
- 当前结论：
  - tests/validate 的迁移口径改造已完成并通过（除外部依赖脚本）。
  - 外部依赖脚本需要额外环境前置（Matrix room / bun:sqlite）。
