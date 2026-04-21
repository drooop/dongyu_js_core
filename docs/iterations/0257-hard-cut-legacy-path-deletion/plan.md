---
title: "0257 — hard-cut-legacy-path-deletion Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0257-hard-cut-legacy-path-deletion
id: 0257-hard-cut-legacy-path-deletion
phase: phase1
---

# 0257 — hard-cut-legacy-path-deletion Plan

## Metadata

- ID: `0257-hard-cut-legacy-path-deletion`
- Date: `2026-03-27`
- Owner: AI-assisted planning
- Branch: `dev_0257-hard-cut-legacy-path-deletion`
- Working directory: `/Users/drop/codebase/cowork/dongyuapp_elysia_based`
- Depends on:
  - `0256-hard-cut-first-page-rebuild`

## WHAT

0257 只在以下前提同时满足时才执行：

- `0255` transport completion 已过
- `0256` writable page browser proof 已过

然后再删除旧 authoring 和旧 direct business write 路径，完成真正 hard-cut。

## Success Criteria

- 旧手写 page AST authoring 路径删除/失效
- 旧 direct positive-model bind.write 路径删除/失效
- docs/ssot 与 user-guide 切到新体系
- 不再存在“isolated 绿但 live 仍靠旧路径”的残留
