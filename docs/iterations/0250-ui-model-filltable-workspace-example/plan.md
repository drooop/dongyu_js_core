---
title: "0250 — ui-model-filltable-workspace-example Plan"
doc_type: iteration-plan
status: completed
updated: 2026-03-27
source: ai
iteration_id: 0250-ui-model-filltable-workspace-example
id: 0250-ui-model-filltable-workspace-example
phase: phase1
---

# 0250 — ui-model-filltable-workspace-example Plan

## Metadata

- ID: `0250-ui-model-filltable-workspace-example`
- Date: `2026-03-26`
- Owner: AI-assisted planning
- Branch: `dev_0250-ui-model-filltable-workspace-example`
- Working directory: `/Users/drop/codebase/cowork/dongyuapp_elysia_based`
- Depends on:
  - `0215-ui-model-tier2-examples-v1`
  - `0245-scoped-privilege-runtime-and-regression`
  - `0248-cross-model-pin-owner-materialization-runtime-and-regression`

## WHAT

本 iteration 只做 docs-only 收口，目标是把 `docs/user-guide/ui_model_filltable_workspace_example.md` 从旧混合口径改成当前可裁决版本：

1. 把文档目标收窄到当前界面真实可做的能力：
   - 在 Home 中逐条填写 label
   - 仅修改已存在、已挂载的正数 UI model
2. 给出 `1003` 与 `1004` 的 label-by-label 示例
3. 删除任何会暗示“当前界面可新建 model / 新挂 Workspace mount”的内容

## WHY

旧文档同时混入了三种时代的口径：

- repo 内部 patch import
- `0242` 当时的本地 UI 示例
- 新规约下的 owner/dataflow 约束

结果是：

- 用户会把旧文误读成 patch/contract 教程
- 用户会把“修改已有 UI model”和“创建新 Workspace 结构”混成一类能力
- 用户会期待当前界面已经支持 `-25` 挂载与新 model 创建

本 iteration 的目标就是把这些边界重新写清楚。

## Scope

### In Scope

- 重写 `docs/user-guide/ui_model_filltable_workspace_example.md`
- 更新 `docs/user-guide/README.md` 索引描述
- 在 `docs/ITERATIONS.md` 登记本 iteration
- 在 runlog 中记录 living docs review 结论

### Out Of Scope

- 不修改 runtime
- 不修改 server filltable policy
- 不新增新的 Workspace example model
- 不新增界面侧 create_model / mount capability
- 不运行代码/测试；本轮按 docs-only 轨道完成

## Invariants / Constraints

- `CLAUDE.md` 为最高优先级
- 本 iteration 属于 docs-only 收口；不进入 runtime 或 server 实现改动
- UI truth source 仍然只能来自：
  - materialized cell label
  - `page_asset_v0`
  - 显式页面目录
  - `model.submt` 挂载后的 child truth
- cross-model direct write forbidden
- cross-`model.submt` direct write forbidden
- 不把 legacy shared/root AST 升格为新的 authoritative 输入面

## Success Criteria

- 目标 user guide 明确写出：
  - 当前界面只覆盖已有正数 UI model 的 label CRUD
  - `1003` 与 `1004` 的逐条 label 示例怎么填
  - 为什么这会直接改变 Workspace 中的现有 app 显示
  - 为什么当前界面还不覆盖新建 model 与新增 Workspace 挂载
- `docs/user-guide/README.md` 与 `docs/ITERATIONS.md` 同步更新
