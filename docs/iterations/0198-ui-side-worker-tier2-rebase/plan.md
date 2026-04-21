---
title: "Iteration 0198-ui-side-worker-tier2-rebase Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0198-ui-side-worker-tier2-rebase
id: 0198-ui-side-worker-tier2-rebase
phase: phase1
---

# Iteration 0198-ui-side-worker-tier2-rebase Plan

## Goal

- 将测试用 UI-side worker 从手工 `createModel/addFunction/addLabel` 脚本，重构为 patch-first 的独立软件工人角色，并补齐后续可部署的入口资产。

## Background

- `0195` 审计确认：
  - 测试用 UI-side worker 当前只有 [run_worker_ui_side_v0.mjs](/Users/drop/codebase/cowork/dongyuapp_elysia_based/scripts/run_worker_ui_side_v0.mjs)
  - 该脚本仍使用：
    - `WorkerEngineV0`
    - 手工 `createModel`
    - 手工 `addFunction`
    - 手工 `setLabel`
  - 当前没有对应的 patch 目录，也没有独立部署入口
- `0196` 和 `0197` 已分别确认：
  - MBR、remote worker 都可以在保留最小 runner/host glue 的前提下，把主要行为下沉到 patch
  - `0198` 当前阶段应继续保持为独立角色，不先并入 UI-server host
- 因此本轮不再讨论“是否并入 UI-server”，而是直接按独立 worker 角色推进。

## Scope

- In scope:
  - 为 UI-side worker 建立正式 patch 目录
  - 把脚本中的手工模型/函数/标签初始化迁入 patch
  - 重构 `run_worker_ui_side_v0.mjs` 使其只保留最小 host glue
  - 建立该角色的部署入口资产：
    - 至少包含镜像入口或 manifest 方案
  - 更新/补齐 UI-side worker 合同测试
- Out of scope:
  - 不做本地浏览器验收
  - 不做远端浏览器验收
  - 不把该角色并入 UI-server host
  - 不处理 MBR / remote worker 已完成的路径

## Invariants / Constraints

- 必须遵守 repo root `CLAUDE`：
  - fill-table-first
  - two-tier boundary
  - fail fast on non-conformance
- 本轮默认保持 UI-side worker 为独立角色。
- 除最小 host glue 外，不得继续在脚本里保留业务模型/函数/状态的手工初始化。
- 部署入口资产可以在本轮建立，但不在本轮执行真实部署验证。

## Success Criteria

- UI-side worker 拥有正式 patch 目录，并承载其业务模型/函数/状态。
- `run_worker_ui_side_v0.mjs` 不再手工：
  - `createModel`
  - `addFunction`
  - `setLabel`
- UI-side worker 的最小 host glue 边界被明确记录。
- 该角色至少具备可供 `0199/0200` 使用的部署入口资产。
- 相关 UI-side worker 合同测试通过。
- runlog 中明确记录：
  - 为什么该角色继续保持独立
  - 哪些 glue 仍保留在 host 层

## Risks & Mitigations

- Risk:
  - 把 UI-side worker 的 HTTP/debug surface 一并删掉，导致后续无法做验证。
  - Mitigation:
    - 仅迁业务初始化，不先删除验证辅助 surface。
- Risk:
  - 建了 patch 目录但没补部署入口，导致 `0199/0200` 无法接手。
  - Mitigation:
    - 把部署入口资产写进 Success Criteria。
- Risk:
  - 继续把业务逻辑留在脚本里，形成“假 patch-first”。
  - Mitigation:
    - 以 `createModel/addFunction/setLabel` 的删除作为硬验收。

## Alternatives

### A. 推荐：保持独立角色，patch-first 重构并补部署入口

- 优点：
  - 与 `0195/0196/0197` 的阶段性决策一致
  - 后续 `0199/0200` 有明确独立对象可验证
- 缺点：
  - 需要同时处理脚本、patch、部署入口三层

### B. 直接并入 UI-server host

- 优点：
  - 看起来少一个角色
- 缺点：
  - 会把 host 与 worker 边界重新混在一起
  - 与当前阶段性决策冲突
  - 不推荐

当前推荐：A。

## Inputs

- Created at: 2026-03-19
- Iteration ID: 0198-ui-side-worker-tier2-rebase
- Trigger:
  - `0195` / `0196` / `0197` 已连续确认 `0198` 继续保持独立角色
  - 用户要求按既定拆分继续推进
