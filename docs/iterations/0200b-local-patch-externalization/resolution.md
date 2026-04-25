---
title: "Iteration 0200b-local-patch-externalization Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0200b-local-patch-externalization
id: 0200b-local-patch-externalization
phase: phase1
---

# Iteration 0200b-local-patch-externalization Resolution

## Execution Strategy

- 先建立本地 persisted asset root，并把 authoritative assets 镜像外化到宿主机目录。
- 再调整本地 4 角色的启动入口与 manifest，使它们都从挂载路径读取 authoritative assets。
- 最后用“不重建镜像，仅改 patch + rollout restart”的最小演示验证目标是否达成。

## Step 1

- Scope:
  - 建立本地 persisted asset root 目录结构
  - 明确 manifest 与角色/系统资产的宿主机落点
  - 准备本地同步脚本或复制逻辑
- Files:
  - `scripts/ops/deploy_local.sh`
  - `scripts/ops/_deploy_common.sh`
  - 必要时新增本地 asset sync 脚本
  - 本地 persisted asset root（hostPath target）
- Verification:
  - `rg -n "hostPath|persist-data|DY_PERSIST_ROOT" k8s/local scripts/ops -g '*.yaml' -g '*.sh'`
  - `find <local-persisted-asset-root> -maxdepth 3 -type f | sort`
- Acceptance:
  - 本地 authoritative asset root 路径明确
  - 目录结构与 `0200a` 设计保持一致或有明确裁剪说明
- Rollback:
  - 回退本轮新增的本地 asset sync / path 配置

## Step 2

- Scope:
  - 修改 `ui-server / mbr-worker / remote-worker / ui-side-worker` 的本地加载路径
  - 让 Dockerfile 不再负责携带 authoritative patch 目录
  - 让 local manifests 通过 hostPath 挂载 authoritative assets
- Files:
  - `k8s/Dockerfile.ui-server`
  - `k8s/Dockerfile.mbr-worker`
  - `k8s/Dockerfile.remote-worker`
  - `k8s/Dockerfile.ui-side-worker`
  - `k8s/local/workers.yaml`
  - `k8s/local/ui-side-worker.yaml`
  - `scripts/run_worker_v0.mjs`
  - `scripts/run_worker_remote_v1.mjs`
  - `scripts/run_worker_ui_side_v0.mjs`
  - `packages/ui-model-demo-server/server.mjs`
- Verification:
  - `rg -n "COPY .*deploy/sys-v1ns|COPY .*worker-base/system-models" k8s/Dockerfile.*`
  - `bash scripts/ops/deploy_local.sh`
  - `kubectl -n dongyu get pods -o wide`
  - `kubectl -n dongyu describe deploy/ui-server`
  - `kubectl -n dongyu describe deploy/mbr-worker`
  - `kubectl -n dongyu describe deploy/remote-worker`
  - `kubectl -n dongyu describe deploy/ui-side-worker`
- Acceptance:
  - authoritative patch 目录不再从镜像内 COPY 读取
  - 4 个角色都从 hostPath 挂载路径读取 authoritative assets
  - bootstrap-generated overlay 仍保持原 secret/env 路径
- Rollback:
  - 回退 Dockerfile / manifest / loader path 改动

## Step 3

- Scope:
  - 做最小“不重建镜像”证明
  - 验证 patch 改动经 hostPath + rollout restart 即生效
- Files:
  - 一条最小演示用 patch 文件
  - 必要时新增验证脚本
  - `output/playwright/`
- Verification:
  - 初次部署后记录当前页面/worker状态
  - 修改一处 authoritative patch 文件
  - **不执行 docker build**
  - 只执行：
    - `kubectl -n dongyu rollout restart ...`
  - 再次验证页面/worker状态发生变化
- Acceptance:
  - 有明确证据证明“改 patch 不重建镜像”已成立
  - 本地验证足以支撑 `0200c`
- Rollback:
  - 还原演示 patch 文件
  - 必要时重新 rollout 到上一状态

## Step 4

- Scope:
  - 收口 runlog / `docs/ITERATIONS`
  - 为 `0200c` 和恢复 `0200` 记录事实前提
- Files:
  - `docs/iterations/0200b-local-patch-externalization/runlog.md`
  - `docs/ITERATIONS.md`
  - 必要时更新总设计文档
- Verification:
  - runlog 必须记录：
    - hostPath 根路径
    - 挂载方式
    - 验证命令
    - “未重建镜像”的证据
  - `docs/ITERATIONS` 状态与 runlog 一致
- Acceptance:
  - 本轮证据链完整
  - `0200c` 可直接基于本轮结果开始本地验证
- Rollback:
  - 回退 docs vault 中本轮记录
