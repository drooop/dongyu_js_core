---
title: "0287 — slide-ui-mainline-split Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-05
source: ai
iteration_id: 0287-slide-ui-mainline-split
id: 0287-slide-ui-mainline-split
phase: phase1
---

# 0287 — slide-ui-mainline-split Plan

## 0. Metadata

- ID: `0287-slide-ui-mainline-split`
- Date: `2026-04-05`
- Owner: AI-assisted planning
- Branch: `dev_0287-slide-ui-mainline-split`
- Planning mode: `refine`
- Depends on:
  - [[docs/plans/2026-04-03-slide-matrix-three-current-baseline]]
  - [[docs/roadmaps/sliding-ui-workspace-plan]]
  - [[docs/iterations/0214-sliding-flow-ui/plan]]
  - [[docs/user-guide/dual_worker_slide_e2e_v0]]

## 1. Goal

- 在 `0214` 和现有基线之上，正式拆分 `Slide UI` 主线的后续阶段顺序。
- 让后续执行不再围绕“Slide UI 到底先做哪一段”反复讨论，而是按清晰阶段推进。
- 本 iteration 的完成态不是实现某个 Slide UI 功能，而是：
  - 冻结 `Slide UI` 主线的阶段拆分、依赖关系和每阶段的完成态。

## 2. Background

- 基线文档已经明确：
  - `Slide UI` 不是空白概念；
  - 当前正式起点是 `0214`；
  - 当前稳定锚点仍是 `Model 100` 和相关 process/debug 投影。
- 旧 roadmap 里更偏“Workspace 从静态 AST 迁到 schema 驱动”的路线，
  但现在的新问题已经更偏向：
  - 双工人拓扑
  - 远端 worker 提供 UI 与执行业务的关系
  - Workspace 中多 slide app 的组织方式
  - 用户能否通过填表创建和挂载 slide app
- 用户已经明确：
  - 这条线排在 Matrix 非加密之后、Three.js 之前
  - 当前测试示例里：
    - `ui-server` 对应 `dongyu app`
    - `remote-worker` 既是远端 UI 提供者，也是业务执行者
    - `MBR` 是双方的双总线中转站

## 3. Problem Statement

- 如果不先把 `Slide UI` 主线拆清楚，后面执行很容易出现 3 类混乱：
  1. 把 `0214` 当前 shell 能力误当成“Slide UI 已经完整”
  2. 把“远端 UI 提供者”和“Workspace 容器组织方式”混在一个 iteration 里一起做，范围失控
  3. 把“用户填表创建 slide app”与“系统先把双工人拓扑冻结”倒置，导致后面反复返工
- 所以后续必须先区分：
  - 什么是拓扑/权属问题
  - 什么是 Workspace 主线通用化问题
  - 什么是面向用户的填表化创建问题
  - 什么是 Gallery / 文档 / 取证问题

## 4. Mainline Split

### 4.1 Phase A — 双工人拓扑与权属冻结

- 目标：
  - 正式冻结 `ui-server / remote-worker / MBR` 三者在 Slide UI 主线中的角色关系
  - 明确：
    - 哪一层拥有 app host
    - 哪一层提供远端 UI truth
    - 哪一层执行业务
    - 哪一层只做中转
- 本阶段完成态：
  - `Model 100` 不再只是单点案例，而成为 Slide UI 双工人拓扑的正式合同锚点
  - 远端 UI 与业务执行共存时的权属边界明确

### 4.2 Phase B — Workspace Slide App 主线通用化

- 目标：
  - 把 `0214` 当前以 `Model 100` 为主的 flow shell / selected app 逻辑，推广成可容纳多个 slide app 的主线模式
  - 明确 slide-capable app 的 registry、metadata、mount / unmount / selection / lifecycle
- 本阶段完成态：
  - Workspace 不再只是在 `Model 100` 上成立 Slide UI 主线
  - slide app 有正式的通用接入方式

### 4.3 Phase C — 填表化 Slide App 创建与挂载

- 目标：
  - 让用户可以通过填表方式定义 slide app、挂载到 Workspace、并接入正式数据链路
- 本阶段完成态：
  - Slide UI 不再只是一组系统预置 app
  - 用户可通过模型表逐步构建并挂载 slide app
- 重点：
  - 这一步应建立在前两阶段已经冻结拓扑与 Workspace 主线之后
  - 不能反过来先做“用户创建”，再回头修系统合同

### 4.4 Phase D — Gallery / 文档 / 取证收口

- 目标：
  - 把 Slide UI 的正式能力沉淀到：
    - Gallery
    - 使用说明文档
    - 浏览器/远端取证
- 本阶段完成态：
  - Slide UI 不只是功能存在
  - 它有可展示、可学习、可回归验证的正式资产

## 5. Invariants / Constraints

### 5.1 与当前基线的关系

- 不能推翻 `0214` 既有完成态。
- 后续任何 Slide UI 扩展都必须站在 `0214` 的正式完成态上继续做。

### 5.2 UI 模型主线约束

- Slide UI 后续若扩展新的 UI 能力：
  - 必须合法沉淀
  - 必须评估进入 Gallery
  - 必须评估补 UI 模型使用文档
- 不允许为 Slide UI 单独恢复历史特判路径。

### 5.3 顺序约束

- 不应先做 Phase C 再做 Phase A/B。
- 推荐顺序固定为：
  - Phase A
  - Phase B
  - Phase C
  - Phase D

## 6. Success Criteria

- `0287` 完成后，必须至少回答：
  1. Slide UI 后续主线分几段
  2. 每段解决什么问题
  3. 每段的依赖顺序是什么
  4. 为什么不能颠倒顺序
  5. 哪一段负责 Gallery / 文档 / 取证收口

## 7. Inputs

- Created at: `2026-04-05`
- Iteration ID: `0287-slide-ui-mainline-split`
- Primary baselines:
  - [[docs/plans/2026-04-03-slide-matrix-three-current-baseline]]
  - [[docs/roadmaps/sliding-ui-workspace-plan]]
  - [[docs/iterations/0214-sliding-flow-ui/plan]]
  - [[docs/user-guide/dual_worker_slide_e2e_v0]]
