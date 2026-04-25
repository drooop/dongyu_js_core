---
title: "0251 — ui-modeltable-overview-format Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0251-ui-modeltable-overview-format
id: 0251-ui-modeltable-overview-format
phase: phase1
---

# 0251 — ui-modeltable-overview-format Plan

## Metadata

- ID: `0251-ui-modeltable-overview-format`
- Date: `2026-03-27`
- Owner: AI-assisted planning
- Branch: `dev_0251-ui-modeltable-overview-format`
- Working directory: `/Users/drop/codebase/cowork/dongyuapp_elysia_based`
- Depends on:
  - `0250-ui-model-filltable-workspace-example`

## WHAT

本 iteration 只做 docs-only 格式重写：

1. 保持 `0250` 已冻结的能力边界不变
2. 把 `1003` / `1004` 两段示例改成：
   - `Model <id>`
   - `Cell (p,r,c)`
   - `[k,t,v]` 列表
3. 删除“步骤说明优先”的表达，让文档更像可直接照抄的填表样例

## WHY

用户明确指出，示例文档更适合写成“完整模型表总览”，而不是操作说明。  
这次修改不是能力变更，而是让文档形式更贴近真实填表动作。

## Scope

### In Scope

- 重写 `docs/user-guide/ui_model_filltable_workspace_example.md` 中 `1003` / `1004` 两段的呈现格式
- 登记并完成本 iteration

### Out Of Scope

- 不改变 `0250` 已冻结的能力边界
- 不新增任何 create_model / mount / structural authoring 内容
- 不修改 runtime / server / frontend

## Success Criteria

- 文档中 `1003` / `1004` 都采用“完整模型表总览”样式
- 每个示例都至少按 `Cell` 分组列出 `k/t/v`
- 文档仍只覆盖“已有正数 UI model 的 label CRUD”
