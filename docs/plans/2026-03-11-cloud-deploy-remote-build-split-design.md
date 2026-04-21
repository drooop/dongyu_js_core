---
title: "Cloud Deploy Remote Build Split Design"
doc_type: note
status: active
updated: 2026-04-21
source: ai
---

# Cloud Deploy Remote Build Split Design

## Goal

把 cloud deploy 主路径从 `local docker save + scp tar + remote ctr import` 迁移为“远端同步源码后直接 remote build，再导入 rke2 containerd”，同时把远端发布拆成 `full deploy` 与 `app fast deploy` 两类，降低单次发布时延并减少无关服务的连带 rollout。

## Context

- 当前没有私有镜像仓库，因此不能直接切到 `registry push/pull`。
- 现有主路径会在本地 build 完整 `dy-ui-server:v1` 后，再导出约 `430MB` tar，通过公网 `scp` 到远端，然后在远端执行 `ctr images import`。
- 最近多次远端热修证明，真正最慢的部分是：
  - 本地 `docker save`
  - 大 tar 上传
  - 远端再次导入 tar
- 现有 `deploy_cloud.sh` 同时承担：
  - preflight
  - synapse 初始化
  - matrix token / room 建立
  - secret 重建
  - image import
  - workers apply
  - rollout restart
  - source integrity gate
- 这导致即使只是改 `ui-server` 前端 bundle，也仍然容易沿用“全量部署”心智模型。

## Approaches

### Option A — 引入镜像仓库，切换到 registry pull

- 优点:
  - 最终形态最标准，远端只拉 layer 增量
  - 可天然支持 revision/tag 管理
  - 后续 CI/CD 最容易扩展
- 缺点:
  - 当前没有可用 registry，也没有既定凭证流
  - 需要新建仓库、登录、push policy、tag policy、清理策略
  - 当前不是最短恢复路径

### Option B — 远端 remote build + full/app split（推荐）

- 优点:
  - 不需要新增外部基础设施
  - 直接消除 `scp` 大 tar 的公网传输
  - 能在现有 `rke2 + kubectl + ctr` 路径上最小演进
  - 可以顺手把 deploy 拆成：
    - `full deploy`
    - `app fast deploy`
- 缺点:
  - 远端源码目录必须严格对齐目标 revision
  - 需要补强源码同步 gate，避免“build 的不是预期 revision”
  - 仍然依赖远端 Docker build 速度

### Option C — 远端 build 但仍 save tar 作为中间产物

- 优点:
  - 比本地 `scp` 大 tar 更快
  - 改动比方案 B 稍小
- 缺点:
  - 仍保留多余的 tar I/O
  - 没有必要；远端已经本机 build，直接 `docker save | ctr import -` 更短
  - 只解决传输问题，不解决 deploy 类型混杂问题

## Recommended Design

采用 Option B。

近期 canonical path 定为：
- 远端同步目标 revision 源码
- 远端本机 `docker build`
- 远端本机 `docker save | ctr --address <rke2-sock> -n k8s.io images import -`
- 通过精确 target rollout 完成部署

同时把远端 deploy 明确拆成两类：

### 1. Full Deploy

用途：
- 基础设施/manifest/bootstrap 变化
- 首次环境部署
- secret/bootstrap contract 变化

职责：
- 强制 preflight
- 需要时确保 namespace / synapse / room / token / secrets
- apply `k8s/cloud/*.yaml`
- build 所需镜像
- rollout 对应 deployment
- 跑全量 source gate 与关键运行验证

非目标：
- 不作为所有前端热修的默认入口

### 2. App Fast Deploy

用途：
- `ui-server`
- `mbr-worker`
- `remote-worker`
  等单组件代码迭代

职责：
- 强制 preflight
- 仅同步目标 revision 源码
- 仅 build 指定镜像
- 仅 rollout 指定 deployment
- 仅跑目标组件 source gate 和目标 E2E/contract 验证

非目标：
- 不重建 synapse
- 不重建 room/token
- 不重写无关 secrets
- 不顺带 restart 其他 deployment

## Key Design Decisions

### A. 发布源定义

在没有 registry 的阶段，发布源定义为：
- 目标 git revision 的源码目录
- 由该 revision 在远端本机 build 出的镜像

不再把“本地导出的 tar 包”视为 canonical source。

### B. 远端源码同步

优先顺序：
1. `git fetch --all --tags` + `git checkout <revision>`
2. 若远端 repo 非干净 git 工作树或缺历史，再退化到定向 `rsync/scp`

