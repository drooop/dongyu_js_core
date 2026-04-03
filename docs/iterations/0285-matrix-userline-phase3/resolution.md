---
title: "0285 — matrix-userline-phase3 Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-04-03
source: ai
iteration_id: 0285-matrix-userline-phase3
id: 0285-matrix-userline-phase3
phase: phase1
---

# 0285 — matrix-userline-phase3 Resolution

## Execution Strategy

- 本 iteration 仍是 docs-only 计划冻结，不做代码实现。
- 目标是在 `0284` 之后，把第三阶段“完整用户管理”正式范围拆到可执行粒度。
- 实施顺序固定为：
  1. 冻结第三阶段产品层模型补充块
  2. 冻结注册边界
  3. 冻结资料编辑边界
  4. 冻结在线状态展示边界
  5. 明确与第四阶段的切分

## Step 1

- Scope:
  - 基于前两阶段，定义第三阶段新增模型块
  - 说明 `1022/1023/1024` 的职责
- Files:
  - `docs/iterations/0285-matrix-userline-phase3/plan.md`
  - `docs/iterations/0285-matrix-userline-phase3/resolution.md`
- Verification:
  - 文档中必须明确：
    - `1022` 做什么
    - `1023` 做什么
    - `1024` 做什么
- Acceptance:
  - 第三阶段新增模型职责无歧义
- Rollback:
  - 回退本 iteration 文档

## Step 2

- Scope:
  - 冻结注册能力边界
  - 说明它与第一阶段最小登录的区别
- Files:
  - `docs/iterations/0285-matrix-userline-phase3/plan.md`
  - `docs/iterations/0285-matrix-userline-phase3/resolution.md`
- Verification:
  - 文档中必须出现：
    - 无身份用户成为产品用户的路径
    - 与最小登录的区别
    - 不扩展到复杂组织/审批
- Acceptance:
  - 注册边界清晰
- Rollback:
  - 回退本 iteration 文档

## Step 3

- Scope:
  - 冻结资料编辑边界
  - 明确最小可编辑资料范围
- Files:
  - `docs/iterations/0285-matrix-userline-phase3/plan.md`
  - `docs/iterations/0285-matrix-userline-phase3/resolution.md`
- Verification:
  - 文档中必须明确：
    - 资料查看
    - 资料修改
    - 保存后可回读
- Acceptance:
  - 资料编辑范围清晰
- Rollback:
  - 回退本 iteration 文档

## Step 4

- Scope:
  - 冻结在线状态展示边界
  - 不把范围扩展到完整 presence 生态
- Files:
  - `docs/iterations/0285-matrix-userline-phase3/plan.md`
  - `docs/iterations/0285-matrix-userline-phase3/resolution.md`
- Verification:
  - 文档中必须明确：
    - 当前用户在线状态
    - 房间/成员面板中的在线状态可见
    - 不含复杂传播与历史
- Acceptance:
  - 在线状态边界清晰
- Rollback:
  - 回退本 iteration 文档

## Step 5

- Scope:
  - 明确第三阶段与第四阶段的切分：
    - 第四阶段：视频通话（不加密）
  - 再次显式写入加密后置
- Files:
  - `docs/iterations/0285-matrix-userline-phase3/plan.md`
  - `docs/iterations/0285-matrix-userline-phase3/runlog.md`
- Verification:
  - 文档中必须显式写出：
    - 不做视频
    - 不做加密
    - presence 不等于视频/实时媒体
- Acceptance:
  - 第三阶段与第四阶段边界清晰
- Rollback:
  - 回退本 iteration 文档
