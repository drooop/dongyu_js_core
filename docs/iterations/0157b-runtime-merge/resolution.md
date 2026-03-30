---
title: "0157b — Resolution (HOW)"
doc_type: iteration-resolution
status: planned
updated: 2026-03-21
source: ai
iteration_id: 0157b-runtime-merge
id: 0157b-runtime-merge
phase: phase1
---

# 0157b — Resolution (HOW)

## 0. Execution Strategy

采用 TDD 最小改动路径：

1. 先加 0157b 专项测试，证明当前 runtime.js 不是 shim（RED）。
2. 再把 runtime.js 收敛为 CJS shim，并补 runtime.mjs 的 Node `createRequire` 兼容（GREEN）。
3. 最后执行 CJS 专项验证 + 显式回归清单。

## 1. Step Overview

| Step | Title | Scope | Files | Verification | Acceptance | Rollback |
|---|---|---|---|---|---|---|
| 1 | RED 测试 | 新增 runtime shim 约束测试并先失败 | `scripts/tests/test_0157b_runtime_cjs_shim.mjs` | `node scripts/tests/test_0157b_runtime_cjs_shim.mjs` | 出现预期失败 | 删除测试文件 |
| 2 | runtime.js shim 化 | runtime.js 改为 CJS re-export | `packages/worker-base/src/runtime.js` | 同 Step1 命令 | 测试转绿 | 回退 runtime.js |
| 3 | Node ESM require 兼容 | runtime.mjs lazyMqtt 增加 createRequire 回退 | `packages/worker-base/src/runtime.mjs` | `node -e "require('./packages/worker-base/src/runtime.js')"` | CJS 加载 PASS | 回退 runtime.mjs |
| 4 | 回归验证 | 执行 CJS 专项 + 显式测试清单 | `scripts/tests/*.mjs`（显式文件） | 显式循环命令 | 全部 PASS | 回退本迭代改动 |

## 2. Verification Commands

1. `node scripts/tests/test_0157b_runtime_cjs_shim.mjs`
2. `node -e "const { ModelTableRuntime } = require('./packages/worker-base/src/runtime.js'); console.log('CJS shim:', typeof ModelTableRuntime === 'function' ? 'PASS' : 'FAIL')"`
3. 
   `for f in scripts/tests/test_0141_integration.mjs scripts/tests/test_0142_integration.mjs scripts/tests/test_0143_e2e.mjs scripts/tests/test_0144_mbr_compat.mjs scripts/tests/test_0144_remote_worker.mjs scripts/tests/test_0146_fill_table_only_mode_guard.mjs scripts/tests/test_0147_fill_table_only_auto_gate.mjs scripts/tests/test_async_function_engine.mjs scripts/tests/test_bus_in_out.mjs scripts/tests/test_cell_connect_parse.mjs scripts/tests/test_cell_connection_route.mjs scripts/tests/test_model_in_out.mjs scripts/tests/test_submodel_connect.mjs scripts/tests/test_submodel_register.mjs; do echo "=== $f ==="; node "$f" || exit 1; done`

## 3. Gate Notes

- fill-table-only 状态：OFF（本迭代属于 Tier 1 代码改动）。
- 分支命名约束：计划分支不含 `-ft-`。
