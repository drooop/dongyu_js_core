---
title: "0165 — Resolution (HOW)"
doc_type: iteration-resolution
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0165-cloud-deploy-aaf4083
id: 0165-cloud-deploy-aaf4083
phase: phase1
---

# 0165 — Resolution (HOW)

## Execution Strategy

先隔离干净构建源，再做远端 deploy 尝试，最后根据 rollout 与日志判断结果。整个过程不触碰禁止操作，也不从脏工作树直接构建镜像。

## Step 1

- Scope:
  - 创建干净 deploy worktree，只包含 `aaf4083`。
- Files:
  - `/tmp/dongyuapp-deploy-aaf4083`（临时工作树）
- Verification:
  - `git status --short` 为空
  - `git rev-parse --short HEAD` = `aaf4083`
- Acceptance:
  - 构建上下文不含当前仓库未提交改动
- Rollback:
  - 删除临时 worktree

## Step 2

- Scope:
  - 使用现有脚本尝试远端部署。
- Files:
  - `scripts/ops/deploy_cloud_ui_server_from_local.sh`
  - `scripts/ops/deploy_cloud.sh`
- Verification:
  - deploy 脚本 exit code
  - 远端 rollout / 校验输出
- Acceptance:
  - 脚本执行完成，结果明确
- Rollback:
  - 若脚本自带 rollback 无法自动执行，只记录失败并停止

## Step 3

- Scope:
  - 汇总远端 deploy 结果与证据。
- Files:
  - `docs/iterations/0165-cloud-deploy-aaf4083/runlog.md`
- Verification:
  - 记录命令、关键输出、结论
- Acceptance:
  - 人类可据 runlog 判断是否需要继续远端验证
- Rollback:
  - 文档回退即可
