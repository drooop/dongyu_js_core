---
title: "0283 — matrix-userline-phase1 Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-04-03
source: ai
iteration_id: 0283-matrix-userline-phase1
id: 0283-matrix-userline-phase1
phase: phase1
---

# 0283 — matrix-userline-phase1 Resolution

## Execution Strategy

- 本 iteration 仍是 docs-only 计划冻结，不做代码实现。
- 目标是把第一阶段的实现边界拆到可执行粒度，为后续 Phase 3 提供正式施工图。
- 实施顺序固定为：
  1. 冻结模型拓扑与 ID block
  2. 冻结最小登录/session 路径
  3. 冻结方案 A 的聊天 envelope 与 MBR 分流边界
  4. 冻结最小 UI 闭环与验证矩阵
  5. 记录风险、回滚与后续阶段边界

## Step 1

- Scope:
  - 定义 Matrix 用户产品层第一阶段的正数模型拓扑
  - 冻结推荐 `model_id` block
  - 明确 host / truth / session / room / active conversation 的分层
- Files:
  - `docs/iterations/0283-matrix-userline-phase1/plan.md`
  - `docs/iterations/0283-matrix-userline-phase1/resolution.md`
- Verification:
  - 文档中必须明确：
    - 哪些模型承载用户真值
    - 哪些仍是系统层
    - 不把聊天 truth 放入负数模型
    - `1016-1019` 的建议分工
- Acceptance:
  - 无上下文读者能看懂第一阶段的产品层模型放置
- Rollback:
  - 回退本 iteration 文档

## Step 2

- Scope:
  - 定义最小登录能力的边界
  - 明确它为什么前置于聊天 UI
  - 区分最小登录与完整用户管理
  - 说明第一阶段不引入前端独立 Matrix sync client
- Files:
  - `docs/iterations/0283-matrix-userline-phase1/plan.md`
  - `docs/iterations/0283-matrix-userline-phase1/resolution.md`
- Verification:
  - 文档中必须出现：
    - 用户身份认证
    - session 获取/维持
    - 不含注册/资料/在线状态
    - 不滑向方案 B
- Acceptance:
  - 第一阶段对“最小登录”和“完整用户管理”的分界清晰
- Rollback:
  - 回退本 iteration 文档

## Step 3

- Scope:
  - 固定聊天消息走方案 A
  - 规划 `dy.bus.v0` 下的聊天 envelope 与现有 `mt.v0` patch 区分方式
  - 记录方案 A 的已知风险与未来迁移到方案 B 的成本
- Files:
  - `docs/iterations/0283-matrix-userline-phase1/plan.md`
  - `docs/iterations/0283-matrix-userline-phase1/resolution.md`
- Verification:
  - 文档中必须显式写出：
    - 不走方案 B
    - 聊天消息不等于 patch 消息
    - `MBR` 风险和未来迁移成本
    - 区分字段至少有一条明确建议
- Acceptance:
  - 消息通道约束不再存在歧义
- Rollback:
  - 回退本 iteration 文档

## Step 4

- Scope:
  - 定义最小 UI 闭环：
    - 登录
    - 进入最小会话
    - 发一条
    - 收一条
  - 只冻结最小证明路径，不扩成完整聊天产品
- Files:
  - `docs/iterations/0283-matrix-userline-phase1/plan.md`
  - `docs/iterations/0283-matrix-userline-phase1/resolution.md`
- Verification:
  - 文档中必须明确：
    - 最小 UI 元素
    - 最小链路验证
    - 不含房间列表/群聊全量能力
- Acceptance:
  - 第一阶段完成态清晰，不与第二阶段混淆
- Rollback:
  - 回退本 iteration 文档

## Step 5

- Scope:
  - 固定后续 Phase 2/3/4 的边界：
    - 第二阶段：私聊/群聊基础界面
    - 第三阶段：完整用户管理
    - 第四阶段：视频通话（不加密）
  - 在第一阶段文档中显式写入“加密后置”
- Files:
  - `docs/iterations/0283-matrix-userline-phase1/plan.md`
  - `docs/iterations/0283-matrix-userline-phase1/runlog.md`
- Verification:
  - 文档中必须显式写出：
    - 聊天 E2E 后置
    - 加密视频后置
    - 后续阶段顺序
- Acceptance:
  - 后续 Matrix 非加密路线具备清晰顺序，不再反复争论范围
- Rollback:
  - 回退本 iteration 文档
