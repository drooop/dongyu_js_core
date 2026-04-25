---
title: "0285 — matrix-userline-phase3 Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0285-matrix-userline-phase3
id: 0285-matrix-userline-phase3
phase: phase1
---

# 0285 — matrix-userline-phase3 Plan

## 0. Metadata

- ID: `0285-matrix-userline-phase3`
- Date: `2026-04-03`
- Owner: AI-assisted planning
- Branch: `dev_0285-matrix-userline-phase3`
- Planning mode: `refine`
- Depends on:
  - [[docs/iterations/0283-matrix-userline-phase1/plan]]
  - [[docs/iterations/0284-matrix-userline-phase2/plan]]
  - [[docs/plans/2026-04-03-slide-matrix-three-current-baseline]]

## 1. Goal

- 规划 Matrix 用户产品线第三阶段，但仍只做**非加密**完整用户管理：
  - 注册
  - 资料编辑
  - 在线状态展示
- 本阶段的完成态不是“聊天或视频能力继续扩展”，而是：
  - 在前两阶段已冻结的登录和基础聊天 UI 之上，
  - 把用户账户与身份相关能力补完整，并明确它们和聊天主界面的关系。

## 2. Background

- `0283` 已冻结：
  - 最小登录能力前置
  - 方案 A 固定
  - 加密后置
  - 用户产品线第一阶段模型块建议
- `0284` 已冻结：
  - 私聊 / 群聊基础界面
  - 房间列表 / timeline / 输入框 / 基础成员管理
  - `1020/1021` 的建议职责
- 也就是说，第三阶段不再负责“让用户先能进系统、先能发消息”；
  这些前提已经在前两阶段完成。
- 当前第三阶段要解决的是：
  - 用户怎么注册
  - 用户怎么维护自己的资料
  - 用户在线状态怎么进入产品层展示面

## 3. Problem Statement

- 如果第三阶段不单独收口用户管理，执行时容易出现两种偏差：
  1. 把“最小登录”误当成“用户管理已经完成”
  2. 把注册、资料、在线状态顺手混进聊天基础界面阶段，导致阶段边界失控
- 同时，“在线状态”也容易被做大：
  - 当前阶段要的是用户产品层可见的在线状态展示
  - 不是完整 presence 生态、跨设备同步细节或复杂通知联动

## 4. Scope

### 4.1 In Scope

- 规划第三阶段的用户管理产品层能力：
  - 注册
  - 资料编辑
  - 在线状态展示
- 定义这些能力对应的产品层模型分工与建议 `model_id` 扩展。
- 规划用户管理与聊天主界面的关系：
  - 个人资料入口
  - 注册完成后的身份落位
  - 在线状态在房间列表 / 会话头部 / 成员面板中的展示口径
- 规划第三阶段的最小验证矩阵：
  - 注册一个用户
  - 修改资料
  - 在线状态被正确投影

### 4.2 Out of Scope

- 不重开最小登录能力讨论。
- 不重做私聊/群聊基础界面。
- 不实现视频通话。
- 不实现任何加密能力。
- 不扩展为完整通知系统、复杂 presence 传播策略、跨设备状态治理。
- 不切换到方案 B。

## 5. Invariants / Constraints

### 5.1 延续前两阶段硬约束

- 继续走方案 A，经 `MBR` 双总线。
- 加密后置必须再次显式写入。
- 当前阶段不重新定义聊天消息主通道。

### 5.2 第三阶段产品层模型建议

- 推荐在前两阶段模型块之上继续补：
  - `1022` = user profile truth
  - `1023` = registration flow truth
  - `1024` = presence projection truth
- 含义：
  - `1022` 承载用户资料真值
  - `1023` 承载注册流程与注册结果
  - `1024` 承载用户产品层可见的在线状态投影
- 第三阶段默认不把 presence 扩展成独立复杂事件系统。

### 5.3 注册边界

- 第三阶段中的注册能力应当是产品层可见的正式注册流程。
- 它与第一阶段的“最小登录”不同：
  - 最小登录解决的是已有身份如何认证并进入系统
  - 第三阶段解决的是没有身份的人如何成为产品用户
- 本阶段不要求扩展到复杂邀请制、组织审批流或多租户治理。

### 5.4 资料编辑边界

- 资料编辑至少覆盖：
  - 展示当前用户资料
  - 修改核心资料字段
  - 保存结果可回读
- 本阶段不要求做复杂头像媒体链路、资料版本治理或后台审批。

### 5.5 在线状态边界

- 第三阶段中的在线状态只要求进入用户产品层展示面。
- 最低线应至少包括：
  - 当前用户在线状态
  - 房间/成员面板中的在线状态可见
- 不要求：
  - 完整 presence 历史
  - 跨设备高级聚合
  - 复杂离线消息策略

### 5.6 UI 能力沉淀约束

- 若第三阶段发现现有 UI 模型能力不足以表达用户管理面：
  - 必须合法扩展
  - 必须评估如何沉淀到 Gallery
  - 必须评估如何补使用说明文档
- 不允许为注册/资料/在线状态单独开页面特判。

## 6. Success Criteria

- 第三阶段计划完成后，必须至少冻结这些内容：
  1. 注册能力范围
  2. 资料编辑范围
  3. 在线状态展示范围
  4. `1022/1023/1024` 的建议职责
  5. 第三阶段最小验证矩阵
- 计划文档必须能回答：
  - 注册、资料、在线状态分别归谁承载
  - 为什么第三阶段才处理这些能力
  - 为什么此阶段不做视频和加密
  - 为什么 presence 只做到产品层展示，不扩成完整生态

## 7. Inputs

- Created at: `2026-04-03`
- Iteration ID: `0285-matrix-userline-phase3`
- Primary baselines:
  - [[docs/iterations/0283-matrix-userline-phase1/plan]]
  - [[docs/iterations/0284-matrix-userline-phase2/plan]]
  - [[docs/plans/2026-04-03-slide-matrix-three-current-baseline]]
