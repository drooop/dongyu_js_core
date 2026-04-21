---
title: "0236 — local-home-browser-evidence-rerun Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0236-local-home-browser-evidence-rerun
id: 0236-local-home-browser-evidence-rerun
phase: phase1
---

# 0236 — local-home-browser-evidence-rerun Plan

## Metadata

- ID: `0236-local-home-browser-evidence-rerun`
- Date: `2026-03-26`
- Owner: AI-assisted planning
- Branch (registered in `docs/ITERATIONS.md`): `dropx/dev_0236-local-home-browser-evidence-rerun`
- Planning mode: `refine`
- Working directory: `/Users/drop/codebase/cowork/dongyuapp_elysia_based`
- Depends on:
  - `0235-local-home-surface-materialization-fix`
- Downstream:
  - remote line may be reconsidered only after this rerun is closed

## WHAT

本 iteration 只做一件事：在 `0235` 修复 Home surface 后，重新执行一次本地 Playwright MCP browser evidence，重新裁决 local environment 是否终于从 `not effective` 变成 `effective`。

## WHY

`0234` 已经给出了 fresh 事实：

- local gate green
- Workspace / Matrix Debug / Prompt current
- 但 Home 仍为 legacy `home-datatable`

如果 `0235` 修好了 Home，而不重新取证，local line 仍然缺少一个新的 environment-level verdict。因此需要 `0236` 作为新的 local browser rerun 裁决线。

## Scope

### In Scope

- 重跑 local Playwright MCP evidence
- 重点核对：
  - Home route
  - Workspace
  - Matrix Debug
  - Prompt
- 输出新的 local verdict：
  - `Local environment effective`
  - 或 `Local environment not effective`

### Out Of Scope

- 不再修实现代码
- 不做 remote rollout / remote browser
- 不复用 `0234` 的旧 evidence 冒充新结论

## Success Criteria

- 生成新的 canonical browser evidence pack
- Home 不再出现 legacy `home-datatable`
- 若全部 surface 对齐，则给出 `effective`
- 若仍有任一 legacy surface，则给出新的 `not effective`

## Constraints And Invariants

- 真实 Playwright MCP only
- local gate 与 fresh browser evidence 必须共同支持结论
- 不得用旧截图或 prose 代替新的 evidence pack
