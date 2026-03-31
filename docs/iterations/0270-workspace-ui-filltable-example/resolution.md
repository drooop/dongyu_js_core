---
title: "Iteration 0270-workspace-ui-filltable-example Resolution"
doc_type: iteration-resolution
status: active
updated: 2026-03-31
source: ai
iteration_id: 0270-workspace-ui-filltable-example
id: 0270-workspace-ui-filltable-example
phase: phase1
---

# Iteration 0270-workspace-ui-filltable-example Resolution

## 0. Execution Rules
- Work branch: `dev_0270-workspace-ui-filltable-example`
- 先写 failing contracts，再逐步实现预置样例、远端模式、本地模式、文档。
- 最终验收必须含本地 redeploy 与 live 五项链路检查。

## 1. Steps Overview

| Step | Title | Scope (Short) | Files (Key) | Validation (Executable) | Acceptance Criteria | Rollback |
|------|-------|---------------|-------------|--------------------------|--------------------|----------|
| 1 | Freeze example contract | 新案例模型结构与目标标签 | new contract tests | node tests | 结构可裁决 | revert tests/docs |
| 2 | Add preloaded Workspace example | 新侧边栏条目 + app host + child truth | workspace patches | node tests | Open 可见 | revert patches |
| 3 | Implement remote mode | 复用双总线返回颜色字符串 | patches + worker role if needed | node tests | 远端模式绿 | revert patches |
| 4 | Implement local mode switch | 改表切成本地程序模型 | patches | node tests | 本地模式绿 | revert patches |
| 5 | Parameterize layout/style | 改表控制布局与样式 | patches | node tests | 外观变化可见 | revert patches |
| 6 | Write user guide | 删除重建与双模式教程 | docs | doc tests | 文档可复现 | revert docs |
| 7 | Redeploy and live verify | 整链验证 | deploy + browser + logs | full suite | live 通过 | redeploy previous baseline |