要求：
- 部署脚本必须打印最终 build 的 revision
- source hash gate 必须以该 revision 的本地文件哈希为基准

### C. Image import

远端 canonical import 改为：
- `docker save <image> | ctr --address "$CONTAINERD_SOCK" -n k8s.io images import -`

保留 tar import 仅作 fallback：
- `--image-tar` 不再是主路径
- 只在明确需要离线/跨主机构件时使用

### D. Build cache policy

默认应允许 Docker layer cache。

规则：
- 日常 `app fast deploy` 不默认 `--no-cache`
- 仅在显式参数例如 `--rebuild` / `--no-cache` 时强制无缓存重建

这样才能真正改善高频前端迭代发布时延。

### E. Deploy target granularity

建议目标集：
- `ui-server`
- `mbr-worker`
- `remote-worker`

规则：
- 改 `ui-server` 只 rollout `deployment/ui-server`
- 改 `mbr-worker` 只 rollout `deployment/mbr-worker`
- 改 `remote-worker` 只 rollout `deployment/remote-worker`

只有 `full deploy` 才允许一次触发多个 deployment。

## Proposed Script Layout

保守演进，不一次性大改所有现有脚本名：

- 继续保留：
  - `scripts/ops/remote_preflight_guard.sh`
- 重构或拆分为：
  - `scripts/ops/deploy_cloud_full.sh`
  - `scripts/ops/deploy_cloud_app.sh`
  - `scripts/ops/sync_cloud_source.sh`
- 过渡期保留但降级为 wrapper/fallback：
  - `scripts/ops/deploy_cloud.sh`
  - `scripts/ops/deploy_cloud_ui_server_from_local.sh`

建议行为：
- `deploy_cloud.sh`
  - 变成 thin wrapper
  - 默认提示用户使用 `deploy_cloud_full.sh` 或 `deploy_cloud_app.sh`
- `deploy_cloud_ui_server_from_local.sh`
  - 不再作为推荐入口
  - 仅保留在“远端无法 build”或特殊离线情况下

## Verification Strategy

### Design-time gates

- docs audit PASS
- iteration registry / plan / resolution / runlog 完整

### Future implementation gates

#### Full Deploy
- `remote_preflight_guard.sh` PASS
- build revision printed and recorded
- source hash gate PASS
- rollout target pods all Ready
- 关键 E2E PASS，例如：
  - `verify_model100_submit_roundtrip.sh --base-url https://app.dongyudigital.com`

#### App Fast Deploy
- `remote_preflight_guard.sh` PASS
- target revision / target deployment / target image 显式打印
- target component source hash gate PASS
- 只检查目标 deployment rollout
- 只跑目标组件对应的最小验收：
  - `ui-server`：workspace/browser or model100 submit roundtrip
  - `mbr-worker`：MBR bridge contract / route gate
  - `remote-worker`：对应 worker roundtrip or contract

## Rollback Design

### Full Deploy rollback

- 重新 checkout 上一个已知稳定 revision
- 重新执行 `deploy_cloud_full.sh --revision <last_good_rev>`

### App Fast Deploy rollback

- 对目标组件执行：
  - checkout 上一个已知稳定 revision
  - build 旧 revision 镜像
  - 只 rollout 该目标 deployment

关键原则：
- rollback 也必须经过 preflight
- rollback 不得通过直接碰 `k3s`/`systemctl`/`/etc/rancher`

## Risks

1. 远端 repo revision 漂移
- 风险：
  - build 的源码不是预期 revision
- 缓解：
  - 在 deploy 前后打印 `git rev-parse --short HEAD`
  - 继续保留 source hash gate

2. 过度拆分导致用户误选 deploy 类型
- 风险：
  - 需要 full deploy 的改动误走 app fast deploy
- 缓解：
  - 在文档和脚本里明确列出触发条件
  - 对 manifest/secret/bootstrap 相关变更添加显式拒绝或警告

3. 远端 cache 带来旧构建残留
- 风险：
  - Docker cache 误命中
- 缓解：
  - 保留 `--rebuild/--no-cache`
  - source hash gate 兜底

## Non-goals

- 本轮不接入私有镜像仓库
- 本轮不重写整套 CI/CD
- 本轮不改变 `rke2` 集群结构
- 本轮不把 deploy 优化和产品功能修复混在同一 iteration 里

## Next Step

按 `0183-cloud-deploy-remote-build-split` 的 resolution 进入实现：
- 先改脚本分层与入口
- 再补 contract tests
- 最后用一次真实远端 `ui-server` fast deploy 和一次 full deploy 做验收
