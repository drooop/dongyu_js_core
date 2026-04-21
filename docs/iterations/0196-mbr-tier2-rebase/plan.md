---
title: "Iteration 0196-mbr-tier2-rebase Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0196-mbr-tier2-rebase
id: 0196-mbr-tier2-rebase
phase: phase1
---

# Iteration 0196-mbr-tier2-rebase Plan

## Goal

- 将当前 MBR 角色从旧的 generic worker + legacy patch 组合，重构为符合新版规约的 Tier 2 实现路线。

## Background

- `0195` 已确认：
  - MBR 在 K8s 中真正运行的不是 deprecated 的 `run_worker_mbr_v0`
  - 真实路径是：
    - `k8s/Dockerfile.mbr-worker`
    - `scripts/run_worker_v0.mjs`
    - `deploy/sys-v1ns/mbr/patches/mbr_role_v0.json`
- 当前差距集中在两层：
  - runner 仍依赖 `WorkerEngineV0` / 手工 Matrix+MQTT glue
  - role patch 仍使用旧标签与旧桥接模式
- `0199/0200` 的浏览器验收依赖 MBR 路径先完成规约对齐，因此 `0196` 必须先把 MBR 的边界和落点收干净。

## Scope

- In scope:
  - 审定并重构 MBR 的真实执行入口与 role patch 路径
  - 重填 MBR role patch，使其尽量把业务能力下沉到 Tier 2
  - 明确 MBR 仍保留在 host glue 的最小部分
  - 更新/补齐 MBR 合同测试
  - 在 runlog 中补一条针对 `0198` 的前置决策结论：
    - 当前证据是否支持“UI-side worker 保留独立角色”
- Out of scope:
  - 不处理 remote worker role
  - 不处理 test UI-side worker 的实现
  - 不做本地/远端浏览器验收
  - 不做云端部署

## Invariants / Constraints

- 必须遵守 repo root `CLAUDE`：
  - fill-table-first
  - two-tier boundary
  - fail fast on non-conformance
- 不得去改 deprecated 的 `scripts/run_worker_mbr_v0.mjs` 作为主实施对象。
- 必须以当前真实部署入口为准：
  - `scripts/run_worker_v0.mjs`
  - `deploy/sys-v1ns/mbr/patches/mbr_role_v0.json`
- 浏览器验收不在本轮；本轮只做到合同测试与规约对齐。
- 必须在本轮或 `0197` 结束前固化一条 0198 前置决策：
  - UI-side worker 独立保留，还是并入 UI-server host。

## Success Criteria

- MBR rebase 只围绕真实部署入口展开，而不是 deprecated 脚本。
- 形成新的或重写后的 MBR role patch 方案，并去掉旧桥接语义的核心依赖。
- MBR 的业务逻辑与 routing 拆分为：
  - 仍属于 host glue 的最小部分
  - 下沉到 Tier 2 patch 的部分
- 相关 MBR 合同测试通过。
- runlog 中明确记录：
  - MBR runner 还保留了哪些 host glue
  - 为什么这些内容暂时不能继续下沉
  - `0198` 是否应保持独立角色的阶段性判断

## Risks & Mitigations

- Risk:
  - 去改错入口，重写 deprecated 脚本，实际部署路径却没变。
  - Mitigation:
    - 在 Step 1 先锁定真实入口，并把 deprecated 路径显式排除。
- Risk:
  - 把所有 MQTT/Matrix/bridge glue 都强行下沉，结果碰到真实 host boundary。
  - Mitigation:
    - 本轮必须区分 host glue 与 Tier 2 patch，不做伪去重。
- Risk:
  - 0198 的独立角色决策拖到太晚，导致 0198 范围膨胀。
  - Mitigation:
    - 在 0196/0197 结束前就把该决策冻结到 runlog / plan 中。

## Alternatives

### A. 推荐：以真实部署入口为对象做 MBR rebase

- 优点：
  - 后续 `0199/0200` 可以直接基于真实部署路径验证
  - 不会把 effort 浪费在 deprecated 脚本上
- 缺点：
  - 需要同时处理 runner 与 patch 的边界问题

### B. 先重写 `run_worker_mbr_v0`

- 优点：
  - 入口看起来更直观
- 缺点：
  - 与真实 K8s 部署路径脱节
  - 很可能做成无效工作
  - 不可取

当前推荐：A。

## Inputs

- Created at: 2026-03-19
- Iteration ID: 0196-mbr-tier2-rebase
- Trigger:
  - 用户确认 `0195` 审计通过后，直接开启 `0196`
  - 用户要求把 `0198` 的独立/并入决策提前到 `0196/0197` 阶段固化
