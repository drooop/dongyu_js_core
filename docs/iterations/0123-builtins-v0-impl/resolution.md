# Iteration 0123-builtins-v0-impl Resolution

## 0. Execution Rules
- Work branch: dev_0123-builtins-v0-impl
- Steps must be executed in order.
- No step skipping; no bundling multiple steps into one commit.
- Each step must have executable validation.
- Any real execution evidence must go to runlog.md (NOT here).

## 1. Steps Overview

| Step | Title | Scope (Short) | Files (Key) | Validation (Executable) | Acceptance Criteria | Rollback |
|------|-------|---------------|-------------|--------------------------|--------------------|----------|
| 1    | Implement MVP built-in keys | 按 Ledger 逐 key 实现 | packages/worker-base/src/runtime.js | (per Validation Protocol) | MVP keys PASS | Revert Step 1 changes |
| 2    | Validation PASS (per key) | 逐条对照验证 | runlog.md | (per Validation Protocol) | runlog 逐条 PASS | Re-run validations |

## 2. Step Details

### Step 1 — Implement MVP built-in keys
**Goal**
- 按 Concrete Key Implementation Ledger 实现 MVP keys（仅 key-by-key）。

**Scope**
- 仅 MVP keys；Deferred keys 仅识别/无副作用。
- 不引入新语义，不改 UI/Matrix/E2EE/打包。

**Files**
- Create/Update:
  - `packages/worker-base/src/runtime.js`
  - `packages/worker-base/src/index.js`
  - `scripts/validate_builtins_v0.mjs`
  - `docs/iterations/0123-builtins-v0-impl/validation_output.txt`
- Must NOT touch:
  - 非 MVP keys 语义扩展

**Validation (Executable)**
- Commands:
  - (per `docs/iterations/0123-builtins-v0/validation_protocol.md`)
- Expected signals:
  - EventLog/snapshot/intercepts 与 Ledger 一致

**Acceptance Criteria**
- MVP keys 行为与 Ledger 一致（无新增语义）

**Rollback Strategy**
- 回滚本 Step 修改

---

### Step 2 — Validation PASS (per key)
**Goal**
- 逐条执行 Validation Protocol 并记录 PASS。

**Scope**
- 使用 EventLog + snapshot + intercepts 判定 PASS/FAIL。

**Files**
- Create/Update:
  - `docs/iterations/0123-builtins-v0-impl/runlog.md`
- Must NOT touch:
  - 非 MVP keys 语义扩展

**Validation (Executable)**
- Commands:
  - (per `docs/iterations/0123-builtins-v0/validation_protocol.md`)
- Expected signals:
  - runlog 中逐条 PASS（含命令与输出摘要）

**Acceptance Criteria**
- runlog 逐条 PASS 完整、可审计

**Rollback Strategy**
- 重跑验证并更新 runlog

> 禁止在本文件记录 PASS/FAIL、命令输出、commit hash。
