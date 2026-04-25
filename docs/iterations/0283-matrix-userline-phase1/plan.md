---
title: "0283 — matrix-userline-phase1 Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0283-matrix-userline-phase1
id: 0283-matrix-userline-phase1
phase: phase1
---

# 0283 — matrix-userline-phase1 Plan

## 0. Metadata

- ID: `0283-matrix-userline-phase1`
- Date: `2026-04-03`
- Owner: AI-assisted planning
- Branch: `dev_0283-matrix-userline-phase1`
- Planning mode: `refine`
- Depends on:
  - [[docs/plans/2026-04-03-slide-matrix-three-current-baseline]]
  - [[docs/iterations/0214-sliding-flow-ui/plan]]
  - [[docs/iterations/0216-threejs-runtime-and-scene-crud/plan]]
  - [[docs/iterations/0217-gallery-extension-matrix-three/plan]]

## 1. Goal

- 启动 Matrix 用户产品线的第一阶段，但只做**非加密**基础：
  - 冻结用户产品层的模型分层与 `model_id` 规划；
  - 纳入最小登录能力（用户身份认证 + session），作为聊天的硬前置；
  - 固定聊天消息走 **方案 A：经 MBR 双总线 / `dy.bus.v0` 中转**；
  - 证明“发一条、收一条”最小闭环成立。
- 本 iteration 的完成态不是“聊天产品已经做完”，而是：
  - 当前仓库拥有一个可执行、可验证、可扩展的 Matrix 非加密产品线起点。

## 2. Background

- 当前仓库里已经有 Matrix 系统层能力，但还没有用户聊天产品：
  - `packages/worker-base/src/matrix_live.js` 已承担 bus adapter 角色；
  - [[docs/ssot/ui_to_matrix_event_flow]] 已冻结系统层 Matrix / MBR / MQTT 路径；
  - 现有颜色生成器和 dual-worker 案例证明了双总线基础设施可跑通。
- 基线文档已经明确分层：
  - [[docs/plans/2026-04-03-slide-matrix-three-current-baseline]]
  - 现有 Matrix = 系统层 Management Bus Adapter
  - 新 Matrix 聊天 = 用户产品层正数模型线
- 用户已锁定以下约束：
  - 总排序：Matrix 非加密 → Slide UI → 3D CRUD
  - 所有加密能力后置，不在当前规划范围
  - Matrix 第一阶段必须走方案 A，不走前端直连 homeserver 的独立产品通道
  - 最小登录能力必须前置，不能晚于基础聊天 UI

## 3. Problem Statement

- 当前最大的空白不是 Matrix 基础设施，而是用户产品层完全缺位：
  - 没有正数用户模型承载房间、会话、消息
  - 没有聊天 UI
  - 没有用户 session
  - 没有“产品层消息”与现有 `mt.v0` patch 消息的明确区分
- 如果不先冻结这条线的第一阶段合同，后续很容易出现以下问题：
  - 把系统层 bus adapter 误当成聊天产品直接扩写
  - 最小登录被遗漏，导致聊天 UI 没有真实用户身份前提
  - 聊天消息和 patch 消息混用同一种 envelope，后续 `MBR` 无法稳定分流
  - 直接滑向方案 B（前端直连 Matrix client），与当前已锁定前提冲突

## 4. Scope

### 4.1 In Scope

- 定义用户产品层的模型拓扑与 `model_id` 规划。
- 明确最小登录能力的范围与完成标准：
  - 用户身份认证
  - session 获取/维持
  - 支撑后续房间列表与发消息
- 明确聊天消息在方案 A 下的消息口径：
  - 经 `MBR`
  - 经 `dy.bus.v0`
  - 与现有 `mt.v0` patch 消息严格区分
- 规划一个最小 UI 闭环：
  - 登录
  - 进入一个最小会话
  - 发送一条消息
  - 收到一条消息
- 输出后续 Phase 2-4 的依赖关系，但不实现它们。

### 4.2 Out of Scope

- 不实现私聊/群聊完整界面。
- 不实现完整用户管理（注册、资料编辑、在线状态展示）。
- 不实现视频通话。
- 不实现任何聊天 E2E 加密或加密视频。
- 不切换到方案 B。
- 不对现有 Slide UI 或 Three.js 线做实现改动。

