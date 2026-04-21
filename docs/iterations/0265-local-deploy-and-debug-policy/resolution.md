---
title: "Iteration 0265-local-deploy-and-debug-policy Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0265-local-deploy-and-debug-policy
id: 0265-local-deploy-and-debug-policy
phase: phase1
---

# Iteration 0265-local-deploy-and-debug-policy Resolution

## 0. Execution Rules
- Work branch: `dev_0265-local-deploy-and-debug-policy`
- 先部署，再验证，再改规约文档。

## 1. Steps Overview

| Step | Title | Scope (Short) | Files (Key) | Validation (Executable) | Acceptance Criteria | Rollback |
|------|-------|---------------|-------------|--------------------------|--------------------|----------|
| 1 | Redeploy local stack | 让本地 `30900` 环境追到最新 dev | local k8s runtime | `bash scripts/ops/check_runtime_baseline.sh` + deploy | 本地服务起新版本 | 重新 deploy 旧版本 |
| 2 | Verify debug CRUD live | 验证页面上能看到/操作结构标签 | live UI + `/snapshot` | Playwright + curl | `Model 0` 的 `model.submt` 可见 | 回滚部署 |
| 3 | Persist policy | 在 `CLAUDE.md` 落盘“先部署再测试”规约 | `CLAUDE.md` | grep 规则文本 | 规则可见 | 回退文档 |
