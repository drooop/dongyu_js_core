---
title: "Iteration 0157b-runtime-merge Runlog"
doc_type: iteration-runlog
status: active
updated: 2026-03-21
source: ai
iteration_id: 0157b-runtime-merge
id: 0157b-runtime-merge
phase: phase3
---

# Iteration 0157b-runtime-merge Runlog

## Environment

- Date: 2026-03-06
- Branch: `dev_0156-ui-renderer-component-registry`（当前工作区）
- Mode: phase3 execution
- fill-table-only: OFF（Tier 1 代码改动）

## Review Gate Record

### Record 1

- Iteration ID: 0157b-runtime-merge
- Review Date: 2026-03-06
- Review Type: User
- Review Index: 1
- Decision: Approved
- Notes:
  - 用户确认按照 v4 总方案开始实施，并明确 0157b 目标是 runtime 合并 + CJS 兼容壳。

## Execution Records

### Step 1 — RED：新增 shim 测试并验证失败

- Command:
  - `node scripts/tests/test_0157b_runtime_cjs_shim.mjs`
- Key output:
  - `[FAIL] test_runtime_js_is_shim_file: runtime.js should not contain runtime implementation class`
  - `[FAIL] test_cjs_shim_exports_same_constructor: runtime.js should re-export the same ModelTableRuntime from runtime.mjs`
  - `0 passed, 2 failed out of 2`
- Result: PASS（按 TDD 预期先失败）
- Commit: N/A

### Step 2 — GREEN：runtime.js 改为 CJS shim

- Changed:
  - `packages/worker-base/src/runtime.js`
- Key points:
  - 删除实现体，保留：`const { ModelTableRuntime } = require('./runtime.mjs'); module.exports = { ModelTableRuntime };`
- Result: PASS
- Commit: N/A

### Step 3 — GREEN：runtime.mjs 增强 Node ESM require 兼容

- Changed:
  - `packages/worker-base/src/runtime.mjs`
- Key points:
  - 新增 `createRequire(import.meta.url)`。
  - `lazyMqtt()` 优先使用可用 `require`，否则回退到 `_esmRequire`。

- Command:
  - `node -e "const { ModelTableRuntime } = require('./packages/worker-base/src/runtime.js'); console.log('CJS shim:', typeof ModelTableRuntime === 'function' ? 'PASS' : 'FAIL')"`
- Key output:
  - `CJS shim: PASS`
- Result: PASS
- Commit: N/A

### Step 4 — 回归验证

- Command:
  - `node scripts/tests/test_0157b_runtime_cjs_shim.mjs`
- Key output:
  - `[PASS] runtime_js_is_shim_file`
  - `[PASS] cjs_shim_exports_same_constructor`
  - `2 passed, 0 failed out of 2`
- Result: PASS

- Command:
  - `for f in scripts/tests/test_0141_integration.mjs scripts/tests/test_0142_integration.mjs scripts/tests/test_0143_e2e.mjs scripts/tests/test_0144_mbr_compat.mjs scripts/tests/test_0144_remote_worker.mjs scripts/tests/test_0146_fill_table_only_mode_guard.mjs scripts/tests/test_0147_fill_table_only_auto_gate.mjs scripts/tests/test_async_function_engine.mjs scripts/tests/test_bus_in_out.mjs scripts/tests/test_cell_connect_parse.mjs scripts/tests/test_cell_connection_route.mjs scripts/tests/test_model_in_out.mjs scripts/tests/test_submodel_connect.mjs scripts/tests/test_submodel_register.mjs; do echo "=== $f ==="; node "$f" || exit 1; done`
- Key output:
  - 全部 PASS（14/14 文件执行完成，未出现 FAIL）。
- Result: PASS

## Current Conclusion

- 0157b 的核心目标（runtime.mjs 主体 + runtime.js CJS shim）已完成并通过回归。
- 下一步进入 0158：新 label.t 兼容层与新语义支持。
