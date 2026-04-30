---
title: "Iteration 0267-home-save-draft-sync Resolution"
doc_type: iteration-resolution
status: completed
updated: 2026-04-21
source: ai
iteration_id: 0267-home-save-draft-sync
id: 0267-home-save-draft-sync
phase: phase4
---

# Iteration 0267-home-save-draft-sync Resolution

## 0. Execution Rules
- Work branch: `dev_0267-home-save-draft-sync`
- 先写 failing contract，再改 Tier2/Server，再 redeploy live 验证。

## 1. Steps Overview

| Step | Title | Scope (Short) | Files (Key) | Validation (Executable) | Acceptance Criteria | Rollback |
|------|-------|---------------|-------------|--------------------------|--------------------|----------|
| 1 | Add contract test | 证明 Save 未携带 draft 且失败不显式提示 | `scripts/tests/test_0266_home_save_label_draft_override_contract.mjs` | node test | RED then GREEN | revert test |
| 2 | Fix save path | Save 带 draft override，server 优先吃 override | `home_catalog_ui.json`, `server.mjs` | node test | 最新值能保存 | revert code |
| 3 | Live verify | redeploy 后在首页真实改 `Gamma→Gamma1/2` | local deploy + browser | baseline + live UI | live 行为正确 | redeploy previous baseline |

## 2. Closeout Note

- 0354 index reconciliation verified `dev_0267-home-save-draft-sync` is an ancestor of `dev`.
- `docs/ITERATIONS.md` was corrected from `In Progress` to `Completed`.
