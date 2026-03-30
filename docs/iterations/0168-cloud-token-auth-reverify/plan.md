---
title: "Iteration 0168-cloud-token-auth-reverify Plan"
doc_type: iteration-plan
status: planned
updated: 2026-03-21
source: ai
iteration_id: 0168-cloud-token-auth-reverify
id: 0168-cloud-token-auth-reverify
phase: phase1
---

# Iteration 0168-cloud-token-auth-reverify Plan

## Goal

- 复验 `2e00cbe` 的 cloud deploy 路径，确认 `ui-server` 可在不做额外手工 secret 修补的前提下，直接拿到 `MATRIX_MBR_ACCESS_TOKEN` 并连上 Matrix。

## Scope

- In scope:
  - 同步远端 deploy 脚本与 workers manifests。
  - 重跑 cloud deploy，并检查 `ui-server-secret` 是否自动包含 `MATRIX_MBR_ACCESS_TOKEN`。
  - 复验 `ui-server` 启动日志与颜色生成器 smoke。
- Out of scope:
  - 本地未提交的 UI/renderer/tooling 改动。
  - 修复 shadow `workers.yaml` 机制本身的长期设计问题（仅记录）。

## Invariants / Constraints

- 以当前本地提交 `2e00cbe` 为代码基线。
- 仅在发现 deploy 复验仍失败时才继续改代码；否则只记录证据并收口。
- `ui-server` 继续使用 `drop` token，不恢复 password-only 路径。

## Success Criteria

- `deploy_cloud.sh` 重跑后，`ui-server-secret` 自带 `MATRIX_MBR_ACCESS_TOKEN`。
- `ui-server` 启动日志出现 `Matrix adapter connected`，且无 `429 Too Many Requests (.../login)`。
- 颜色生成器 smoke 继续为 `processed`。
