---
title: "Iteration 0200b-local-patch-externalization Plan"
doc_type: iteration-plan
status: planned
updated: 2026-03-21
source: ai
iteration_id: 0200b-local-patch-externalization
id: 0200b-local-patch-externalization
phase: phase1
---

# Iteration 0200b-local-patch-externalization Plan

## Goal

- 在本地 K8s 环境中把 `ui-server + mbr-worker + remote-worker + ui-side-worker` 的 authoritative patch/source 改为 **外挂目录加载**，证明修改 Tier 2 资产后只需更新挂载内容并 rollout restart，不需要重新 build 镜像。

## Background

- `0200a` 已冻结 persisted asset loader 规约：
  - authoritative asset 来自 persisted asset root
  - loader 以 manifest + phase 为主
  - authoritative / bootstrap-generated / volatile 必须分层
- 当前本地部署虽然可运行，但 patch 仍 baked in image：
  - [Dockerfile.ui-server](/Users/drop/codebase/cowork/dongyuapp_elysia_based/k8s/Dockerfile.ui-server)
  - [Dockerfile.mbr-worker](/Users/drop/codebase/cowork/dongyuapp_elysia_based/k8s/Dockerfile.mbr-worker)
  - [Dockerfile.remote-worker](/Users/drop/codebase/cowork/dongyuapp_elysia_based/k8s/Dockerfile.remote-worker)
  - [Dockerfile.ui-side-worker](/Users/drop/codebase/cowork/dongyuapp_elysia_based/k8s/Dockerfile.ui-side-worker)
- 本地部署已经存在一个现成的 hostPath 基座：
  - [k8s/local/workers.yaml](/Users/drop/codebase/cowork/dongyuapp_elysia_based/k8s/local/workers.yaml#L140) 到 [k8s/local/workers.yaml](/Users/drop/codebase/cowork/dongyuapp_elysia_based/k8s/local/workers.yaml#L155) 为 `ui-server` 挂了 `/Users/drop/dongyu/volume/persist/ui-server`
- 当前 authoritative asset 体量也适合先做本地 hostPath 路线：
  - `deploy/sys-v1ns/mbr/patches` 约 `8K`
  - `deploy/sys-v1ns/remote-worker/patches` 约 `12K`
  - `deploy/sys-v1ns/ui-side-worker/patches` 约 `8K`
  - `packages/worker-base/system-models` 约 `236K`

## Scope

- In scope:
  - 为本地环境定义并创建统一 persisted asset root
  - 选择本地部署落点：`hostPath`
  - 调整本地 `ui-server / mbr-worker / remote-worker / ui-side-worker` 的启动与 manifest，使其从外挂目录读 authoritative assets
  - 保持 `MODELTABLE_PATCH_JSON` 继续作为 bootstrap-generated overlay
  - 增加最小验证，证明：
    - 改 patch 文件
    - 不重建镜像
    - 只 rollout restart
    - 行为生效
- Out of scope:
  - 不做 cloud 挂载落地
  - 不做前端 thin shell / local mode 动态化
  - 不做 component registry 动态拉取实现
  - 不修改 worker 业务语义

## Invariants / Constraints

- 本轮只做本地外挂化，不改变远端 `0200` 的 On Hold 状态。
- 本地部署落点明确采用 `hostPath`，不采用 `ConfigMap`：
  - 原因：
    - 本地开发需要直接编辑宿主机文件并立即验证
    - 已有 `ui-server` 持久化 hostPath 先例
    - 避免把 `ConfigMap` 1MB 限制和多文件管理提前引入本地迭代
- authoritative assets 与 bootstrap overlays 不得混载到同一路径中。
- 本轮不允许以“镜像里还有一份旧 patch”作为 fallback；一旦切到外挂目录，实际加载 authority 必须明确来自挂载路径。

## Success Criteria

- 本地存在统一 persisted asset root，并包含：
  - system assets
  - role patches
  - manifest
- 4 个角色的本地运行链都从外挂目录读取 authoritative assets。
- `deploy_local.sh` 在本轮后不再需要因 patch 变更而重建 4 个镜像。
- 至少一条最小验证能证明：
  - 修改外挂 patch 文件
  - 执行 rollout restart
  - 不重建镜像
  - 页面/worker 行为发生对应变化
- `0200c` 所需的本地验证入口已准备好。

## Risks & Mitigations

- Risk:
  - `ui-server` 当前是“system models + sqlite + bootstrap overlays + host state seed”混合装载，切换 authority 时容易把 overlay 和 authoritative assets 混在一起。
  - Mitigation:
    - 本轮明确目录分层，bootstrap 仍保留 secret/env 路径，不并入 authoritative root。
- Risk:
  - 只改 worker，不改 `ui-server`，会导致页面资产仍依赖镜像内容，无法证明真正的“本地 patch 外挂化”。
  - Mitigation:
    - 本轮 scope 明确包含 `ui-server`。
- Risk:
  - 如果沿用 `ConfigMap`，本地改文件的反馈链仍然不顺畅。
  - Mitigation:
    - 本地先固定 `hostPath`，cloud 的挂载形态留到恢复 `0200` 前再单独决定。

## Alternatives

### A. 推荐：本地统一使用 `hostPath` 外挂 authoritative assets

- 优点：
  - 最适合本地开发与快速验证
  - 不需要先解决 `ConfigMap` 多文件同步问题
  - 与当前 `ui-server` 的本地持久化模式一致
- 缺点：
  - cloud 不可直接照搬
  - 仍需后续定义远端挂载策略

### B. 本地直接用 `ConfigMap`

- 优点：
  - 更接近 K8s 原生配置分发
- 缺点：
  - 本地编辑反馈链更差
  - 多文件/大目录管理更麻烦
  - 对这轮目标过重

当前推荐：A。

## Inputs

- Created at: 2026-03-20
- Iteration ID: 0200b-local-patch-externalization
- Trigger:
  - `0200a` 已完成并冻结 loader 规约
  - 用户确认可以直接开启 `0200b`
  - 额外建议已采纳：本轮必须明确本地落点采用 `hostPath`