## 5. Invariants / Constraints

### 5.1 正式锁定约束

- `Matrix 非加密第一阶段` 必须走方案 A：
  - 聊天消息经 `MBR` 双总线 / `dy.bus.v0`
  - 不使用前端直连 homeserver 的独立产品 client 作为第一阶段正式路径
- 加密全部后置：
  - 不做聊天 E2E
  - 不做加密视频
  - 后续每个 Matrix 阶段 plan 都必须显式声明“加密后置”

### 5.2 分层约束

- 系统层 Matrix 能力与用户产品层必须明确分层：
  - 系统层：负数模型、bus adapter、MBR、既有总线链路
  - 用户产品层：正数模型、聊天 UI、房间/消息/session truth
- 不允许把用户聊天真值塞进系统负数模型。
- 不允许把系统 bus adapter 的内部状态直接当成用户产品 truth。

### 5.3 第一阶段建议冻结的产品层模型块

- 推荐保留一个连续正数区间给 Matrix 用户产品线第一阶段：
  - `1016` = Matrix workspace app host
  - `1017` = Matrix session/auth truth
  - `1018` = Matrix room directory truth
  - `1019` = Matrix active conversation truth
- 含义：
  - `1016` 负责 Workspace 可见入口与页面承载
  - `1017` 负责最小登录能力、session、当前用户身份
  - `1018` 负责房间/会话目录索引
  - `1019` 负责当前会话消息闭环的最小 truth
- 第一阶段默认不把“每条消息”提升为独立模型。
- 若后续执行需要扩大 block，必须在该 iteration 的 execution 中明确说明扩大的理由。

### 5.4 第一阶段建议冻结的消息口径

- 方案 A 下，聊天消息必须继续经 `MBR` 与 `dy.bus.v0` 中转。
- 但聊天消息不得复用现有 patch 的 `mt.v0` 口径。
- 第一阶段计划必须冻结一个和 patch 明确区分的聊天 envelope：
  - 例如单独的 `kind` / `channel` / `message_type`
  - 或其它等价但可判定的区分字段
- 核心要求只有一个：
  - `MBR` 与上下游一眼可以区分“这是聊天消息”还是“这是 patch 消息”。

### 5.5 最小登录能力约束

- 第一阶段中的最小登录能力只包含：
  - 用户身份认证
  - session 获取
  - session 维持
- 第一阶段不包含：
  - 注册
  - 用户资料编辑
  - 在线状态展示
- 第一阶段也不引入前端独立 Matrix sync client。
- 登录路径应与当前系统层结构兼容，不应提前滑向方案 B。

### 5.6 UI 模型约束

- 后续聊天产品 UI 必须继续遵守当前 UI 模型主线：
  - Workspace host / truth 分层
  - UI 写合法入口
  - 需要扩展的 UI 能力必须合法沉淀
  - 重要新能力应逐步沉淀到 Gallery 与使用文档

### 5.7 风险必须在计划中显式记录

- `MBR` 原本偏向 patch 中转，不是高吞吐聊天消息层。
- 聊天消息 envelope 必须和现有 patch 消息区分。
- 将来若迁移到方案 B，需要评估同步、连接生命周期和改造成本。

## 6. Success Criteria

- iteration 完成后，必须至少冻结这些内容：
  1. 用户产品层模型拓扑与 `model_id` 规划
  2. 最小登录能力的边界与 session 口径
  3. 聊天消息经方案 A 的 message envelope 区分方式
  4. “发一条、收一条”最小闭环的实施路径
  5. 明确后续 Phase 2/3/4 与本阶段的边界
- 计划文档必须能回答：
  - 聊天消息如何和 `mt.v0` patch 区分
  - 最小登录为什么是第一阶段硬前置
  - 为什么当前阶段不做加密
  - 为什么当前阶段不走方案 B
  - 第一阶段建议冻结的正数模型块是什么

## 7. Inputs

- Created at: `2026-04-03`
- Iteration ID: `0283-matrix-userline-phase1`
- Primary baselines:
  - [[docs/plans/2026-04-03-slide-matrix-three-current-baseline]]
  - [[docs/ssot/ui_to_matrix_event_flow]]
  - [[docs/user-guide/dual_worker_slide_e2e_v0]]
