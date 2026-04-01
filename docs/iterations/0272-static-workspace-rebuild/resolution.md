---
title: "Iteration 0272-static-workspace-rebuild Resolution"
doc_type: iteration-resolution
status: active
updated: 2026-04-01
source: ai
iteration_id: 0272-static-workspace-rebuild
id: 0272-static-workspace-rebuild
phase: phase1
---

# Iteration 0272-static-workspace-rebuild Resolution

## 0. Execution Rules

- Work branch: `dev_0272-static-workspace-rebuild`
- 先写 failing contracts，再实现
- 所有 live 结论必须以 redeploy 后的页面和真实访问结果为准

## 1. Steps Overview

| Step | Title | Scope (Short) | Validation | Acceptance | Rollback |
|------|-------|---------------|------------|------------|----------|
| 1 | Freeze contract | 结构与权属冻结 | node tests | 合同可裁决 | revert docs/tests |
| 2 | Add app host/truth | Workspace 条目与挂载 | node tests | 侧边栏入口成立 | revert patches |
| 3 | Rebuild UI | 上传页 UI 重建 | node tests | 页面结构成立 | revert patches |
| 4 | Migrate action ownership | 上传/列表/删除读 truth | node tests | 权属切换成立 | revert code |
| 5 | Preserve publish path | `/p/<projectName>/...` 访问 | node tests | 访问链路成立 | revert code |
| 6 | Write guide | 用户文档 | doc test | 文档可复现 | revert docs |
| 7 | Redeploy and verify | 本地真实上传验证 | deploy + browser | HTML/zip 都可访问 | redeploy previous |

