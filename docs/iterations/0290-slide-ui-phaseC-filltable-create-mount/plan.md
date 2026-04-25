---
title: "0290 — slide-ui-phaseC-filltable-create-mount Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0290-slide-ui-phaseC-filltable-create-mount
id: 0290-slide-ui-phaseC-filltable-create-mount
phase: phase1
---

# 0290 — slide-ui-phaseC-filltable-create-mount Plan

## 0. Metadata

- ID: `0290-slide-ui-phaseC-filltable-create-mount`
- Date: `2026-04-06`
- Owner: AI-assisted planning
- Branch: `dev_0290-slide-ui-phaseC-filltable-create-mount`
- Planning mode: `refine`
- Depends on:
  - [[docs/iterations/0287-slide-ui-mainline-split/plan]]
  - [[docs/iterations/0288-slide-ui-phaseA-topology-freeze/plan]]
  - [[docs/iterations/0289-slide-ui-phaseB-workspace-generalization/plan]]
  - [[docs/user-guide/workspace_ui_filltable_example]]

## 1. Goal

- 作为 `Slide UI` 主线的 Phase C，规划“用户通过填表创建并挂载 slide app”的正式路径。
- 本阶段的完成态不是“所有文档和展示资产都已收口”，而是：
  - 用户可通过模型表定义 slide app
  - 用户可通过模型表声明必要 metadata
  - 用户可通过模型表把该 app 挂到 Workspace 主线
  - 整个过程仍遵守前两阶段已冻结的拓扑与通用主线合同

## 2. Background

- `0288` 已冻结：
  - 双工人拓扑与权属边界
  - `Model 100` 作为当前正式锚点
- `0289` 已冻结：
  - slide-capable app 准入条件
  - Workspace 主线 metadata 最小集
  - registry / mount / selection / lifecycle 通用边界
- 当前仓库里其实已经有若干“接近用户可创建”的经验样例：
  - [[docs/user-guide/workspace_ui_filltable_example]]
  - `0270` / `0276` / `Static`
- 但这些样例还不等于“用户已经有一条正式、统一、可推广的 Slide UI 填表创建合同”。

## 3. Problem Statement

- 如果不单独规划 Phase C，后面执行很容易出现这几类问题：
  1. 用户只能复制系统预置样例，缺少正式的创建路径
  2. metadata、truth、mount 写法在不同示例间各写各的，无法形成统一创建合同
  3. 用户创建和 Workspace 主线通用化混在一起，导致系统主线一边变化、一边又要开放创建，范围失控
- 因此，这一阶段必须回答：
  - 用户最低需要填哪些模型和标签，才能形成一个 slide app
  - 这些标签里哪些属于 host，哪些属于 truth，哪些属于 Workspace registry/mount
  - 创建后怎样合法挂进 Workspace

## 4. Scope

### 4.1 In Scope

- 规划用户创建 slide app 的正式最小路径：
  - 新建 host model
  - 新建 truth model（如需要）
  - 填 metadata
  - 填 UI 结构
  - 挂载到 Workspace
- 定义这一阶段推荐的创建模板或最小字段集。
- 明确用户在创建时必须填写的核心内容：
  - `app_name`
  - `source_worker`
  - `source_model_id`
  - `slide_capable`
  - `slide_surface_type`
  - mount / submt / registry 相关项
- 规划最小验证矩阵：
  - 创建一个新 slide app
  - 将其挂到 Workspace
  - 刷新后仍可被发现和打开

### 4.2 Out of Scope

- 不做 Gallery 收口。
- 不做使用文档收口。
- 不做远端/浏览器取证收口。
- 不把范围扩成“最终完整组件库发布”。
- 不重写 Phase A/B 已冻结的系统合同。

## 5. Invariants / Constraints

### 5.1 必须继承前两阶段

- Phase C 必须建立在 Phase A/B 已冻结的合同之上：
  - 双工人拓扑不重开
  - Workspace 通用主线不重开
- 用户创建的 app 必须服从既有主线，而不是倒逼主线改写。

### 5.2 Host / Truth / Registry / Mount 必须分层

- 创建路径中必须明确区分：
  - host model
  - truth model
  - Workspace registry entry
  - mount / submt 声明
- 不允许把这些混成单个“神模型”来简化用户流程。

### 5.3 必须给出最小可复制模板

- Phase C 不应只给原则说明，必须至少冻结一套“用户可照着填”的最小模板。
- 该模板可以是：
  - 最小字段清单
  - 最小 patch 片段
  - 最小模型分工图
- 但必须能被后续执行阶段直接转成真实教程和真实示例。

### 5.4 当前阶段不做收口资产

- Gallery、正式使用文档、远端取证都留到 Phase D。
- 当前阶段只把“如何创建和挂载”冻结清楚。

## 6. Success Criteria

- Phase C 计划完成后，必须至少冻结这些内容：
  1. 用户创建 slide app 的最小路径
  2. host/truth/registry/mount 的分层规则
  3. 用户必须填写的 metadata 最小集
  4. 一套最小可复制模板
  5. 创建后挂到 Workspace 的最小验证矩阵

## 7. Inputs

- Created at: `2026-04-06`
- Iteration ID: `0290-slide-ui-phaseC-filltable-create-mount`
- Primary baselines:
  - [[docs/iterations/0287-slide-ui-mainline-split/plan]]
  - [[docs/iterations/0288-slide-ui-phaseA-topology-freeze/plan]]
  - [[docs/iterations/0289-slide-ui-phaseB-workspace-generalization/plan]]
  - [[docs/user-guide/workspace_ui_filltable_example]]
