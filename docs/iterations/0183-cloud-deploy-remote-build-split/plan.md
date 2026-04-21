---
title: "Iteration 0183-cloud-deploy-remote-build-split Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0183-cloud-deploy-remote-build-split
id: 0183-cloud-deploy-remote-build-split
phase: phase1
---

# Iteration 0183-cloud-deploy-remote-build-split Plan

## Goal

把当前 cloud deploy 从 `local docker save + scp tar + remote ctr import` 主路径，迁移为“远端同步源码后直接 remote build，再导入 rke2 containerd”的主路径，并显式拆分 `full` 与 `app` 两类部署命令。

## Scope

- In scope:
  - 定义远端 remote build 作为无 registry 前提下的 canonical cloud deploy 路径
  - 明确 `full deploy` 与 `app fast deploy` 的职责边界、触发条件、验证口径和回滚方式
  - 规划远端源码同步、source hash gate、目标 deployment rollout 的实现方式
  - 更新 ops 文档入口，避免后续继续默认使用 `scp` 大 tar 主路径
- Out of scope:
  - 不引入新的镜像仓库
  - 不修改产品 runtime / UI / worker 业务语义
  - 不改变 `rke2` / `kubectl` / `ctr` 的安全边界
  - 不在本 iteration 中处理 k8s 基础设施之外的主机级系统配置

## Invariants / Constraints

- 远端目标仍是 `124.71.43.80` 的 `rke2` 集群，严禁触碰 `k3s`、`systemctl`、`/etc/rancher`、防火墙和 CNI。
- `remote_preflight_guard.sh` 必须继续作为所有远端 deploy 的强制前置 gate。
- 在没有私有镜像仓库的前提下，发布源只能是：
  - 目标 revision 的源码目录
  - 由该源码在远端 build 出的目标镜像
- 必须保留现有 source integrity 思路，避免“rollout 成功但实际仍是旧 bundle/旧 server 代码”。
- deploy 拆分后，`app fast deploy` 不得顺带重跑 Synapse 初始化、room/token 建立、全量 secret 更新等基础设施步骤。
- 文档必须明确：
  - 哪些文件变化只需要 `app fast deploy`
  - 哪些变化必须走 `full deploy`
  - 当前保留的 tar 路径是否降级为 fallback，而不是主路径

## Success Criteria

- `0183` 的设计文档、plan、resolution、runlog 全部完成且无 `[TODO]`。
- 设计明确给出并比较至少 2 种方案，且收口到推荐方案：
  - remote build without registry
  - full/app split deploy
- resolution 中明确列出未来实施需要修改的脚本、验证命令和 rollback 口径。
- `docs/ITERATIONS.md` 已登记 `0183` 且状态为 `Approved`。
- `node scripts/ops/obsidian_docs_audit.mjs --root docs` PASS。

## Inputs

- Created at: 2026-03-11
- Iteration ID: 0183-cloud-deploy-remote-build-split
- Approval: user approved the remote-build + split-deploy direction in-session on 2026-03-11
