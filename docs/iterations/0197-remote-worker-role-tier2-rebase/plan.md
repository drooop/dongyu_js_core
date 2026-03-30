---
title: "Iteration 0197-remote-worker-role-tier2-rebase Plan"
doc_type: iteration-plan
status: planned
updated: 2026-03-21
source: ai
iteration_id: 0197-remote-worker-role-tier2-rebase
id: 0197-remote-worker-role-tier2-rebase
phase: phase1
---

# Iteration 0197-remote-worker-role-tier2-rebase Plan

## Goal

- 基于现有 `run_worker_remote_v1` minimal runner，重填 remote worker role patch，使其按新版规约收敛到真正的 Tier 2 路线。

## Background

- `0195` 已确认：
  - remote worker 的 runner 路径相对接近目标：
    - `k8s/Dockerfile.remote-worker`
    - `scripts/run_worker_remote_v1.mjs`
    - `deploy/sys-v1ns/remote-worker/patches/*.json`
  - 当前主要问题不在 runner，而在 role patch 本身仍保留旧语义：
    - `MQTT_WILDCARD_SUB`
    - root `ui_type`
    - `routing` / `wiring` 自定义 key
    - system model function 直写业务 root
- `0196` 已将 MBR runner 改为 triggerless 路线，并在 runlog 中记录：
  - `0198` 当前阶段仍应保持独立角色，不先并入 UI-server host
- 因此 `0197` 应优先利用 remote worker 已有的 minimal runner，把主要工作集中在 patch 重填。

## Scope

- In scope:
  - 审定 remote worker 的真实执行入口与 patch 路径
  - 重填 `deploy/sys-v1ns/remote-worker/patches/*`
  - 更新/补齐 remote worker 合同测试
  - 在 runlog 中补 `0198` 阶段性决策确认：
    - 继续保持 UI-side worker 独立角色
- Out of scope:
  - 不修改 MBR
  - 不实现 test UI-side worker
  - 不做本地/远端浏览器验收
  - 不做云端部署

## Invariants / Constraints

- 必须遵守 repo root `CLAUDE`：
  - fill-table-first
  - two-tier boundary
  - fail fast on non-conformance
- 优先不改 `scripts/run_worker_remote_v1.mjs`，除非审计证明其最小 runner 角色仍不够干净。
- 本轮应尽量把 remote role 的行为与路由都下沉到 patch，而不是增加新 host glue。
- 必须在本轮结束前再次确认 `0198` 独立角色决策，不得拖到 `0198` 再讨论。

## Success Criteria

- remote worker 真实部署入口已被确认，并与实施对象一致。
- remote role patch 去除旧语义的核心依赖：
  - `MQTT_WILDCARD_SUB`
  - root `ui_type`
  - `routing` / `wiring` 这类非正式结构 key
- remote worker 的业务行为与 routing 以新版 `model_type / pin.* / pin.connect.* / func.js` 路线表达。
- 相关 remote worker 合同测试通过。
- runlog 中明确记录：
  - runner 还保留了哪些最小 host glue
  - 为什么这些部分暂时不下沉
  - `0198` 继续保持独立角色的阶段性确认

## Risks & Mitigations

- Risk:
  - 误把 runner 当成主问题，导致在 `run_worker_remote_v1` 上做了不必要改动。
  - Mitigation:
    - 先审计现有 runner，默认把主要工作放在 patch。
- Risk:
  - 直接重写 `Model 100` 但破坏现有 submit roundtrip 行为。
  - Mitigation:
    - 用现有 remote worker 合同测试做基线和回归。
- Risk:
  - `0198` 角色边界仍不清，导致后续 UI-side 迭代范围膨胀。
  - Mitigation:
    - 在本轮 runlog 再次固化独立角色判断。

## Alternatives

### A. 推荐：保持 runner 基本不动，重点重填 remote role patch

- 优点：
  - 更符合 `0195` 审计结论
  - 变更面集中
  - 更利于后续 `0199/0200` 验证
- 缺点：
  - 需要系统性重写 patch 内容

### B. 先重写 `run_worker_remote_v1`

- 优点：
  - 入口看起来更统一
- 缺点：
  - 可能偏离真实主要问题
  - 不推荐

当前推荐：A。

## Inputs

- Created at: 2026-03-19
- Iteration ID: 0197-remote-worker-role-tier2-rebase
- Trigger:
  - 用户在 `0196` 收口后继续推进下一步
  - `0195` / `0196` 已明确 remote role patch 是当前主差距
