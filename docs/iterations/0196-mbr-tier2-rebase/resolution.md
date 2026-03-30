---
title: "Iteration 0196-mbr-tier2-rebase Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-03-21
source: ai
iteration_id: 0196-mbr-tier2-rebase
id: 0196-mbr-tier2-rebase
phase: phase1
---

# Iteration 0196-mbr-tier2-rebase Resolution

## Execution Strategy

- 先锁定真实部署入口和 MBR 的当前 contract 面。
- 再重填 MBR patch / bootstrap / glue 边界，优先把 role-specific 能力下沉到 Tier 2。
- 最后用现有 MBR 合同测试回归，并记录哪些 host glue 仍然保留。

## Step 1

- Scope:
  - 审计 MBR 真实执行链：
    - `k8s/Dockerfile.mbr-worker`
    - `scripts/run_worker_v0.mjs`
    - `deploy/sys-v1ns/mbr/patches/mbr_role_v0.json`
    - `scripts/ops/_deploy_common.sh`
  - 审计相关合同测试与 runtime mode / bootstrap 约束
- Files:
  - `k8s/Dockerfile.mbr-worker`
  - `scripts/run_worker_v0.mjs`
  - `deploy/sys-v1ns/mbr/patches/mbr_role_v0.json`
  - `scripts/ops/_deploy_common.sh`
  - `scripts/tests/test_0144_mbr_compat.mjs`
  - `scripts/tests/test_0177_mbr_bridge_contract.mjs`
  - `scripts/tests/test_0179_mbr_route_contract.mjs`
  - `scripts/tests/test_0179_mbr_runtime_mode_gate.mjs`
  - `scripts/tests/test_0184_mbr_direct_event_bridge_contract.mjs`
  - `scripts/tests/test_0175_matrix_patch_bootstrap_contract.mjs`
- Verification:
  - `rg -n "WorkerEngineV0|loadSystemPatch|MODELTABLE_PATCH_JSON|mbr_" scripts/run_worker_v0.mjs deploy/sys-v1ns/mbr/patches scripts/ops/_deploy_common.sh`
  - `node scripts/tests/test_0144_mbr_compat.mjs`
  - `node scripts/tests/test_0177_mbr_bridge_contract.mjs`
  - `node scripts/tests/test_0179_mbr_route_contract.mjs`
  - `node scripts/tests/test_0179_mbr_runtime_mode_gate.mjs`
  - `node scripts/tests/test_0184_mbr_direct_event_bridge_contract.mjs`
  - `node scripts/tests/test_0175_matrix_patch_bootstrap_contract.mjs`
- Acceptance:
  - 真实入口与当前 contract 面明确
  - deprecated 路径已显式排除
- Rollback:
  - 本步仅记录事实，无代码回滚需求

## Step 2

- Scope:
  - 重填 MBR 角色 patch
  - 必要时调整 `run_worker_v0.mjs` 中仅属于 MBR 的过量 glue
  - 不触碰 remote/UI-side 角色
- Files:
  - `deploy/sys-v1ns/mbr/patches/*`
  - `scripts/run_worker_v0.mjs`
  - 相关 MBR 合同测试
- Verification:
  - `node scripts/tests/test_0144_mbr_compat.mjs`
  - `node scripts/tests/test_0177_mbr_bridge_contract.mjs`
  - `node scripts/tests/test_0179_mbr_route_contract.mjs`
  - `node scripts/tests/test_0179_mbr_runtime_mode_gate.mjs`
  - `node scripts/tests/test_0184_mbr_direct_event_bridge_contract.mjs`
  - `rg -n "MQTT_WILDCARD_SUB|MGMT_OUT|run_mbr_" deploy/sys-v1ns/mbr/patches scripts/run_worker_v0.mjs`
- Acceptance:
  - MBR 角色主要业务能力已转为新版 Tier 2 patch 路径
  - 旧桥接语义核心依赖已显著减少
  - 测试全部通过
- Rollback:
  - 回退 MBR patch 与 `run_worker_v0.mjs`

## Step 3

- Scope:
  - 收口 runlog / `docs/ITERATIONS`
  - 明确记录 `0198` 是否独立保留的阶段性判断
- Files:
  - `docs/iterations/0196-mbr-tier2-rebase/runlog`
  - `docs/ITERATIONS`
- Verification:
  - runlog 记录 commit / merge / test evidence / 0198 decision note
  - `docs/ITERATIONS` 状态与 runlog 一致
- Acceptance:
  - 台账完整
  - `0198` 前置决策没有继续悬而未决
- Rollback:
  - 回退 docs vault 中本轮新增记录
