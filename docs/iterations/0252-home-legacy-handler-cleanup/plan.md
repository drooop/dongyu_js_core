---
title: "0252 — home-legacy-handler-cleanup Plan"
doc_type: iteration-plan
status: completed
updated: 2026-03-27
source: ai
iteration_id: 0252-home-legacy-handler-cleanup
id: 0252-home-legacy-handler-cleanup
phase: phase1
---

# 0252 — home-legacy-handler-cleanup Plan

## Metadata

- ID: `0252-home-legacy-handler-cleanup`
- Date: `2026-03-27`
- Owner: AI-assisted planning
- Branch: `dev_0252-home-legacy-handler-cleanup`
- Working directory: `/Users/drop/codebase/cowork/dongyuapp_elysia_based`
- Depends on:
  - `0249-home-crud-pin-migration-retry-on-owner-materialization`

## WHAT

在 `0249` 已收口后，清理 `intent_handlers_home.json` 中已降级为非权威路径的 legacy `handle_home_*` direct-write 实现，避免后续维护误用旧写入路径。

## WHY

`0249` 已将 Home 业务写入 authority 收敛到 pin owner-materialization。保留旧 direct-write handler 容易造成“看起来还能用”的错误认知，增加维护与审查成本。

## Scope

### In Scope

- 移除 `packages/worker-base/system-models/intent_handlers_home.json` 中已不再权威的 legacy `handle_home_*` direct-write 逻辑
- 补齐/更新与 Home pin-only 路由一致的回归验证
- 更新 iteration runlog 与索引台账

### Out Of Scope

- 不回滚 `0249` 的 pin owner-materialization 路径
- 不改动 `0248` runtime contract
- 不扩展 Prompt / Docs / Gallery / Matrix Debug 业务面

## Success Criteria

- `intent_handlers_home.json` 不再包含 legacy `handle_home_*` direct-write 实现
- Home CRUD 相关 contract / validator 继续 PASS
- 变更说明清晰区分“非权威保留路径删除”与“权威 pin 路径保留”
