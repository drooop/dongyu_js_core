---
title: "0146 — Resolution (HOW)"
doc_type: iteration-resolution
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0146-fill-table-only-mode
id: 0146-fill-table-only-mode
phase: phase1
---

# 0146 — Resolution (HOW)

## 0. Execution Rules
- Work branch: `dev_0146-fill-table-only-mode`
- Steps execute in order.
- Validation must be executable and deterministic.
- Real outputs and PASS/FAIL only in `runlog.md`.

## 1. Steps Overview

| Step | Title | Scope (Short) | Files (Key) | Validation (Executable) | Acceptance Criteria | Rollback |
|------|-------|---------------|-------------|--------------------------|--------------------|----------|
| 1 | Register iteration + write governance contract | 补齐 0146 台账与 Fill-Table-Only SSOT | `docs/ITERATIONS.md`, `docs/iterations/0146-fill-table-only-mode/*`, `docs/ssot/fill_table_only_mode.md` | `rg -n "0146-fill-table-only-mode|Fill-Table-Only" __DY_PROTECTED_WL_0__ docs/iterations/0146-fill-table-only-mode docs/ssot/fill_table_only_mode.md` | 文档可独立说明激活条件、白名单、失败处置 | Revert docs files |
| 2 | Guard verification tests | 新增门禁测试并验证 SKIP/PASS/FAIL | `scripts/tests/test_0146_fill_table_only_mode_guard.mjs`, `scripts/validate_fill_table_only_mode.mjs` | `node scripts/tests/test_0146_fill_table_only_mode_guard.mjs` | 测试覆盖三态并全 PASS | Revert test file |
| 3 | Produce runnable evidence + close iteration | 运行门禁命令形成真实证据，更新状态 | `docs/iterations/0146-fill-table-only-mode/runlog.md`, `docs/ITERATIONS.md` | `node scripts/validate_fill_table_only_mode.mjs --mode fill-table-only --paths "__DY_PROTECTED_WL_1__,scripts/tests/test_0146_fill_table_only_mode_guard.mjs"` + fail case | runlog 记录命令和关键输出；ITERATIONS 状态为 Completed | Revert runlog/index |

## 2. Step Details

### Step 1 — Register iteration + write governance contract
**Goal**
- 在执行阶段前完成迭代登记，并沉淀 Fill-Table-Only 的执行契约。

**Scope**
- 注册 `0146-fill-table-only-mode` 到 `docs/ITERATIONS.md`。
- 完成 `plan.md`/`resolution.md`。
- 新增 `docs/ssot/fill_table_only_mode.md`，定义模式激活、允许/禁止范围、失败后的 required action。

**Files**
- Create/Update:
  - `docs/ITERATIONS.md`
  - `docs/iterations/0146-fill-table-only-mode/plan.md`
  - `docs/iterations/0146-fill-table-only-mode/resolution.md`
  - `docs/ssot/fill_table_only_mode.md`
- Must NOT touch:
  - `packages/worker-base/src/runtime.js`
  - `packages/worker-base/src/runtime.mjs`

**Validation (Executable)**
- Commands:
  - `rg -n "0146-fill-table-only-mode|Fill-Table-Only|required_action" __DY_PROTECTED_WL_2__ docs/iterations/0146-fill-table-only-mode docs/ssot/fill_table_only_mode.md`
- Expected signals:
  - 可检索到迭代注册记录。
  - SSOT 包含显式激活和失败处置字段。

**Acceptance Criteria**
- 文档约束自洽，并符合 `CLAUDE.md` fill-table-first 策略。

**Rollback Strategy**
- 回退上述文档文件。

---

### Step 2 — Guard verification tests
**Goal**
- 用自动化测试证明门禁行为稳定。

**Scope**
- 新增 `scripts/tests/test_0146_fill_table_only_mode_guard.mjs`。
- 覆盖以下行为：
  - 模式未开启：`[SKIP]`。
  - 模式开启且全为白名单路径：`[PASS]`。
  - 模式开启且存在非白名单路径：`[FAIL]` + `required_action=write_runtime_capability_gap_report`。

**Files**
- Create/Update:
  - `scripts/tests/test_0146_fill_table_only_mode_guard.mjs`
- Must NOT touch:
  - Runtime core files

**Validation (Executable)**
- Commands:
  - `node scripts/tests/test_0146_fill_table_only_mode_guard.mjs`
- Expected signals:
  - 全部测试 PASS。

**Acceptance Criteria**
- 失败分支断言包含 required action，防止 silent fail。

**Rollback Strategy**
- 回退新增测试文件。

---

### Step 3 — Produce runnable evidence + close iteration
**Goal**
- 形成本地可复现实操证据，并完成迭代收尾。

**Scope**
- 运行 guard 的 PASS/FAIL 实例命令。
- 将真实命令与关键输出记录到 runlog。
- 将 `docs/ITERATIONS.md` 状态更新为 Completed。

**Files**
- Create/Update:
  - `docs/iterations/0146-fill-table-only-mode/runlog.md`
  - `docs/ITERATIONS.md`

**Validation (Executable)**
- Commands:
  - `node scripts/validate_fill_table_only_mode.mjs --mode fill-table-only --paths "__DY_PROTECTED_WL_3__,scripts/tests/test_0146_fill_table_only_mode_guard.mjs"`
  - `node scripts/validate_fill_table_only_mode.mjs --mode fill-table-only --paths "packages/worker-base/src/runtime.js"`
- Expected signals:
  - 前者 PASS。
  - 后者 FAIL 且输出 required action。

**Acceptance Criteria**
- runlog 事实完整，状态收口到 Completed。

**Rollback Strategy**
- 回退 runlog 与 index 状态更新。
