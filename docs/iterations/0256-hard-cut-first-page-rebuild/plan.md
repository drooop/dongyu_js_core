---
title: "0256 — hard-cut-first-page-rebuild Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0256-hard-cut-first-page-rebuild
id: 0256-hard-cut-first-page-rebuild
phase: phase1
---

# 0256 — hard-cut-first-page-rebuild Plan

## Metadata

- ID: `0256-hard-cut-first-page-rebuild`
- Date: `2026-03-27`
- Owner: AI-assisted planning
- Branch: `dev_0256-hard-cut-first-page-rebuild`
- Working directory: `/Users/drop/codebase/cowork/dongyuapp_elysia_based`
- Depends on:
  - `0254-hard-cut-cellwise-authoring-runtime`
  - `0255-hard-cut-bind-write-pin-only-cutover`

## WHAT

0256 不再泛指“任意首个页面重建”，而是明确做 **first writable page proof**：

- 至少包含一个可写正数 schema page
- 必须站在 `0255 transport completion` 已通过的前提上
- 必须用真实浏览器证明：
  - cellwise authoring
  - new render target
  - pin-only business write
  - live truth write-back

## Success Criteria

- 选定页面在新体系下独立成立
- 页面级浏览器证据存在，且包含真实写入动作
- 页面动作后的 live truth label 能被 `/snapshot` 观测到
- 不依赖旧手写 page AST authoring
