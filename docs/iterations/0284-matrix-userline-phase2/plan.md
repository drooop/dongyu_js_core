---
title: "0284 — matrix-userline-phase2 Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-03
source: ai
iteration_id: 0284-matrix-userline-phase2
id: 0284-matrix-userline-phase2
phase: phase1
---

# 0284 — matrix-userline-phase2 Plan

## 0. Metadata

- ID: `0284-matrix-userline-phase2`
- Date: `2026-04-03`
- Owner: AI-assisted planning
- Branch: `dev_0284-matrix-userline-phase2`
- Planning mode: `refine`
- Depends on:
  - [[docs/iterations/0283-matrix-userline-phase1/plan]]
  - [[docs/plans/2026-04-03-slide-matrix-three-current-baseline]]

## 1. Goal

- 规划 Matrix 用户产品线第二阶段，但仍只做**非加密**基础聊天：
  - 私聊和群聊的基础界面
  - 房间列表
  - 消息时间线
  - 消息输入框
  - 基础成员管理
- 本阶段的完成态不是“完整聊天产品”，而是：
  - 在 `0283` 已冻结的模型拓扑与方案 A 消息通道之上，
  - 把用户真正可用的基础聊天界面范围和验证口径冻结清楚。

## 2. Background

- `0283` 已冻结第一阶段前提：
  - 方案 A：经 `MBR` 双总线
  - 最小登录能力前置
  - 加密后置
  - 第一阶段建议模型块：
    - `1016` workspace app host
    - `1017` session/auth truth
    - `1018` room directory truth
    - `1019` active conversation truth
- 当前仓库仍然没有任何用户聊天 UI：
  - 没有房间列表页面
  - 没有 timeline
  - 没有消息输入
  - 没有产品层成员管理面板
- 基线文档已明确：
  - 当前 Matrix 现成部分是系统层 bus adapter，不是聊天产品
  - UI 模型能力若扩展，必须合法沉淀，并逐步进入 Gallery 与使用文档

## 3. Problem Statement

- 如果第二阶段不先冻结基础聊天 UI 的范围，执行时很容易出现两类偏差：
  1. 范围过大：
     - 顺手带上注册、资料、在线状态、视频、加密、文件上传、搜索、已读回执、typing 指示器
  2. 范围过小：
     - 只做一个“能输入一条消息”的演示面，缺少真正的房间切换和 timeline 结构
- 同时，“成员管理”也容易歧义：
  - 当前阶段要的是基础成员管理面
  - 不是完整组织治理、权限系统或复杂群管理后台

## 4. Scope

### 4.1 In Scope

- 基于 `0283` 冻结的产品层模型继续细化第二阶段 UI 面：
  - 房间列表
  - 当前会话消息时间线
  - 消息输入框
  - 私聊 / 群聊切换所需的最小 room typing / room metadata 区分
  - 基础成员管理面板
- 明确第二阶段推荐继续扩展的模型块：
  - `1020` = active room members truth
  - `1021` = chat UI-only state（当前 room filter / composer draft / member panel open state）
- 规划私聊与群聊如何共用同一套基础 UI 骨架。
- 规划第二阶段在方案 A 下的最小验证矩阵：
  - 进入房间
  - 查看 timeline
  - 发一条消息
  - 收到一条消息
  - 查看成员列表

### 4.2 Out of Scope

- 不实现注册、资料编辑、在线状态展示。
- 不实现视频通话。
- 不实现任何加密能力。
- 不实现文件上传、消息搜索、已读回执、typing 指示器、通知系统。
- 不切换到方案 B。
- 不把成员管理扩成完整的群权限治理系统。

## 5. Invariants / Constraints

### 5.1 延续 0283 的硬约束

- 继续走方案 A，经 `MBR` 双总线。
- 最小登录能力视为已在前置阶段冻结，不在本阶段重开讨论。
- 加密后置必须再次显式写入。

### 5.2 第二阶段产品层模型建议

- 推荐在 `0283` 的模型块之上继续补：
  - `1020` = active room members truth
  - `1021` = chat UI-only state
- 含义：
  - `1020` 承载当前会话成员列表与最小成员元信息
  - `1021` 只承载聊天界面自己的投影状态，不承载消息真值
- 第二阶段默认仍不把“每条消息”单独升格成一个模型。

### 5.3 私聊与群聊的共同骨架

- 私聊和群聊不应在第二阶段分裂成两套 UI 体系。
- 第二阶段应优先冻结一套共享骨架：
  - 左侧房间列表
  - 中间消息时间线
  - 底部输入框
  - 侧边成员面板
- 私聊 / 群聊的差异主要体现在 room metadata、成员面板和标题信息，而不是整页结构完全不同。

### 5.4 成员管理边界

- 第二阶段的“成员管理”只要求基础成员面板与基础成员操作边界。
- 最低线应至少包括：
  - 查看当前房间成员
  - 区分私聊 / 群聊下的成员呈现
- 若引入成员操作，也只能是最小闭环级别，不扩展为完整权限治理。

### 5.5 UI 能力沉淀约束

- 若第二阶段发现现有 UI 模型能力不足以表达聊天界面：
  - 必须合法扩展
  - 必须评估如何沉淀到 Gallery
  - 必须评估如何补使用说明文档
- 不允许为了赶界面而临时写页面特判。

## 6. Success Criteria

- 第二阶段计划完成后，必须至少冻结这些内容：
  1. 基础聊天 UI 的正式范围
  2. 私聊 / 群聊共享骨架
  3. `1020/1021` 的建议职责
  4. 基础成员管理的边界
  5. 第二阶段的最小验证矩阵
- 计划文档必须能回答：
  - 房间列表、timeline、输入框、成员面板分别归谁承载
  - 私聊和群聊是共享骨架还是两套 UI
  - 为什么此阶段不做完整用户管理
  - 为什么此阶段不做视频和加密

## 7. Inputs

- Created at: `2026-04-03`
- Iteration ID: `0284-matrix-userline-phase2`
- Primary baselines:
  - [[docs/iterations/0283-matrix-userline-phase1/plan]]
  - [[docs/plans/2026-04-03-slide-matrix-three-current-baseline]]
