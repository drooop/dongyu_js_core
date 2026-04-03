---
title: "0284 — matrix-userline-phase2 Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-04-03
source: ai
iteration_id: 0284-matrix-userline-phase2
id: 0284-matrix-userline-phase2
phase: phase1
---

# 0284 — matrix-userline-phase2 Resolution

## Execution Strategy

- 本 iteration 仍是 docs-only 计划冻结，不做代码实现。
- 目标是在 `0283` 之后，把第二阶段“基础聊天 UI”正式范围拆到可执行粒度。
- 实施顺序固定为：
  1. 冻结第二阶段产品层模型补充块
  2. 冻结私聊 / 群聊共享 UI 骨架
  3. 冻结基础成员管理边界
  4. 冻结第二阶段最小验证矩阵
  5. 明确与第三阶段、第四阶段的边界

## Step 1

- Scope:
  - 基于 `0283`，定义第二阶段新增模型块
  - 说明 `1020/1021` 的职责
- Files:
  - `docs/iterations/0284-matrix-userline-phase2/plan.md`
  - `docs/iterations/0284-matrix-userline-phase2/resolution.md`
- Verification:
  - 文档中必须明确：
    - `1020` 做什么
    - `1021` 做什么
    - 不把消息真值放进 UI-only state
- Acceptance:
  - 第二阶段新增模型职责无歧义
- Rollback:
  - 回退本 iteration 文档

## Step 2

- Scope:
  - 冻结私聊 / 群聊共享 UI 骨架
  - 明确房间列表、timeline、输入框、成员面板的位置与关系
- Files:
  - `docs/iterations/0284-matrix-userline-phase2/plan.md`
  - `docs/iterations/0284-matrix-userline-phase2/resolution.md`
- Verification:
  - 文档中必须出现：
    - 左侧房间列表
    - 中间 timeline
    - 底部输入框
    - 侧边成员面板
- Acceptance:
  - 私聊/群聊共享骨架边界清晰
- Rollback:
  - 回退本 iteration 文档

## Step 3

- Scope:
  - 定义基础成员管理边界
  - 明确本阶段不扩成完整权限治理
- Files:
  - `docs/iterations/0284-matrix-userline-phase2/plan.md`
  - `docs/iterations/0284-matrix-userline-phase2/resolution.md`
- Verification:
  - 文档中必须明确：
    - 至少可查看当前房间成员
    - 私聊/群聊下的成员呈现差异
    - 不含复杂权限系统
- Acceptance:
  - “成员管理”含义被收窄到基础层
- Rollback:
  - 回退本 iteration 文档

## Step 4

- Scope:
  - 定义第二阶段最小验证矩阵
  - 不把范围扩到完整聊天产品
- Files:
  - `docs/iterations/0284-matrix-userline-phase2/plan.md`
  - `docs/iterations/0284-matrix-userline-phase2/resolution.md`
- Verification:
  - 文档中必须明确：
    - 进入房间
    - 查看 timeline
    - 发一条
    - 收一条
    - 查看成员列表
- Acceptance:
  - 第二阶段最小验证面完整
- Rollback:
  - 回退本 iteration 文档

## Step 5

- Scope:
  - 写清第二阶段与第三阶段、第四阶段的切分：
    - 第三阶段：完整用户管理
    - 第四阶段：视频通话（不加密）
  - 再次显式写入加密后置
- Files:
  - `docs/iterations/0284-matrix-userline-phase2/plan.md`
  - `docs/iterations/0284-matrix-userline-phase2/runlog.md`
- Verification:
  - 文档中必须显式写出：
    - 不做注册/资料/在线状态
    - 不做视频
    - 不做加密
- Acceptance:
  - 第二阶段与后续阶段边界清晰
- Rollback:
  - 回退本 iteration 文档
