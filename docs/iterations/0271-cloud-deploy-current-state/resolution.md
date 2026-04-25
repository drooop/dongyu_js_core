---
title: "Iteration 0271-cloud-deploy-current-state Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0271-cloud-deploy-current-state
id: 0271-cloud-deploy-current-state
phase: phase1
---

# Iteration 0271-cloud-deploy-current-state Resolution

## 0. Execution Rules

- Work branch: `dev_0271-cloud-deploy-current-state`
- 仅使用 cloud deploy canonical 路径
- 严格遵守 `CLAUDE.md` 中的 remote ops safety 禁令
- 真实命令、关键输出、远端 URL 与 PASS/FAIL 必须写入 `runlog.md`

## 1. Steps Overview

| Step | Title | Scope (Short) | Validation | Acceptance | Rollback |
|------|-------|---------------|------------|------------|----------|
| 1 | Freeze target revision and connectivity | 确认本地 revision、SSH、远端 repo 与 sudo 可用 | `git rev-parse`, `ssh`, remote probe | 远端可操作 | stop, no remote mutation |
| 2 | Sync source to cloud | 同步当前 revision 到 `/home/wwpic/dongyuapp` | `sync_cloud_source.sh` | 远端 revision 对齐 | re-run sync with previous revision |
| 3 | Run full cloud rebuild deploy | 远端 remote build + rollout | `deploy_cloud_full.sh --rebuild` | deploy complete | redeploy previous good revision |
| 4 | Verify remote runtime | 校验 rollout、入口页面、Workspace 条目、关键链路 | remote kubectl/logs/browser checks | 远端 effective | revert to previous revision |

