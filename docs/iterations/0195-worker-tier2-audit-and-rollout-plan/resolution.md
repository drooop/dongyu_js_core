---
title: "Iteration 0195-worker-tier2-audit-and-rollout-plan Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-03-21
source: ai
iteration_id: 0195-worker-tier2-audit-and-rollout-plan
id: 0195-worker-tier2-audit-and-rollout-plan
phase: phase1
---

# Iteration 0195-worker-tier2-audit-and-rollout-plan Resolution

## Execution Strategy

- 先做入口级审计，明确 3 个系统今天各自的 bootstrap / patch / deploy / browser surface。
- 再把审计结果收成一份可直接指导 0196-0200 的 rollout 文档。
- 本轮只产出文档和矩阵，不做任何实现或部署。

## Step 1

- Scope:
  - 审计以下入口和资产：
    - `scripts/run_worker_mbr_v0.mjs`
    - `scripts/run_worker_remote_v1.mjs`
    - `scripts/run_worker_ui_side_v0.mjs`
    - `packages/ui-model-demo-server/server.mjs`
    - `deploy/sys-v1ns/mbr/patches/**`
    - `deploy/sys-v1ns/remote-worker/patches/**`
    - `scripts/ops/deploy_local.sh`
    - `scripts/ops/deploy_cloud.sh`
  - 明确：
    - 哪些已是 fill-table bootstrap
    - 哪些仍是 legacy / hardcoded path
    - 哪些与新版 Tier 2 目标冲突
- Files:
  - `scripts/run_worker_mbr_v0.mjs`
  - `scripts/run_worker_remote_v1.mjs`
  - `scripts/run_worker_ui_side_v0.mjs`
  - `packages/ui-model-demo-server/server.mjs`
  - `deploy/sys-v1ns/mbr/patches/*`
  - `deploy/sys-v1ns/remote-worker/patches/*`
  - `scripts/ops/deploy_local.sh`
  - `scripts/ops/deploy_cloud.sh`
- Verification:
  - `ls scripts | rg "run_worker_(mbr|remote|ui)"`
  - `find deploy/sys-v1ns -maxdepth 3 -type d | rg "mbr|remote"`
  - `rg -n "WorkerEngineV0|loadSystemPatch|loadSystemModelPatches|applyPatch|createModel|addLabel|ensureStateLabel|startMqttLoop" scripts packages deploy/sys-v1ns`
- Acceptance:
  - 3 个系统当前入口与 patch 资产清单明确
  - 关键 legacy / hardcoded / fill-table 路径均有证据
- Rollback:
  - 本步仅记录事实，无代码回滚需求

## Step 2

- Scope:
  - 产出 rollout 规划文档，至少包含：
    - 3 系统差距矩阵
    - 硬编码初始化 vs JSON patch 初始化清单
    - 目标 patch / model ownership map
    - 本地部署前置条件
    - 远端部署前置条件
    - 浏览器测例矩阵
    - `0196/0197/0198/0199/0200` 的拆分建议、风险与回滚点
- Files:
  - `docs/plans/2026-03-19-worker-tier2-audit-and-rollout-plan`
  - `docs/iterations/0195-worker-tier2-audit-and-rollout-plan/runlog`
  - `docs/ITERATIONS`
- Verification:
  - 审计文档中 6 类产出全部存在
  - `0196-0200` 每个后续 iteration 都有明确边界与 DoD
- Acceptance:
  - 后续 rollout 可直接据此拆迭代，不再依赖聊天上下文
- Rollback:
  - 回退本轮新增文档

## Step 3

- Scope:
  - 收口 runlog 与 `docs/ITERATIONS`
- Files:
  - `docs/iterations/0195-worker-tier2-audit-and-rollout-plan/runlog`
  - `docs/ITERATIONS`
- Verification:
  - runlog 记录审计命令、关键 finding 与最终文档路径
  - `docs/ITERATIONS` 状态与 runlog 一致
- Acceptance:
  - 台账完整
- Rollback:
  - 回退 docs vault 中本轮新增记录
