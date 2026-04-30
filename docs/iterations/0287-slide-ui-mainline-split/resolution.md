---
title: "0287 — slide-ui-mainline-split Resolution"
doc_type: iteration-resolution
status: completed
updated: 2026-04-21
source: ai
iteration_id: 0287-slide-ui-mainline-split
id: 0287-slide-ui-mainline-split
phase: phase4
---

# 0287 — slide-ui-mainline-split Resolution

## Execution Strategy

- 本 iteration 仍是 docs-only 计划冻结，不做代码实现。
- 目标是把 `Slide UI` 主线正式拆成 4 个后续阶段。

## Closeout Note

- 0354 index reconciliation verified `dev_0287-slide-ui-mainline-split` is an ancestor of `dev`.
- `docs/ITERATIONS.md` was corrected from `Planned` to `Completed`.
- 实施顺序固定为：
  1. 冻结 Phase A 的双工人拓扑与权属边界
  2. 冻结 Phase B 的 Workspace 主线通用化边界
  3. 冻结 Phase C 的填表化创建与挂载边界
  4. 冻结 Phase D 的 Gallery / 文档 / 取证收口边界
  5. 写清阶段间的依赖顺序

## Step 1

- Scope:
  - 写清 Phase A 的双工人拓扑与权属冻结范围
- Files:
  - `docs/iterations/0287-slide-ui-mainline-split/plan.md`
  - `docs/iterations/0287-slide-ui-mainline-split/resolution.md`
- Verification:
  - 文档中必须明确：
    - `ui-server` 角色
    - `remote-worker` 角色
    - `MBR` 角色
- Acceptance:
  - 双工人拓扑边界清晰
- Rollback:
  - 回退本 iteration 文档

## Step 2

- Scope:
  - 写清 Phase B 的 Workspace slide app 主线通用化范围
- Files:
  - `docs/iterations/0287-slide-ui-mainline-split/plan.md`
  - `docs/iterations/0287-slide-ui-mainline-split/resolution.md`
- Verification:
  - 文档中必须明确：
    - slide app registry / metadata / mount / selection / lifecycle
    - 不再只围绕 `Model 100`
- Acceptance:
  - Workspace 主线通用化边界清晰
- Rollback:
  - 回退本 iteration 文档

## Step 3

- Scope:
  - 写清 Phase C 的填表化创建与挂载范围
- Files:
  - `docs/iterations/0287-slide-ui-mainline-split/plan.md`
  - `docs/iterations/0287-slide-ui-mainline-split/resolution.md`
- Verification:
  - 文档中必须明确：
    - 用户可通过模型表创建 slide app
    - 用户可通过模型表挂载到 Workspace
    - 这一步依赖前两阶段
- Acceptance:
  - 填表化阶段边界清晰
- Rollback:
  - 回退本 iteration 文档

## Step 4

- Scope:
  - 写清 Phase D 的 Gallery / 文档 / 取证收口范围
- Files:
  - `docs/iterations/0287-slide-ui-mainline-split/plan.md`
  - `docs/iterations/0287-slide-ui-mainline-split/resolution.md`
- Verification:
  - 文档中必须明确：
    - Gallery
    - 使用文档
    - 远端/浏览器取证
- Acceptance:
  - 收口阶段边界清晰
- Rollback:
  - 回退本 iteration 文档

## Step 5

- Scope:
  - 写清 4 个阶段的依赖顺序与不能颠倒的原因
- Files:
  - `docs/iterations/0287-slide-ui-mainline-split/plan.md`
  - `docs/iterations/0287-slide-ui-mainline-split/runlog.md`
- Verification:
  - 文档中必须显式写出：
    - 为什么先 A 再 B
    - 为什么不能先 C
    - 为什么 D 最后做
- Acceptance:
  - 主线拆分顺序具备可执行性
- Rollback:
  - 回退本 iteration 文档
