---
title: "Iteration 0200-remote-integrated-browser-validation Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0200-remote-integrated-browser-validation
id: 0200-remote-integrated-browser-validation
phase: phase1
---

# Iteration 0200-remote-integrated-browser-validation Plan

## Goal

- 在远端 `dy-cloud` / `rke2` 集群上完成 4 角色链路的集成部署与浏览器级验收：
  - `ui-server`
  - `mbr-worker`
  - `remote-worker`
  - `ui-side-worker`

## Background

- `0195` 已冻结远端验收 DoD：
  1. 合同测试 PASS
  2. 远端部署成功
  3. Playwright 测例 PASS
  4. 真实浏览器人工操作 PASS
  5. runlog 附访问地址、步骤、结果、截图/页面证据
- `0196/0197/0198` 已分别完成：
  - MBR triggerless Tier 2 rebase
  - remote worker role Tier 2 rebase
  - UI-side worker patch-first 重构与 cloud manifest 补齐
- `0199` 已完成本地 4 角色链路验证。
- 本轮前置核查又暴露了一个关键事实：
  - [deploy_cloud_full.sh](/Users/drop/codebase/cowork/dongyuapp_elysia_based/scripts/ops/deploy_cloud_full.sh#L365) 到 [deploy_cloud_full.sh](/Users/drop/codebase/cowork/dongyuapp_elysia_based/scripts/ops/deploy_cloud_full.sh#L424) 当前只 build/import/restart `ui-server / mbr-worker / remote-worker`
  - 虽然 [k8s/cloud/ui-side-worker.yaml](/Users/drop/codebase/cowork/dongyuapp_elysia_based/k8s/cloud/ui-side-worker.yaml) 已存在，但 cloud deploy 链尚未实际纳入 `ui-side-worker`
- 因此 `0200` 的真实目标不是“直接验证”，而是：
  - 先把远端部署链补齐到与 `0199` 本地链一致
  - 再做远端浏览器与证据验收
- 本轮执行中已确认 cloud canonical deploy SSH user 为 `drop`：
  - `drop` 具备 `sudo -n`
  - canonical remote repo 路径保持 `/home/wwpic/dongyuapp`
  - repo owner 为 `wwpic`
  - source sync 需通过 `drop + sudo -u wwpic` 代持写入

## Scope

- In scope:
  - 审计并补齐 cloud deploy 链，使其真正纳入 `ui-side-worker`
  - 使用 canonical 远端路径执行部署：
    - `scripts/ops/sync_cloud_source.sh`
    - `scripts/ops/deploy_cloud_full.sh`
    - 必要时 `scripts/ops/deploy_cloud_app.sh`
  - 远端执行脚本级 smoke / roundtrip
  - 远端执行 Playwright 浏览器测例
  - 远端执行人工浏览器复核，并记录截图/页面证据
  - 若 `ui-side-worker` 无公网入口，则允许使用 `kubectl port-forward` 作为浏览器访问桥接
- Out of scope:
  - 不新增业务功能
  - 不修改 worker 业务 patch 语义
  - 不做集群级危险操作
  - 不改变 `REMOTE_OPS_SAFETY` 白名单外的运维策略

## Invariants / Constraints

- 必须严格遵守 [[CLAUDE]] `REMOTE_OPS_SAFETY`：
  - 只允许：
    - `kubectl apply/delete/get/describe/logs/exec/port-forward`
    - `helm install/upgrade/uninstall`
    - `docker build/save/load`
    - `rsync/scp/git clone`
  - 禁止：
    - `systemctl` 触碰 `rke2/containerd/docker/sshd/networking`
    - `k3s` 相关操作
    - 防火墙/CNI/网络层变更
- 本轮必须使用真实远端链路，不允许用 mock 或本地替代远端结果。
- 若任一层失败，必须定位到具体层级：
  - source sync
  - image build/import
  - rollout
  - service reachability
  - browser interaction
- `0200` 不得跳过人工浏览器复核。

## Success Criteria

- 远端 cloud deploy 链成功纳入 `ui-side-worker`，与 `0199` 本地 4 角色链路对齐。
- 远端 `ui-server / mbr-worker / remote-worker / ui-side-worker` 均成功 rollout。
- 远端脚本级 smoke / roundtrip 通过。
- Playwright 远端测例通过。
- 人工浏览器完成至少 3 组动作并达到预期：
  - Model100 / remote worker / MBR submit roundtrip
  - Workspace 中角色/资产入口可见且可打开
  - UI-side worker flow 可观测到预期状态变化
- runlog 中完整记录：
  - 远端访问地址
  - 操作步骤
  - 结果
  - 截图或页面证据
  - 若使用 `port-forward`，需记录本地桥接端口与对应远端 service

## Risks & Mitigations

- Risk:
  - cloud deploy 链尚未纳入 `ui-side-worker`，直接执行会导致 `0200` 验收对象不完整。
  - Mitigation:
    - 本轮将“补齐 cloud deploy 链”明确纳入 Step 1，而不是假设它已存在。
- Risk:
  - 远端 UI 看起来可访问，但实际仍在跑旧 revision。
  - Mitigation:
    - 使用 `sync_cloud_source.sh` + source gate + rollout 后校验容器内源码/镜像 revision。
- Risk:
  - Playwright PASS，但人工浏览器因 ingress/token/port-forward 问题无法复现。
  - Mitigation:
    - 将人工浏览器复核列为硬性 DoD，并把入口地址/桥接方式写进 runlog。

## Alternatives

### A. 推荐：先补齐 cloud deploy 链，再做 5 层远端验收

- 优点：
  - 与 `0199` 保持同构
  - `0200` 的证据链完整，不会遗漏 `ui-side-worker`
- 缺点：
  - 本轮不只是验证，还要补少量 deploy 链接线

### B. 只验证 `ui-server / mbr-worker / remote-worker` 三角色，忽略 `ui-side-worker`

- 优点：
  - 工作量更小
- 缺点：
  - 与 `0195` 冻结的 4 角色目标不一致
  - 会把 `ui-side-worker` 的 cloud 断链继续留到后面

当前推荐：A。

## Inputs

- Created at: 2026-03-20
- Iteration ID: 0200-remote-integrated-browser-validation
- Trigger:
  - 用户已确认 `0199-ui-entry-card-cleanup` 完成
  - 用户要求先刷新本地集群到最新 `dev`，再正式写/执行 `0200`
  - 本地集群已刷新到最新 `dev`，最新 `ui_page_catalog_json` 已确认包含新 `nav_visible` 值
