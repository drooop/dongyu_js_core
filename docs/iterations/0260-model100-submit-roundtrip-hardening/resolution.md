---
title: "Iteration 0260-model100-submit-roundtrip-hardening Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0260-model100-submit-roundtrip-hardening
id: 0260-model100-submit-roundtrip-hardening
phase: phase1
---

# Iteration 0260-model100-submit-roundtrip-hardening Resolution

## Execution Strategy

- 先冻结 authoritative path，再按 TDD 逐层修复：
  1. server routing
  2. stale inflight
  3. remote-worker conformance
  4. return-path alignment
  5. local live browser proof
- 禁止先修浏览器表象再猜后端。

## Step 1

- Scope:
  - 新增/更新 focused RED tests，明确 `submit` 当前失败点
- Files:
  - `scripts/tests/test_0260_model100_submit_authoritative_routing_contract.mjs`
  - `scripts/tests/test_0144_remote_worker.mjs`
  - `scripts/validate_model100_records_e2e_v0.mjs`
- Verification:
  - 先跑 RED，确认当前失败口径稳定
- Acceptance:
  - 失败原因被缩到 routing / inflight / return-path 之一
- Rollback:
  - 删除新增测试文件或还原测试改动

## Step 2

- Scope:
  - 修 `submit` authoritative routing，不再误入 home/llm dispatch
- Files:
  - `packages/ui-model-demo-server/server.mjs`
- Verification:
  - `node scripts/tests/test_0260_model100_submit_authoritative_routing_contract.mjs`
  - `node scripts/tests/test_0182_model100_submit_chain_contract.mjs`
- Acceptance:
  - `submit` 不再返回 `home_dispatch_blocked`
- Rollback:
  - 还原 server routing patch

## Step 3

- Scope:
  - 修 stale inflight recovery，让按钮可重新进入 submit 链
- Files:
  - `packages/worker-base/system-models/test_model_100_ui.json`
  - `packages/worker-base/system-models/workspace_positive_models.json`
  - `scripts/tests/test_0182_model100_singleflight_release_contract.mjs`
  - `scripts/tests/test_0260_model100_submit_stale_inflight_contract.mjs`
- Verification:
  - stale inflight RED/GREEN tests
- Acceptance:
  - `submit_inflight=true` 且过期时可被正确清理
- Rollback:
  - 还原 submit guard 变更

## Step 4

- Scope:
  - 修 remote-worker processing cell 对当前 scoped privilege 规则的不合规写法
- Files:
  - `deploy/sys-v1ns/remote-worker/patches/10_model100.json`
  - 如必要：对应 local reference patch / tests
- Verification:
  - `node scripts/tests/test_0144_remote_worker.mjs`
  - focused same-model privilege / function execution proof
- Acceptance:
  - remote-worker 收到 `/100/event` 后，不再触发 `direct_access_privilege_required`
  - `status=processed` / `bg_color` 更新真实发生
- Rollback:
  - 还原 remote-worker patch

## Step 5

- Scope:
  - 统一 `patch` / `patch_out` return-path contract
- Files:
  - `deploy/sys-v1ns/remote-worker/patches/10_model100.json`
  - `deploy/sys-v1ns/remote-worker/patches/00_remote_worker_config.json`
  - 如必要：`deploy/sys-v1ns/mbr/patches/mbr_role_v0.json`
- Verification:
  - `node scripts/tests/test_0144_remote_worker.mjs`
  - `node scripts/validate_model100_records_e2e_v0.mjs`
- Acceptance:
  - 去程/回程链路都恢复 PASS
- Rollback:
  - 还原 patch files

## Step 6

- Scope:
  - 本地 live 浏览器 proof
- Files:
  - `output/playwright/0260-model100-submit-roundtrip-hardening/**`
  - `docs/iterations/0260-model100-submit-roundtrip-hardening/runlog.md`
- Verification:
  - `bash scripts/ops/deploy_local.sh`
  - `bash scripts/ops/check_runtime_baseline.sh`
  - 真实点击 `Generate Color`
  - 交叉读取 `/snapshot`
- Acceptance:
  - 浏览器和 snapshot 一致显示 submit 完成
- Rollback:
  - 不需要代码回滚；只删除无效证据文件

## Notes

- Generated at: 2026-03-29
