---
title: "0241 — local-integration-recovery-for-0240 Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-03-26
source: ai
iteration_id: 0241-local-integration-recovery-for-0240
id: 0241-local-integration-recovery-for-0240
phase: phase1
---

# 0241 — local-integration-recovery-for-0240 Resolution

## Strategy

0241 采用“先固化 0239，再恢复主线，再重建 0240 前置”的顺序：

1. 固化当前 `0239` worktree，使 selector 修复成为可追踪提交
2. 将 `0235` 与 `0238` 的 completed fix merge 回 `dev`
3. 在恢复后的主线基线上承接 `0239`
4. 用 focused guards 证明 `0240` 的前置基线完整

## Steps

| Step | Name | Goal | Inputs | Verification | Rollback |
|---|---|---|---|---|---|
| 1 | Freeze 0239 Selector Fix | 将当前 `0239` 未提交改动固化为可复用 commit，并重新跑 focused guards | current `0239` worktree | `test_0239_home_selector_model0_contract` + `validate_home_selector_server_sse` + home/workspace/editor guards 全绿 | reset to pre-step worktree snapshot |
| 2 | Merge 0235 Into dev | 将 Home surface fix 通过 merge commit 并回 `dev` | branch `dropx/dev_0235-local-home-surface-materialization-fix` | merge commit 存在；`6949703` 成为 `dev` 祖先；home contract 绿 | `git revert -m 1 <merge-commit>` |
| 3 | Merge 0238 Into dev | 将 Matrix Debug materialization fix 通过 merge commit 并回 `dev` | branch `dropx/dev_0238-local-matrix-debug-materialization-regression-fix` | merge commit 存在；`44d4565` 成为 `dev` 祖先；matrix persisted-asset guards 绿 | `git revert -m 1 <merge-commit>` |
| 4 | Re-carrier 0239 On Recovered Base | 在包含 `0235 + 0238` 的基线上承接 `0239` 修复 | Step 1 commit + recovered `dev` | selector focused guards 绿，且 branch ancestry 完整 | drop new carrier branch / reset cherry-pick |
| 5 | Re-establish 0240 Preconditions | 用 focused contracts 证明 `0240` 不再被 branch baseline incomplete 阻塞 | Step 2-4 outputs | combined focused test suite 绿 | rollback Step 4 carrier changes |

## Step Details

### Step 1 — Freeze 0239 Selector Fix

Files:
- Modify: current `0239` worktree tracked files
- Test:
  - `scripts/tests/test_0239_home_selector_model0_contract.mjs`
  - `packages/ui-model-demo-frontend/scripts/validate_home_selector_server_sse.mjs`
  - `scripts/tests/test_0212_home_crud_contract.mjs`
  - `scripts/tests/test_0182_workspace_route_init_contract.mjs`
  - `packages/ui-model-demo-frontend/scripts/validate_editor.mjs`
  - `npm -C packages/ui-model-demo-frontend run build`

Acceptance:
- selector fix commit created on `dropx/dev_0239-local-home-selector-model0-fix`

### Step 2 — Merge 0235 Into dev

Commands:
- checkout `dev`
- merge `dropx/dev_0235-local-home-surface-materialization-fix` with non-ff merge commit

Acceptance:
- `git merge-base --is-ancestor 6949703 dev` succeeds
- home-focused contract green

### Step 3 — Merge 0238 Into dev

Commands:
- on `dev`, merge `dropx/dev_0238-local-matrix-debug-materialization-regression-fix` with non-ff merge commit

Acceptance:
- `git merge-base --is-ancestor 44d4565 dev` succeeds
- matrix-focused contracts green

### Step 4 — Re-carrier 0239 On Recovered Base

Preferred path:
- create fresh carrier branch from recovered `dev`
- cherry-pick or otherwise replay Step 1 selector fix commit

Acceptance:
- carrier branch ancestry includes `0235` + `0238`
- selector focused guards green

### Step 5 — Re-establish 0240 Preconditions

Commands:
- run combined focused guard suite on carrier branch

Acceptance:
- downstream note for `0240` updated to “baseline recovered”

