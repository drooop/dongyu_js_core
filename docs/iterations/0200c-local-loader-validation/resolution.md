---
title: "Iteration 0200c-local-loader-validation Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-03-21
source: ai
iteration_id: 0200c-local-loader-validation
id: 0200c-local-loader-validation
phase: phase1
---

# Iteration 0200c-local-loader-validation Resolution

## Execution Strategy

- 先做静态和结构性核验，确认 `0200b` 的 manifest / mount / loader 入口都已存在。
- 再做 clean deploy、patch-only、restore 三段式验证。
- 最后以 smoke + 浏览器证据给出 `0200` 恢复与否的明确裁决。

## Step 1

- Scope:
  - 审计 `0200b` 的静态接线与当前本地运行状态
  - 确认 4 个角色都以 `/app/persisted-assets` 读取 authoritative assets
- Files:
  - `packages/worker-base/src/persisted_asset_loader.mjs`
  - `scripts/ops/sync_local_persisted_assets.sh`
  - `scripts/ops/deploy_local.sh`
  - `k8s/local/workers.yaml`
  - `k8s/local/ui-side-worker.yaml`
- Verification:
  - `node scripts/tests/test_0200b_persisted_asset_loader_contract.mjs`
  - `node scripts/tests/test_0200b_local_externalization_contract.mjs`
  - `kubectl -n dongyu describe deploy/ui-server`
  - `kubectl -n dongyu describe deploy/mbr-worker`
  - `kubectl -n dongyu describe deploy/remote-worker`
  - `kubectl -n dongyu describe deploy/ui-side-worker`
- Acceptance:
  - 静态 contract PASS
  - 当前本地运行态确实走外挂目录
- Rollback:
  - 本步只记录事实，无代码回滚需求

## Step 2

- Scope:
  - clean deploy 验证
  - patch-only 验证
  - restore 验证
- Files:
  - authoritative patch 文件
  - `output/playwright/`
  - 本地 persisted asset root
- Verification:
  - clean deploy:
    - `bash scripts/ops/deploy_local.sh`
  - patch-only:
    - 临时修改一处 authoritative patch
    - `SKIP_IMAGE_BUILD=1 bash scripts/ops/deploy_local.sh`
  - restore:
    - 恢复 patch
    - `SKIP_IMAGE_BUILD=1 bash scripts/ops/deploy_local.sh`
  - 浏览器：
    - cache-bust 打开 `http://127.0.0.1:30900`
    - 记录变更前后截图
- Acceptance:
  - 3 段式验证全部通过
  - 明确证明 patch-only 更新无需镜像重建
- Rollback:
  - 还原临时 patch 改动

## Step 3

- Scope:
  - 跑本地真实链路 smoke
  - 评估 `0200` 是否满足恢复条件
- Files:
  - `scripts/ops/verify_model100_submit_roundtrip.sh`
  - `scripts/ops/verify_ui_side_worker_snapshot_delta.sh`
  - runlog
- Verification:
  - `bash scripts/ops/verify_model100_submit_roundtrip.sh --base-url http://127.0.0.1:30900`
  - `bash scripts/ops/verify_ui_side_worker_snapshot_delta.sh`
- Acceptance:
  - 2 条主链路 smoke 全 PASS
  - runlog 明确写出：
    - `0200` 恢复执行
    - 或保留 `On Hold` 的原因
- Rollback:
  - 本步只记录验证事实，无额外回滚

## Step 4

- Scope:
  - 收口 runlog / `docs/ITERATIONS`
- Files:
  - `docs/iterations/0200c-local-loader-validation/runlog.md`
  - `docs/ITERATIONS.md`
  - 若 `0200` 恢复，则同步更新 `0200` 台账
- Verification:
  - runlog 记录：
    - clean deploy
    - patch-only
    - restore
    - smoke
    - 浏览器截图
    - 恢复结论
- Acceptance:
  - `0200c` 的完成状态与 `0200` 恢复状态在台账中一致
- Rollback:
  - 回退 docs vault 中本轮记录
