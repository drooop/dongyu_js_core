---
title: "Iteration 0263-mounting-remediation Resolution"
doc_type: iteration-resolution
status: active
updated: 2026-03-30
source: ai
iteration_id: 0263-mounting-remediation
id: 0263-mounting-remediation
phase: phase1
---

# Iteration 0263-mounting-remediation Resolution

## 0. Execution Rules
- Work branch: `dev_0263-mounting-remediation`
- 先 RED tests，再改 hierarchy / projection / analyzer。
- 任何 profile 审计未归零前，不得宣称完成。

## 1. Steps Overview

| Step | Title | Scope (Short) | Files (Key) | Validation (Executable) | Acceptance Criteria | Rollback |
|------|-------|---------------|-------------|--------------------------|--------------------|----------|
| 1 | Add profile RED tests | 锁目标态：各 worker profile 挂载归零 | `scripts/tests/test_0263_model_mounting_profiles.mjs` | `node scripts/tests/test_0263_model_mounting_profiles.mjs` | 先出现 RED | 删除测试 |
| 2 | Remediate hierarchy declarations | 补 `Model 0` 正式父链并移除 `-25` 误用父挂载 | `server runtime mounts`, `workspace_catalog_ui.json`, deploy patches | RED tests + existing route tests | 各 profile hierarchy 合规 | 回退 hierarchy patches |
| 3 | Update Workspace mount resolution | 让 Workspace 基于全局 hierarchy 而不是 `-25` 局部 submt 判断 mounted | `editor_page_state_derivers.js` and related tests | workspace route tests | Workspace 不回归 | 回退 projection changes |
| 4 | Rework analyzer/viz to profile audits | 审计按 ui-server/remote/ui-side/mbr profile 输出 | analyzer + viz + 0262 test updates | analyzer tests + CLI | profile audit 为 0/0 | 回退 analyzer/viz |
| 5 | Run focused regression | 回归 hierarchy / workspace / analyzer | relevant tests + analyzer CLI | all PASS | 可复现 green state | 逐项回退 |

## 2. Step Details

### Step 1 — Add profile RED tests
**Goal**
- 把目标态写成自动化 contract。

**Validation (Executable)**
- `node scripts/tests/test_0263_model_mounting_profiles.mjs`

### Step 2 — Remediate hierarchy declarations
**Goal**
- 统一 `Model 0` 为正式父链，消除 `-25` 误用。

### Step 3 — Update Workspace mount resolution
**Goal**
- 保持 Workspace 在新 hierarchy 下仍能解析 app。

### Step 4 — Rework analyzer/viz to profile audits
**Goal**
- 用 per-profile audit 取代跨 runtime 混算。

### Step 5 — Run focused regression
**Goal**
- 验证 hierarchy、Workspace、analyzer 同时为绿。
