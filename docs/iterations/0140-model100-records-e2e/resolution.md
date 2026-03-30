---
title: "Iteration 0140-model100-records-e2e Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-03-21
source: ai
iteration_id: 0140-model100-records-e2e
id: 0140-model100-records-e2e
phase: phase1
---

# Iteration 0140-model100-records-e2e Resolution

## 0. Execution Rules
- Work branch: dev_0140-model100-records-e2e
- Steps must be executed in order.
- No step skipping; no bundling multiple steps into one commit.
- Each step must have executable validation.
- Any real execution evidence must go to [[iterations/0140-model100-records-e2e/runlog]] (NOT here).

## 1. Steps Overview

| Step | Title | Scope (Short) | Files (Key) | Validation (Executable) | Acceptance Criteria | Rollback |
|------|-------|---------------|-------------|--------------------------|--------------------|----------|
| 1    | MBR Model 100 records-only | Model 100 路径不再使用 action/data 外层字段 | `deploy/sys-v1ns/mbr/patches/mbr_role_v0.json`, `scripts/validate_mbr_patch_v0.mjs` | `node scripts/validate_mbr_patch_v0.mjs` | Model 100 publish payload: `records.length>0` 且无外层 action/data 依赖 | Revert files |
| 2    | Worker Model 100 binding + function migration | PIN_IN cell-owned + trigger_funcs；函数改为 ctx.getLabel 读参数 | `packages/worker-base/system-models/test_model_100_full.json` | `node scripts/validate_pin_mqtt_loop.mjs`（回归） | `on_model100_event_in` 不再读取 inLabel.v.action/data | Revert file |
| 3    | Worker-side validation | 覆盖 records-only → trigger_funcs → function 执行链路 | `scripts/*`（新增或扩展） | `node scripts/<new_validation>.mjs` | records-only E2E case PASS | Revert script |
| 4    | Docs + iteration closure | 文档评估与同步；ITERATIONS 状态更新 | `docs/*`, `docs/ITERATIONS.md` | `git diff --stat` + scripts | runlog 有 PASS 证据；ITERATIONS=Completed | Revert docs |

## 2. Step Details

### Step 1 — MBR Model 100 records-only
**Goal**
- MBR 对 Model 100 的 mqtt publish payload 改为纯 records 范式。

**Scope**
- 将 Model 100 路径从 `records:[] + action/data` 改为 `records:[add_label(action/data/...)]`。

**Files**
- Update:
  - `deploy/sys-v1ns/mbr/patches/mbr_role_v0.json`
  - `scripts/validate_mbr_patch_v0.mjs`

**Validation (Executable)**
- Commands:
  - `node scripts/validate_mbr_patch_v0.mjs`

**Acceptance Criteria**
- Model 100 路径发布的 payload 满足：`version/op_id/records`，且 `records.length > 0`。

**Rollback Strategy**
- Revert two files.

---

### Step 2 — Worker Model 100 binding + function migration
**Goal**
- Worker 侧能基于 records-only + trigger_funcs 驱动 `on_model100_event_in`。

**Scope**
- PIN_IN 改为 cell-owned binding + `trigger_funcs`。
- `on_model100_event_in` 改为从 `Cell(100, 1, 0, 0)` 读取 `action/data/timestamp`。

**Files**
- Update:
  - `packages/worker-base/system-models/test_model_100_full.json`

**Validation (Executable)**
- Commands:
  - `node scripts/validate_pin_mqtt_loop.mjs`

**Acceptance Criteria**
- 不再读取 `inLabel.v.action` / `inLabel.v.data`。

**Rollback Strategy**
- Revert file.

---

### Step 3 — Worker-side validation
(同上结构复制)

---

### Step 4 — Docs + iteration closure
(同上结构复制)

> 禁止在本文件记录 PASS/FAIL、命令输出、commit hash。
