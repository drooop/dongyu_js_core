---
title: "0288 — slide-ui-phaseA-topology-freeze Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-05
source: ai
iteration_id: 0288-slide-ui-phaseA-topology-freeze
id: 0288-slide-ui-phaseA-topology-freeze
phase: phase1
---

# 0288 — slide-ui-phaseA-topology-freeze Plan

## 0. Metadata

- ID: `0288-slide-ui-phaseA-topology-freeze`
- Date: `2026-04-05`
- Owner: AI-assisted planning
- Branch: `dev_0288-slide-ui-phaseA-topology-freeze`
- Planning mode: `refine`
- Depends on:
  - [[docs/iterations/0287-slide-ui-mainline-split/plan]]
  - [[docs/iterations/0214-sliding-flow-ui/plan]]
  - [[docs/user-guide/dual_worker_slide_e2e_v0]]
  - [[docs/plans/2026-04-03-slide-matrix-three-current-baseline]]

## 1. Goal

- 作为 `Slide UI` 主线的 Phase A，先冻结双工人拓扑与权属边界：
  - `ui-server`
  - `remote-worker`
  - `MBR`
- 用 `Model 100` 作为当前正式锚点，明确：
  - 哪一层承载 app host
  - 哪一层提供远端 UI truth
  - 哪一层执行业务
  - 哪一层只负责总线中转
- 本阶段完成态不是“支持更多 slide app”，而是：
  - 先把双工人 Slide UI 的权责分工、数据所有权和链路边界正式写死。

## 2. Background

- `0214` 已把 `sliding flow shell` 作为 Workspace 下的正式 UI 壳收口完成，但稳定锚点仍主要是 `Model 100`。
- [[docs/user-guide/dual_worker_slide_e2e_v0]] 已说明最小双工人链路闭环：
  - `UI-side -> MgmtBus(Matrix) -> MBR -> MQTT -> Remote worker -> MQTT -> MBR -> MgmtBus -> UI-side`
- 用户已明确当前示例的理解：
  - `ui-server` 对应 `dongyu app`
  - `remote-worker` 既是远端 UI 提供者，也是业务执行者
  - `MBR` 是双方双总线的中转站
- `0287` 已把 `Slide UI` 主线拆成 4 段，其中 Phase A 就是先解决这个拓扑与权属问题。

## 3. Problem Statement

- 如果先不冻结双工人拓扑，后面很容易出现这几类混乱：
  1. 把 `ui-server` 的 app host 和 `remote-worker` 的远端 UI truth 混成一层
  2. 把 `remote-worker` 只理解成业务执行者，而忽略它也是远端 UI 提供者
  3. 把 `MBR` 误写成业务真值层，而不是纯中转层
  4. 在还没固定权属前，就去做 Workspace 通用化或用户填表创建，最后又得回头返工
- 所以 Phase A 的重点不是“新增功能”，而是“先把谁拥有什么、谁只能中转什么”写清楚。

## 4. Scope

### 4.1 In Scope

- 冻结当前双工人 Slide UI 的角色分工：
  - `ui-server`
  - `remote-worker`
  - `MBR`
- 冻结 `Model 100` 作为当前正式合同锚点的原因与边界。
- 定义至少以下几类 truth 的归属：
  - app host / Workspace 可见入口
  - 远端 UI truth
  - 业务执行结果 truth
  - bus transport / relay state
- 冻结当前非加密链路中，哪些消息只允许作为 transport，哪些变化会 materialize 成产品层 truth。
- 给出 Phase B 之前必须保持不动的边界。

### 4.2 Out of Scope

- 不做 Workspace slide app 主线通用化。
- 不做用户填表创建 slide app。
- 不做 Gallery / 文档 / 取证收口。
- 不重新设计 Matrix 用户产品线。
- 不改变当前已冻结的 `0214` shell 行为。

## 5. Invariants / Constraints

### 5.1 `Model 100` 是当前正式锚点

- 在进入更通用的 Slide UI 主线之前，`Model 100` 仍是当前最稳定、已闭环、可审计的双工人锚点。
- Phase A 不试图把所有 slide app 一起拉进来，只先围绕这一个锚点写清楚规则。

### 5.2 角色分层必须明确

- `ui-server`
  - 当前应被视为 app host / Workspace 投影承载层
- `remote-worker`
  - 当前应同时承担：
    - 远端 UI 提供者
    - 实际业务执行者
- `MBR`
  - 当前只承担总线中转与桥接
  - 不应被提升为业务真值层

### 5.3 权属边界必须明确

- 需要明确哪些 truth 属于：
  - positive app model
  - remote worker side truth
  - system relay / bridge state
- 不允许把 transport 中间态误认成产品真值。
- 不允许把 `MBR` 的桥接状态误认成 app business truth。

### 5.4 当前阶段不做通用化

- 这一阶段只回答“当前双工人 Slide UI 是怎么成立的”。
- 不回答“以后多个 slide app 如何统一接入”，那是 Phase B 的范围。

## 6. Success Criteria

- Phase A 计划完成后，必须至少冻结这些内容：
  1. `ui-server / remote-worker / MBR` 的正式角色分工
  2. `Model 100` 作为锚点的正式地位
  3. app host / 远端 UI truth / 业务执行 truth / transport state 的权属划分
  4. 当前双工人链路里哪些消息只是中转，哪些变化才是产品层 truth
  5. 为什么在此之前不能先做 Workspace 通用化或用户填表创建

## 7. Inputs

- Created at: `2026-04-05`
- Iteration ID: `0288-slide-ui-phaseA-topology-freeze`
- Primary baselines:
  - [[docs/iterations/0287-slide-ui-mainline-split/plan]]
  - [[docs/iterations/0214-sliding-flow-ui/plan]]
  - [[docs/user-guide/dual_worker_slide_e2e_v0]]
  - [[docs/plans/2026-04-03-slide-matrix-three-current-baseline]]
