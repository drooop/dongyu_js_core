---
title: "Iteration 0268-home-all-models-filter Resolution"
doc_type: iteration-resolution
status: active
updated: 2026-03-31
source: ai
iteration_id: 0268-home-all-models-filter
id: 0268-home-all-models-filter
phase: phase1
---

# Iteration 0268-home-all-models-filter Resolution

## 0. Execution Rules
- Work branch: `dev_0268-home-all-models-filter`
- 先写 failing contract，再改推导/UI，再做 live 验证。

## 1. Steps Overview

| Step | Title | Scope (Short) | Files (Key) | Validation (Executable) | Acceptance Criteria | Rollback |
|------|-------|---------------|-------------|--------------------------|--------------------|----------|
| 1 | Add all-models contract | 锁定 selector 与 rows 推导语义 | `scripts/tests/test_0268_home_all_models_contract.mjs` | node test | RED then GREEN | revert test |
| 2 | Implement all-models mode | 选择器/表格/文案/按钮边界 | `editor_page_state_derivers.js`, `home_catalog_ui.json`, related server/frontend glue if needed | node test | All models 正常工作 | revert code |
| 3 | Live verify | redeploy 后在首页实际切换 | local deploy + browser | baseline + live UI | live 行为正确 | redeploy previous baseline |
