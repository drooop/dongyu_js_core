---
title: "0288 — slide-ui-phaseA-topology-freeze Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-04-05
source: ai
iteration_id: 0288-slide-ui-phaseA-topology-freeze
id: 0288-slide-ui-phaseA-topology-freeze
phase: phase1
---

# 0288 — slide-ui-phaseA-topology-freeze Resolution

## Execution Strategy

- 本 iteration 仍是 docs-only 计划冻结，不做代码实现。
- 目标是把 `Slide UI Phase A` 的双工人拓扑与权属边界拆到可执行粒度。
- 实施顺序固定为：
  1. 冻结三方角色分工
  2. 冻结 `Model 100` 锚点地位
  3. 冻结 truth 分类与权属边界
  4. 冻结 transport / materialization 的边界
  5. 写清与 Phase B 的切分理由

## Step 1

- Scope:
  - 写清 `ui-server` / `remote-worker` / `MBR` 的角色分工
- Files:
  - `docs/iterations/0288-slide-ui-phaseA-topology-freeze/plan.md`
  - `docs/iterations/0288-slide-ui-phaseA-topology-freeze/resolution.md`
- Verification:
  - 文档中必须明确：
    - app host 谁负责
    - 远端 UI 提供者是谁
    - 业务执行者是谁
    - 中转层是谁
- Acceptance:
  - 三方角色边界清晰
- Rollback:
  - 回退本 iteration 文档

## Step 2

- Scope:
  - 写清为什么 `Model 100` 仍是当前正式锚点
- Files:
  - `docs/iterations/0288-slide-ui-phaseA-topology-freeze/plan.md`
  - `docs/iterations/0288-slide-ui-phaseA-topology-freeze/resolution.md`
- Verification:
  - 文档中必须明确：
    - `Model 100` 的稳定性来源
    - 为什么此阶段不扩到多 app
- Acceptance:
  - 锚点选择理由清晰
- Rollback:
  - 回退本 iteration 文档

## Step 3

- Scope:
  - 冻结 truth 分类与权属边界
- Files:
  - `docs/iterations/0288-slide-ui-phaseA-topology-freeze/plan.md`
  - `docs/iterations/0288-slide-ui-phaseA-topology-freeze/resolution.md`
- Verification:
  - 文档中必须明确：
    - app host truth
    - 远端 UI truth
    - 业务执行结果 truth
    - transport / bridge state
- Acceptance:
  - 权属划分清晰
- Rollback:
  - 回退本 iteration 文档

## Step 4

- Scope:
  - 冻结 transport 与 materialization 的边界
- Files:
  - `docs/iterations/0288-slide-ui-phaseA-topology-freeze/plan.md`
  - `docs/iterations/0288-slide-ui-phaseA-topology-freeze/resolution.md`
- Verification:
  - 文档中必须明确：
    - 哪些消息只是 transport
    - 哪些变化会 materialize 成产品层 truth
    - `MBR` 不承载业务真值
- Acceptance:
  - transport / materialization 边界清晰
- Rollback:
  - 回退本 iteration 文档

## Step 5

- Scope:
  - 写清为什么在 Phase A 之后才能进入 Phase B
- Files:
  - `docs/iterations/0288-slide-ui-phaseA-topology-freeze/plan.md`
  - `docs/iterations/0288-slide-ui-phaseA-topology-freeze/runlog.md`
- Verification:
  - 文档中必须显式写出：
    - 为什么不能先做 Workspace 通用化
    - 为什么不能先做用户填表创建
- Acceptance:
  - 与 Phase B/C 的切分理由清晰
- Rollback:
  - 回退本 iteration 文档
