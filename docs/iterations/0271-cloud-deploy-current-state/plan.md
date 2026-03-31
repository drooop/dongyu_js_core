---
title: "Iteration 0271-cloud-deploy-current-state Plan"
doc_type: iteration-plan
status: active
updated: 2026-04-01
source: ai
iteration_id: 0271-cloud-deploy-current-state
id: 0271-cloud-deploy-current-state
phase: phase1
---

# Iteration 0271-cloud-deploy-current-state Plan

## Goal

把当前 `dev` 上已完成并已推送的状态同步部署到远端 cloud `rke2` 环境，使远端运行态与当前仓库主线一致。

## Scope

- 使用 canonical cloud deploy 路径：
  - 本地 `sync_cloud_source.sh`
  - 远端 `deploy_cloud_full.sh --rebuild`
- 验证远端部署后以下事实：
  - rollout 成功
  - source gate 通过
  - 远端入口可访问
  - Workspace 中 `0270 Fill-Table Workspace UI` 条目存在
  - 远端双总线链路至少对 `0270` 或 `Model 100` 有一条可判定证据

## Non-Goals

- 不修改远端集群底层运行时、网络、CNI、防火墙
- 不执行 `CLAUDE.md` 禁止的 host 级危险操作
- 不在本轮扩展新功能；仅部署当前已存在状态

## Acceptance

- 远端 source sync 成功，revision 与本地目标 revision 一致
- `deploy_cloud_full.sh --rebuild` 成功结束
- 远端关键 deployment ready
- 远端页面入口可打开
- 远端至少一个关键链路有 live 证据

