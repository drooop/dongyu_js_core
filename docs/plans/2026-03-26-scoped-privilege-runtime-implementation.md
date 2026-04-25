---
title: "Scoped Privilege Runtime Implementation Plan"
doc_type: note
status: active
updated: 2026-04-21
source: ai
---

# Scoped Privilege Runtime Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在不触碰 mailbox 迁移的前提下，只为 runtime 增加 `same-model scoped privilege` 能力，并用 regression tests 独立证明它与 `PIN-only` 的边界自洽。

**Architecture:** 保持 `PIN-only` 为默认路径，只在 runtime 内增加一层 “privileged capability + scope check”。该能力只对同一 `model_id` 内生效；一旦跨 `model_id` 或跨 `model.submt`，立即回到现有 `PIN-only`。优先通过 RED/GREEN tests 冻结 root auto privilege、non-root explicit privilege、table scope、matrix scope 与 submodel hard boundary。

**Tech Stack:** Node.js、ESM/CJS dual runtime、ModelTableRuntime、script-centric tests (`scripts/tests/test_*.mjs`)。

---

### Task 1: Write the failing privilege contract tests

**Files:**
- Create: `scripts/tests/test_0245_scoped_privilege_runtime_contract.mjs`
- Read: `packages/worker-base/src/runtime.mjs`
- Read: `packages/worker-base/src/runtime.js`

**Step 1: Write the failing test**

Cover at least:
- ordinary cell cannot direct-write sibling cell in same model
- table root auto privilege can direct-write same-model ordinary cell
- explicit privileged non-root cell can direct-write same-model ordinary cell
- matrix privileged root can direct-write matrix-scoped cell
- matrix privileged root cannot direct-write sibling region outside its matrix scope
- table root can direct-write nested matrix cell in same model
- parent cannot direct-write child model via `model.submt`
- cross-model direct-write fails

**Step 2: Run test to verify it fails**

Run:
```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based
node scripts/tests/test_0245_scoped_privilege_runtime_contract.mjs
```

Expected:
- FAIL
- failure must be because runtime lacks scoped privilege logic, not because the test itself is malformed

**Step 3: Commit**

```bash
git add scripts/tests/test_0245_scoped_privilege_runtime_contract.mjs
git commit -m "test(runtime): add scoped privilege contract"
```

### Task 2: Implement runtime privilege recognition and scope checks

**Files:**
- Modify: `packages/worker-base/src/runtime.mjs`
- Read-only: `packages/worker-base/src/runtime.js`

**Step 1: Implement minimal capability recognition**

Add runtime logic for:
- root `(0,0,0)` auto privilege on `model.table` / `model.matrix`
- explicit privileged capability on non-root cells
- same-model scope classification

Do not add mailbox migration logic here.

**Step 2: Implement minimal direct-access scope checks**

Implement the smallest logic needed so the RED tests from Task 1 go green:
- same-model allowed when privileged + in-scope
- cross-model forbidden
- cross-submt forbidden
- matrix scope narrower than table scope

**Step 3: Run tests**

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based
node scripts/tests/test_0245_scoped_privilege_runtime_contract.mjs
node scripts/tests/test_cell_connect_parse.mjs
node scripts/tests/test_submodel_connect.mjs
node scripts/tests/test_model_in_out.mjs
```

Expected:
- scoped privilege contract: PASS
- existing pin/submodel/model-io regressions: PASS

**Step 4: Commit**

```bash
git add packages/worker-base/src/runtime.mjs scripts/tests/test_0245_scoped_privilege_runtime_contract.mjs
git commit -m "feat(runtime): add scoped privilege checks"
```

### Task 3: Non-regression and docs assessment

**Files:**
- Modify if needed: `docs/iterations/0245-scoped-privilege-runtime-and-regression/runlog.md`
- Modify if needed: `docs/ITERATIONS.md`
- Read-only assessment targets:
  - `docs/ssot/runtime_semantics_modeltable_driven.md`
  - `docs/ssot/label_type_registry.md`
  - `docs/ssot/model_layering_and_cell_model_labels_v0_1.md`
  - `docs/user-guide/modeltable_user_guide.md`

**Step 1: Run the focused regression suite**

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based
node scripts/tests/test_0245_scoped_privilege_runtime_contract.mjs
node scripts/tests/test_cell_connect_parse.mjs
node scripts/tests/test_submodel_connect.mjs
node scripts/tests/test_model_in_out.mjs
```

**Step 2: Record docs assessment**

Document:
- which SSOT files must change in the follow-up contract update
- which terms remain intentionally undecided (for example final label name)

**Step 3: Commit**

```bash
git add docs/iterations/0245-scoped-privilege-runtime-and-regression/runlog.md
git commit -m "docs(runtime): record scoped privilege regression evidence"
```

## Execution Handoff

Plan complete and saved to `docs/plans/2026-03-26-scoped-privilege-runtime-implementation.md`. Two execution options:

**1. Subagent-Driven (this session)** - 按 0245 直接开始做 RED/GREEN 实现  
**2. Parallel Session (separate)** - 新会话按 `0245` 独立执行
