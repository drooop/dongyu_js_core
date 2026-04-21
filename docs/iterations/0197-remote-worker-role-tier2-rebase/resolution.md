---
title: "Iteration 0197-remote-worker-role-tier2-rebase Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0197-remote-worker-role-tier2-rebase
id: 0197-remote-worker-role-tier2-rebase
phase: phase1
---

# Iteration 0197-remote-worker-role-tier2-rebase Resolution

## Execution Strategy

- 先锁定 remote worker 的真实 runner 与当前 contract 面。
- 再重填 role patch，尽量不改 runner。
- 最后用 remote worker 合同测试回归，并记录最小 host glue 边界与 `0198` 决策。

## Step 1

- Scope:
  - 审计 remote worker 真实执行链：
    - `k8s/Dockerfile.remote-worker`
    - `scripts/run_worker_remote_v1.mjs`
    - `deploy/sys-v1ns/remote-worker/patches/*.json`
  - 审计相关 contract tests 与 observability tests
- Files:
  - `k8s/Dockerfile.remote-worker`
  - `scripts/run_worker_remote_v1.mjs`
  - `deploy/sys-v1ns/remote-worker/patches/*`
  - `scripts/tests/test_0144_remote_worker.mjs`
  - `scripts/tests/test_0184_remote_worker_direct_event_contract.mjs`
  - `scripts/tests/test_0184_remote_worker_wildcard_event_contract.mjs`
  - `scripts/tests/test_0184_remote_worker_observability_contract.mjs`
  - `scripts/tests/test_0170_local_bun_real_mqtt.mjs`
- Verification:
  - `rg -n "MQTT_WILDCARD_SUB|ui_type|routing|wiring|publishMqtt|writeLabel|pin.connect|func.js" deploy/sys-v1ns/remote-worker/patches scripts/run_worker_remote_v1.mjs`
  - `node scripts/tests/test_0144_remote_worker.mjs`
  - `node scripts/tests/test_0184_remote_worker_direct_event_contract.mjs`
  - `node scripts/tests/test_0184_remote_worker_wildcard_event_contract.mjs`
  - `node scripts/tests/test_0184_remote_worker_observability_contract.mjs`
- Acceptance:
  - remote worker 真实入口与 contract 面明确
  - runner / patch 的职责边界明确
- Rollback:
  - 本步仅记录事实，无代码回滚需求

## Step 2

- Scope:
  - 重填 remote worker role patch
  - 仅在必要时调整 `run_worker_remote_v1.mjs`
  - 更新/补齐 remote worker contract tests
- Files:
  - `deploy/sys-v1ns/remote-worker/patches/*`
  - `scripts/run_worker_remote_v1.mjs`
  - 相关 remote worker tests
- Verification:
  - `node scripts/tests/test_0144_remote_worker.mjs`
  - `node scripts/tests/test_0184_remote_worker_direct_event_contract.mjs`
  - `node scripts/tests/test_0184_remote_worker_wildcard_event_contract.mjs`
  - `node scripts/tests/test_0184_remote_worker_observability_contract.mjs`
  - `rg -n "MQTT_WILDCARD_SUB|ui_type|routing|wiring" deploy/sys-v1ns/remote-worker/patches scripts/run_worker_remote_v1.mjs`
- Acceptance:
  - remote role patch 主要业务能力已转到新版 Tier 2 结构
  - 旧语义残留显著减少
  - 测试全部通过
- Rollback:
  - 回退 remote worker patch 与 runner

## Step 3

- Scope:
  - 收口 runlog / `docs/ITERATIONS`
  - 再次固化 `0198` 独立角色判断
- Files:
  - `docs/iterations/0197-remote-worker-role-tier2-rebase/runlog`
  - `docs/ITERATIONS`
- Verification:
  - runlog 记录 commit / merge / test evidence / 0198 decision note
  - `docs/ITERATIONS` 状态与 runlog 一致
- Acceptance:
  - 台账完整
  - `0198` 前置决策不再悬而未决
- Rollback:
  - 回退 docs vault 中本轮新增记录
