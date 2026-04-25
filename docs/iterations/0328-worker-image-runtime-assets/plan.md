---
title: "0328 — worker-image-runtime-assets Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-22
source: ai
iteration_id: 0328-worker-image-runtime-assets
id: 0328-worker-image-runtime-assets
phase: phase1
---

# 0328 — worker-image-runtime-assets Plan

## Goal

- 修复当前本地重部署后的两层真实阻断：
  - `remote-worker` / `mbr-worker` / `ui-side-worker` 新 pod CrashLoop
  - 报错都指向 `packages/worker-base/system-models/default_table_programs.json` 未被带进镜像
  - 镜像回归修掉后，`remote-worker` 已能收 MQTT submit，但业务函数仍停留在旧 `ctx.writeLabel/getLabel` 语义，导致链路不收敛
- 在修复前先完成一项判断并留痕：
  - 近期规约变动后，`mbr-worker` / `remote-worker` 当前是否必须重填模型表
  - 当前证据结论：
    - `mbr-worker` 暂无必须重填模型表的硬证据
    - `remote-worker` 需要重填当前业务函数实现，使其从旧 `ctx.*` 语义迁到当前运行时可用的 `V1N` / `ctx.runtime.*`
- 修复后用本地重部署 + 真实浏览器再次确认

## Scope

- In scope:
  - `k8s/Dockerfile.remote-worker`
  - `k8s/Dockerfile.mbr-worker`
  - `k8s/Dockerfile.ui-side-worker`
  - `deploy/sys-v1ns/remote-worker/patches/10_model100.json`
  - `deploy/sys-v1ns/remote-worker/patches/11_model1010.json`
  - `deploy/sys-v1ns/remote-worker/patches/12_model1019.json`
  - 新增最小 contract test，锁定这些镜像必须包含 `packages/worker-base/system-models`
  - 新增或更新 remote-worker contract tests，锁定 root submit 业务函数在当前运行时语义下能真正推进状态与回传
  - 本地重部署与浏览器验证
  - 迭代文档记录“当前无需重填 `mbr`/`remote-worker` 模型表”的评估依据
- Out of scope:
  - 重写 `deploy/sys-v1ns/mbr/patches/**`
  - 业务语义变更

## Invariants / Constraints

- 先证明是否需要重填模型表，再动实现；不能直接假设
- `mbr-worker` 若无新证据，不重填模型表
- `remote-worker` 只改当前被证实失效的 root submit 业务函数，不顺手改协议或业务语义
- 本地部署验证必须基于当前代码重建后的 pod，不接受旧 pod / 旧镜像结果
- 浏览器验证必须基于本地部署环境，不接受 jsdom 近似验证替代

## Success Criteria

1. 有明确证据说明当前 `mbr-worker` 暂无必须重填模型表的阻断
2. 有明确 failing evidence 说明 `remote-worker` 当前业务函数仍停留在旧语义，并完成迁移
3. 新镜像启动时不再因为缺少 `default_table_programs.json` CrashLoop
4. `remote-worker` / `mbr-worker` / `ui-side-worker` 新 pod 都进入 Ready
5. `bash scripts/ops/check_runtime_baseline.sh` PASS
6. 真实浏览器访问本地 `http://127.0.0.1:30900/#/workspace`，关键交互能跑通且不再卡死在旧异常态

## Inputs

- Created at: 2026-04-22
- Iteration ID: `0328-worker-image-runtime-assets`
- Trigger:
  - 本地 `deploy_local.sh` 后新 pod CrashLoop
  - 报错：`default_table_programs.json` missing
  - 用户要求评估是否需要重填 `mbr` / `remote-worker` 模型表
