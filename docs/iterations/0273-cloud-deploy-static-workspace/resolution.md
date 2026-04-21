---
title: "Iteration 0273-cloud-deploy-static-workspace Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0273-cloud-deploy-static-workspace
id: 0273-cloud-deploy-static-workspace
phase: phase1
---

# Iteration 0273-cloud-deploy-static-workspace Resolution

## 0. Execution Rules

- Work branch: `dev_0273-cloud-deploy-static-workspace`
- 遵守 `CLAUDE.md` remote ops safety
- 优先使用最小 blast radius 路径：
  - source sync
  - assets sync
  - ui-server deploy
- 真实公网上传验证必须以 `https://app.dongyudigital.com` 为准

## 1. Steps Overview

| Step | Title | Scope (Short) | Validation | Acceptance | Rollback |
|------|-------|---------------|------------|------------|----------|
| 1 | Freeze connectivity and revision | 锁定目标 revision 与远端可达性 | ssh / git rev | 可进入远端 deploy | stop |
| 2 | Sync source and assets | 远端仓库与 assets 对齐 | sync script / asset sync | 远端资源对齐 | resync previous rev |
| 3 | Publish ui-server | 远端 `ui-server` 跑到当前状态 | rollout / hash | code 与页面对齐 | restore previous image |
| 4 | Public verification | Workspace + Static + upload + `/p/...` | curl + browser + logs | 公网能力成立 | restore previous image/assets |

