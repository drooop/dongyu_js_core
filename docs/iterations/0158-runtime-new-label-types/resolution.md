---
title: "0158 — Resolution (HOW)"
doc_type: iteration-resolution
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0158-runtime-new-label-types
id: 0158-runtime-new-label-types
phase: phase1
---

# 0158 — Resolution (HOW)

## 0. Strategy

TDD 执行：先写失败测试（RED），再最小实现（GREEN），最后显式清单回归。

## 1. Steps

| Step | Scope | Files | Verify |
|---|---|---|---|
| 1 | 新增 0158 测试（RED） | `scripts/tests/test_0158_new_label_types.mjs`, `scripts/tests/test_0158_func_value_compat.mjs` | 两个新测试先失败 |
| 2 | runtime alias + 新分发 | `packages/worker-base/src/runtime.mjs` | 新测试转绿 |
| 3 | pin.connect.model + pin.log.* + func.python 占位 | `packages/worker-base/src/runtime.mjs` | 新增行为用例 PASS |
| 4 | 兼容值格式 | `packages/worker-base/src/runtime.mjs` | 旧/新 value 格式都 PASS |
| 5 | 回归验证 | 显式测试清单 | 0141~0147 + async/bus/connect/model/submodel + 0157b + 0158 全 PASS |

## 2. Verification Commands

1. `node scripts/tests/test_0158_new_label_types.mjs`
2. `node scripts/tests/test_0158_func_value_compat.mjs`
3. `for f in scripts/tests/test_0141_integration.mjs scripts/tests/test_0142_integration.mjs scripts/tests/test_0143_e2e.mjs scripts/tests/test_0144_mbr_compat.mjs scripts/tests/test_0144_remote_worker.mjs scripts/tests/test_0146_fill_table_only_mode_guard.mjs scripts/tests/test_0147_fill_table_only_auto_gate.mjs scripts/tests/test_async_function_engine.mjs scripts/tests/test_bus_in_out.mjs scripts/tests/test_cell_connect_parse.mjs scripts/tests/test_cell_connection_route.mjs scripts/tests/test_model_in_out.mjs scripts/tests/test_submodel_connect.mjs scripts/tests/test_submodel_register.mjs scripts/tests/test_0157b_runtime_cjs_shim.mjs scripts/tests/test_0158_new_label_types.mjs scripts/tests/test_0158_func_value_compat.mjs; do [ -f "$f" ] || continue; echo "=== $f ==="; node "$f" || exit 1; done`

## 3. Gate Notes

- fill-table-only: OFF（Tier 1 runtime 改动）。
- 分支命名：禁含 `-ft-`。
