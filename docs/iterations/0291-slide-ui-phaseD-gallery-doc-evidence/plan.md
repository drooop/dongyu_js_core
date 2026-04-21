---
title: "0291 — slide-ui-phaseD-gallery-doc-evidence Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0291-slide-ui-phaseD-gallery-doc-evidence
id: 0291-slide-ui-phaseD-gallery-doc-evidence
phase: phase1
---

# 0291 — slide-ui-phaseD-gallery-doc-evidence Plan

## 0. Metadata

- ID: `0291-slide-ui-phaseD-gallery-doc-evidence`
- Date: `2026-04-06`
- Owner: AI-assisted planning
- Branch: `dev_0291-slide-ui-phaseD-gallery-doc-evidence`
- Planning mode: `refine`
- Depends on:
  - [[docs/iterations/0287-slide-ui-mainline-split/plan]]
  - [[docs/iterations/0288-slide-ui-phaseA-topology-freeze/plan]]
  - [[docs/iterations/0289-slide-ui-phaseB-workspace-generalization/plan]]
  - [[docs/iterations/0290-slide-ui-phaseC-filltable-create-mount/plan]]
  - [[docs/user-guide/README]]

## 1. Goal

- 作为 `Slide UI` 主线的 Phase D，规划正式收口资产：
  - Gallery 展示
  - 使用文档
  - 浏览器与远端取证
- 本阶段的完成态不是继续扩展 Slide UI 主线能力，而是：
  - 把前 3 个阶段已形成的正式能力，沉淀成可展示、可学习、可回归验证、可审计的资产。

## 2. Background

- `0288` 已冻结：
  - 双工人拓扑与权属边界
- `0289` 已冻结：
  - Workspace 中 slide-capable app 的通用主线
- `0290` 已冻结：
  - 用户通过填表创建并挂载 slide app 的正式路径
- 基线文档也已经明确：
  - 后续 UI 模型能力需要沉淀到 Gallery
  - 使用说明文档最好逐步也由 UI 模型来实现
- 所以 Phase D 的角色很明确：
  - 不是再发明新主线能力
  - 而是把前 3 段的成果整理成正式的展示/文档/证据资产

## 3. Problem Statement

- 如果没有 Phase D，前 3 段虽然有合同，但仍会留下这几类缺口：
  1. Gallery 里没有正式的 Slide UI 展示面，后续难以做快速验证
  2. 用户只看到系统或代码层结果，缺少可直接照做的使用说明
  3. 浏览器和远端缺少标准化取证流程，后续很难证明主线真的成立
- 因此，这一阶段必须回答：
  - Slide UI 在 Gallery 里如何展示
  - 用户文档以什么结构组织
  - 哪些浏览器/远端证据算 Phase D 的正式完成态

## 4. Scope

### 4.1 In Scope

- 规划 Slide UI 的 Gallery 展示结构：
  - 拓扑层展示
  - Workspace 主线展示
  - 填表创建展示
- 规划 Slide UI 的使用文档结构：
  - 面向用户的主文档
  - 面向验证者的最小操作路径
  - 必要时的可视化说明文档
- 规划浏览器与远端取证的最小证据包：
  - 本地浏览器操作证据
  - 远端浏览器操作证据
  - 必要的 snapshot / route / log 对照
- 规划 Phase D 的最小验证矩阵：
  - Gallery 中存在正式 Slide UI 展示
  - 用户文档可独立指导操作
  - 远端证据能证明主线成立

### 4.2 Out of Scope

- 不继续扩展 Slide UI 业务能力。
- 不重新定义拓扑、主线通用化、用户创建路径。
- 不把范围扩成完整营销站点、品牌化展示页或额外视觉包装项目。
- 不在本阶段引入新的核心 UI 组件能力，除非只是为了表达和文档必须的最小补充。

## 5. Invariants / Constraints

### 5.1 必须继承前 3 阶段

- Phase D 不能重开：
  - 双工人拓扑
  - Workspace 主线通用化
  - 填表创建路径
- 这三者都只能被展示、解释、取证，不能在此阶段被重新定义。

### 5.2 Gallery 必须承担正式展示入口

- Slide UI 的关键能力不应只藏在单一业务页面里。
- Phase D 必须明确哪些 Gallery 面板或示例承担：
  - 能力展示
  - 快速回归验证
  - 对外说明入口

### 5.3 文档最好逐步进入 UI 模型主线

- 使用说明文档不应全部停留在独立静态 Markdown/HTML。
- Phase D 必须至少评估：
  - 哪些说明页适合由 UI 模型表达
  - 哪些仍暂时保留 Markdown
- 长期方向仍是“说明文档也逐步进入 UI 模型主线”。

### 5.4 证据必须可重复

- 浏览器和远端取证不应依赖一次性手工结论。
- 必须定义最小可重复的证据集合：
  - 哪些页面要打开
  - 哪些操作要点击
  - 哪些状态要截图或核对

## 6. Success Criteria

- Phase D 计划完成后，必须至少冻结这些内容：
  1. Slide UI Gallery 展示结构
  2. Slide UI 用户文档结构
  3. 浏览器与远端证据的最小清单
  4. 哪些说明页应逐步进入 UI 模型主线
  5. 为什么此阶段不再扩功能，只做收口

## 7. Inputs

- Created at: `2026-04-06`
- Iteration ID: `0291-slide-ui-phaseD-gallery-doc-evidence`
- Primary baselines:
  - [[docs/iterations/0287-slide-ui-mainline-split/plan]]
  - [[docs/iterations/0288-slide-ui-phaseA-topology-freeze/plan]]
  - [[docs/iterations/0289-slide-ui-phaseB-workspace-generalization/plan]]
  - [[docs/iterations/0290-slide-ui-phaseC-filltable-create-mount/plan]]
  - [[docs/user-guide/README]]
