---
title: "0349 Data Model Tier2 And Remote Deploy Optimization Resolution"
doc_type: iteration-resolution
status: active
updated: 2026-04-29
source: ai
---

# Iteration 0349-data-model-tier2-and-remote-deploy-optimization Resolution

## Execution Strategy

分 5 个阶段执行。每个阶段先落盘事实或改动，再运行本阶段验证，然后用 sub-agent 调用 `codex-code-review` 审查；若审查要求修改，修复并复审通过后继续。

## Step 1 — Inventory And Plan

- Scope:
  - 盘点 Data.* 现状、Tier 2 实现候选、适用场景与远端部署同步路径。
- Files:
  - `docs/iterations/0349-data-model-tier2-and-remote-deploy-optimization/data_model_tier2_inventory.md`
  - `docs/iterations/0349-data-model-tier2-and-remote-deploy-optimization/remote_deploy_sync_inventory.md`
  - `docs/iterations/0349-data-model-tier2-and-remote-deploy-optimization/plan.md`
  - `docs/iterations/0349-data-model-tier2-and-remote-deploy-optimization/resolution.md`
  - `docs/iterations/0349-data-model-tier2-and-remote-deploy-optimization/runlog.md`
  - `docs/ITERATIONS.md`
- Verification:
  - `git diff --check`
  - sub-agent review
- Acceptance:
  - 事实盘点能解释当前实现、目标合同、部署现状和优化切入点。
  - Stage 1 review findings are fixed: `Data.Single` placement is not conflated with collection models, and archive fallback revision-gate risk is documented.
- Rollback:
  - 删除 0349 迭代目录新增文件，并移除 `docs/ITERATIONS.md` 中 0349 行。

## Step 2 — Tier 2 Implementation Design

- Scope:
  - 冻结 Data.* Tier 2 实现路线和适用场景边界。
- Files:
  - `docs/ssot/data_model_tier2_implementation_v1.md`
  - `docs/ssot/runtime_semantics_modeltable_driven.md`
  - `docs/user-guide/data_models_filltable_guide.md`
  - `scripts/tests/test_0349_data_model_tier2_plan.mjs`
- Verification:
  - `node scripts/tests/test_0349_data_model_tier2_plan.mjs`
  - `git diff --check`
  - sub-agent review
- Acceptance:
  - 文档明确不把 Data.* 行为放回 Tier 1；后续迁移可按 Data.Single / Array / Queue / Stack / CircularBuffer / LinkedList / FlowTicket 拆分。
- Rollback:
  - 删除新增 SSOT 和测试，恢复 runtime semantics 与 user guide 改动。

## Step 3 — Deploy Sync Optimization

- Scope:
  - 优化远端 deploy 同步/构建路径，优先减少 Docker build context 和 archive fallback 同步范围。
- Files:
  - `.dockerignore`
  - `scripts/ops/sync_cloud_source.sh`
  - `scripts/ops/deploy_cloud_app.sh`
  - `scripts/ops/deploy_cloud_full.sh`
  - `scripts/ops/README.md`
  - `scripts/tests/test_0349_remote_deploy_sync_contract.mjs`
- Verification:
  - `node scripts/tests/test_0349_remote_deploy_sync_contract.mjs`
  - `node scripts/tests/test_0183_cloud_split_deploy_contract.mjs`
  - `node scripts/tests/test_0200_cloud_loader_chain_contract.mjs`
  - `git diff --check`
  - sub-agent review
- Acceptance:
  - Docker build context 不再默认携带 docs/test/archive/output 等非运行文件。
  - archive fallback 只同步 deploy source 必要路径，并保留远端 `deploy/env`。
  - archive fallback 后的 deploy source revision detection 不会被 stale `.git` HEAD 覆盖。
- Rollback:
  - 删除 `.dockerignore`，恢复 `sync_cloud_source.sh`、deploy scripts 与 ops README。

## Step 4 — Remote Deploy Verification

- Scope:
  - 同步当前 revision 到远端，执行远端 app deploy，记录 preflight/source gate/rollout 证据。
- Files:
  - `k8s/Dockerfile.ui-server`
  - `k8s/Dockerfile.ui-server-prebuilt`
  - `k8s/Dockerfile.remote-worker`
  - `scripts/tests/test_0349_remote_deploy_sync_contract.mjs`
  - `scripts/ops/README.md`
  - `docs/iterations/0349-data-model-tier2-and-remote-deploy-optimization/runlog.md`
- Verification:
  - `bash scripts/ops/sync_cloud_source.sh --ssh-user drop --ssh-host 124.71.43.80 --remote-repo /home/wwpic/dongyuapp --remote-repo-owner wwpic --revision "$(git rev-parse --short HEAD)"`
  - `ssh drop@124.71.43.80 "sudo -n env KUBECONFIG=/etc/rancher/rke2/rke2.yaml CTR=/usr/local/bin/ctr bash /home/wwpic/dongyuapp/scripts/ops/remote_preflight_guard.sh"`
  - `ssh drop@124.71.43.80 "sudo -n bash /home/wwpic/dongyuapp/scripts/ops/deploy_cloud_app.sh --target ui-server --revision $(git rev-parse --short HEAD)"`
  - a remote HTTP or pod-level smoke check recorded in runlog
  - `docker build -f k8s/Dockerfile.ui-server -t dy-ui-server:0349-noapt .`
  - `docker build -f k8s/Dockerfile.remote-worker -t dy-remote-worker:0349-noapt .`
  - sub-agent review
- Acceptance:
  - Bun-based deploy builds no longer depend on remote apt by default, and the `INSTALL_SYSTEM_CA=1` rollback switch remains documented.
  - 远端 rke2 preflight PASS。
  - `ui-server` rollout PASS。
  - target source gate PASS。
  - 远端服务可访问或 pod 内 `/snapshot` smoke PASS。
- Rollback:
  - 若 deploy 失败，使用上一个远端 `origin/dev`/last-good revision 重跑 `deploy_cloud_app.sh --target ui-server --revision <rev>`。

## Step 5 — Final Gate

- Scope:
  - 更新迭代状态，最终审查，合并到 `dev` 并推送。
- Files:
  - `docs/ITERATIONS.md`
  - `docs/iterations/0349-data-model-tier2-and-remote-deploy-optimization/runlog.md`
- Verification:
  - all 0349 tests
  - final sub-agent review
  - `git status --short --branch`
- Acceptance:
  - 0349 状态为 Completed，`dev` 已包含并推送。
- Rollback:
  - revert merge commit from `dev` if post-merge validation fails before push.

## Notes

- Generated at: 2026-04-29
