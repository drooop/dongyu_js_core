---
title: "0254 — hard-cut-cellwise-authoring-runtime Plan"
doc_type: iteration-plan
status: completed
updated: 2026-03-27
source: ai
iteration_id: 0254-hard-cut-cellwise-authoring-runtime
id: 0254-hard-cut-cellwise-authoring-runtime
phase: phase1
---

# 0254 — hard-cut-cellwise-authoring-runtime Plan

## Metadata

- ID: `0254-hard-cut-cellwise-authoring-runtime`
- Date: `2026-03-27`
- Owner: AI-assisted planning
- Branch: `dev_0254-hard-cut-cellwise-authoring-runtime`
- Working directory: `/Users/drop/codebase/cowork/dongyuapp_elysia_based`
- Depends on:
  - `0253-hard-cut-ui-authoring-and-write-contract-freeze`

## WHAT

实现新的 cellwise UI authoring runtime/compiler，使 cell/component/layout labels 能生成唯一 render target。

## Success Criteria

- cellwise labels 能编译成 renderable structure
- rich page 不再依赖手写大 AST 作为 source
- focused runtime/contract tests 存在并通过
- 选定 pilot model 能在本地真实渲染出来
