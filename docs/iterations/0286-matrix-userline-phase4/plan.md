---
title: "0286 — matrix-userline-phase4 Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-03
source: ai
iteration_id: 0286-matrix-userline-phase4
id: 0286-matrix-userline-phase4
phase: phase1
---

# 0286 — matrix-userline-phase4 Plan

## 0. Metadata

- ID: `0286-matrix-userline-phase4`
- Date: `2026-04-03`
- Owner: AI-assisted planning
- Branch: `dev_0286-matrix-userline-phase4`
- Planning mode: `refine`
- Depends on:
  - [[docs/iterations/0283-matrix-userline-phase1/plan]]
  - [[docs/iterations/0284-matrix-userline-phase2/plan]]
  - [[docs/iterations/0285-matrix-userline-phase3/plan]]
  - [[docs/plans/2026-04-03-slide-matrix-three-current-baseline]]

## 1. Goal

- 规划 Matrix 用户产品线第四阶段，但仍只做**非加密**视频通话：
  - 一对一视频
  - 多人视频
  - 最小呼叫控制能力
- 本阶段的完成态不是“完整音视频平台”，而是：
  - 在前 3 个阶段已冻结的登录、聊天 UI、用户管理基础上，
  - 把非加密视频通话的信令、媒体链路、多人范围和最小产品边界冻结清楚。

## 2. Background

- `0283` 已冻结：
  - 方案 A：经 `MBR` 双总线
  - 最小登录能力
  - 加密后置
- `0284` 已冻结：
  - 私聊/群聊基础界面
  - 房间列表 / timeline / 输入框 / 基础成员管理
- `0285` 已冻结：
  - 注册
  - 资料编辑
  - 在线状态展示
- 因此第四阶段不再负责“先让用户能进入产品、先能发消息、先能有身份”；
  这些前置条件已经在前 3 个阶段内处理。
- 当前第四阶段要解决的是：
  - 呼叫信令怎么走
  - 媒体流怎么走
  - 一对一和多人视频的最小范围是什么

## 3. Problem Statement

- 如果第四阶段不先冻结音视频边界，执行时很容易出现三类偏差：
  1. 把媒体流误塞进现有 `MBR` / `dy.bus.v0`
  2. 把多人视频直接扩成大规模会议系统
  3. 顺手带上加密、屏幕共享、录制、背景处理、设备切换等大范围功能
- 当前最关键的架构分界必须先写清楚：
  - 信令平面
  - 媒体平面
  - 产品层呼叫状态真值

## 4. Scope

### 4.1 In Scope

- 规划第四阶段的非加密视频通话能力：
  - 一对一视频
  - 多人视频
  - 呼叫发起 / 接听 / 拒绝 / 挂断
  - 静音 / 关摄像头 这类最小呼叫控制
- 明确信令链路：
  - 继续复用方案 A
  - 呼叫信令经 `MBR` 双总线 / `dy.bus.v0`
- 明确媒体链路：
  - 媒体流不经 `MBR`
  - 媒体流走 `WebRTC` peer connection
- 定义第四阶段的产品层模型建议与最小验证矩阵。

### 4.2 Out of Scope

- 不实现任何加密能力。
- 不实现屏幕共享。
- 不实现录制、转码、存档。
- 不实现背景模糊、虚拟背景、设备切换高级面板。
- 不实现 SFU / MCU 级大规模会议架构。
- 不切换到方案 B。

## 5. Invariants / Constraints

### 5.1 延续前 3 阶段硬约束

- 继续沿用方案 A 作为信令通道基础。
- 加密后置必须再次显式写入。
- 第四阶段不重开聊天主消息通道和登录/用户管理范围。

### 5.2 信令与媒体必须分层

- 信令平面：
  - 继续经 `MBR` / `dy.bus.v0`
  - 承载呼叫邀请、应答、挂断、candidate/offer/answer 等会话控制信息
- 媒体平面：
  - 不经 `MBR`
  - 不经 `dy.bus.v0`
  - 走 `WebRTC` peer-to-peer 媒体连接
- 第四阶段的核心约束是：
  - `MBR` 只做信令中转，不做音视频流中转

### 5.3 第四阶段产品层模型建议

- 推荐在前 3 阶段模型块之上继续补：
  - `1025` = call session truth
  - `1026` = call participants/media truth
  - `1027` = call UI/device state
- 含义：
  - `1025` 承载当前通话状态、房间呼叫状态、呼叫生命周期
  - `1026` 承载参与者媒体状态（音频/视频 on/off、流状态、角色）
  - `1027` 只承载通话界面自己的投影状态和设备 UI 状态
- 第四阶段默认不把原始媒体流对象当成模型真值。

### 5.4 多人范围边界

- 第四阶段的“多人”只要求小规模多人通话能力成立。
- 默认目标应是：
  - 能证明多人视频通话闭环
  - 不是大规模会议平台
- 若需要在计划中明确容量，建议按“小房间 baseline”口径写，不承诺高并发扩展能力。

### 5.5 呼叫控制边界

- 第四阶段的最小控制能力只要求：
  - 发起
  - 接听
  - 拒绝
  - 挂断
  - 静音
  - 关摄像头
- 不要求：
  - 屏幕共享
  - 录制
  - 布局切换引擎
  - 复杂设备管理

### 5.6 UI 能力沉淀约束

- 若第四阶段发现现有 UI 模型能力不足以表达视频通话界面：
  - 必须合法扩展
  - 必须评估如何沉淀到 Gallery
  - 必须评估如何补使用说明文档
- 不允许为通话页面临时开特判逃逸主线。

## 6. Success Criteria

- 第四阶段计划完成后，必须至少冻结这些内容：
  1. 信令平面与媒体平面的正式分层
  2. 一对一视频范围
  3. 多人视频的最小范围
  4. `1025/1026/1027` 的建议职责
  5. 第四阶段最小验证矩阵
- 计划文档必须能回答：
  - 哪些信息走 `MBR`
  - 哪些数据绝不走 `MBR`
  - 多人视频做到什么程度
  - 为什么本阶段不做加密、屏幕共享、录制和大规模会议

## 7. Inputs

- Created at: `2026-04-03`
- Iteration ID: `0286-matrix-userline-phase4`
- Primary baselines:
  - [[docs/iterations/0283-matrix-userline-phase1/plan]]
  - [[docs/iterations/0284-matrix-userline-phase2/plan]]
  - [[docs/iterations/0285-matrix-userline-phase3/plan]]
  - [[docs/plans/2026-04-03-slide-matrix-three-current-baseline]]
