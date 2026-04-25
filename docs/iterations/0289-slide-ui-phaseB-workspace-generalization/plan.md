---
title: "0289 — slide-ui-phaseB-workspace-generalization Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0289-slide-ui-phaseB-workspace-generalization
id: 0289-slide-ui-phaseB-workspace-generalization
phase: phase1
---

# 0289 — slide-ui-phaseB-workspace-generalization Plan

## 0. Metadata

- ID: `0289-slide-ui-phaseB-workspace-generalization`
- Date: `2026-04-06`
- Owner: AI-assisted planning
- Branch: `dev_0289-slide-ui-phaseB-workspace-generalization`
- Planning mode: `refine`
- Depends on:
  - [[docs/iterations/0287-slide-ui-mainline-split/plan]]
  - [[docs/iterations/0288-slide-ui-phaseA-topology-freeze/plan]]
  - [[docs/iterations/0214-sliding-flow-ui/plan]]
  - [[docs/roadmaps/sliding-ui-workspace-plan]]

## 1. Goal

- 作为 `Slide UI` 主线的 Phase B，把当前主要围绕 `Model 100` 成立的单点 Slide UI 壳，推广成 Workspace 中多个 slide-capable app 的通用主线。
- 本阶段的完成态不是“用户已经能自己创建 slide app”，而是：
  - Workspace 对 slide-capable app 有正式、统一、可扩展的接入方式；
  - `registry / metadata / mount / unmount / selection / lifecycle` 边界清晰；
  - 不再依赖单一 `Model 100` 作为唯一成立场景。

## 2. Background

- `0288` 已冻结：
  - `ui-server / remote-worker / MBR` 的双工人拓扑与权属边界
  - `Model 100` 作为当前锚点的正式地位
- `0214` 当前完成态仍然主要围绕：
  - selected app projection
  - `Model 100` process/debug shell
- 旧 roadmap 已提过应用元数据方向：
  - `app_name`
  - `app_icon`
  - `source_worker`
  - `source_model_id`
  - `installed_at`
  - `deletable`
- 现在的下一步，不是马上开放用户创建，而是先把系统已有和未来可扩展 slide app 的接入合同统一。

## 3. Problem Statement

- 如果不先做 Workspace 主线通用化，后续很容易出现 3 类问题：
  1. 继续让 `Model 100` 承担“唯一 slide-capable app”角色，导致后续每加一个 app 都得临时特判
  2. 用户创建阶段还没开始，就已经缺少正式的 slide app metadata / mount / lifecycle 合同
  3. Gallery、文档、远端取证阶段无法基于统一的 slide app 主线来复用验证资产
- 所以 Phase B 的重点是先回答：
  - 什么 app 算 slide-capable
  - 它如何被 Workspace 发现和承载
  - 它有哪些最小 metadata
  - selection / mount / lifecycle 如何统一

## 4. Scope

### 4.1 In Scope

- 定义 `slide-capable app` 的正式准入条件。
- 冻结 Workspace 中 slide app 的统一 metadata 最小集。
- 冻结 Workspace registry 中 slide app 的发现、排序、选择、挂载和卸载边界。
- 规划从单点 `Model 100` 到多 slide-capable app 的主线过渡方式。
- 规划 Phase B 的最小验证矩阵：
  - 至少两个 slide-capable app 被统一识别
  - 切换 selected app 后 shell 逻辑仍成立
  - mount / selection / lifecycle 不靠单点特判

### 4.2 Out of Scope

- 不开放用户自己创建 slide app。
- 不定义用户填表创建流程。
- 不做 Gallery 收口。
- 不做使用文档收口。
- 不改变 `0288` 已冻结的双工人权属边界。

## 5. Invariants / Constraints

### 5.1 与 Phase A 的关系

- Phase B 必须继承 `0288` 的拓扑与权属判断。
- 不能为了做通用化而重写：
  - `ui-server` / `remote-worker` / `MBR` 的角色关系
  - `Model 100` 作为当前锚点的事实

### 5.2 Slide-capable app 准入条件必须显式化

- 第二阶段必须至少回答：
  - 什么 metadata / contract 才能让一个 app 进入 Slide UI 主线
  - 哪些 app 只是 Workspace app，但不进入 Slide UI 主线
- 不允许继续用“看起来像流程页”这种模糊口径判断。

### 5.3 Workspace 元数据最小集必须冻结

- 推荐最小集至少包括：
  - `app_name`
  - `app_icon`
  - `source_worker`
  - `source_model_id`
  - `installed_at`
  - `deletable`
  - `slide_capable`
  - `slide_surface_type`
- 可以调整字段名，但必须冻结一套正式口径。

### 5.4 mount / selection / lifecycle 不能再围绕单点特判

- Phase B 必须把下面这些行为变成正式主线，而不是继续靠 `Model 100` 特判：
  - app registry discover
  - current app select
  - mount / unmount policy
  - lifecycle summary projection

### 5.5 当前阶段不做用户创建

- Phase B 只做“系统主线通用化”。
- 用户通过填表自己创建 slide app，必须留到 Phase C。

## 6. Success Criteria

- Phase B 计划完成后，必须至少冻结这些内容：
  1. slide-capable app 的准入条件
  2. Workspace slide app 的 metadata 最小集
  3. registry / mount / selection / lifecycle 的统一边界
  4. 至少从“单点 `Model 100`”走向“多 app 主线”的过渡方案
  5. 为什么这一阶段仍然不开放用户创建

## 7. Inputs

- Created at: `2026-04-06`
- Iteration ID: `0289-slide-ui-phaseB-workspace-generalization`
- Primary baselines:
  - [[docs/iterations/0287-slide-ui-mainline-split/plan]]
  - [[docs/iterations/0288-slide-ui-phaseA-topology-freeze/plan]]
  - [[docs/iterations/0214-sliding-flow-ui/plan]]
  - [[docs/roadmaps/sliding-ui-workspace-plan]]
