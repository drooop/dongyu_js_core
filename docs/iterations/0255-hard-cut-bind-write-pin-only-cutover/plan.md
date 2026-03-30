---
title: "0255 — hard-cut-bind-write-pin-only-cutover Plan"
doc_type: iteration-plan
status: completed
updated: 2026-03-27
source: ai
iteration_id: 0255-hard-cut-bind-write-pin-only-cutover
id: 0255-hard-cut-bind-write-pin-only-cutover
phase: phase1
---

# 0255 — hard-cut-bind-write-pin-only-cutover Plan

## Metadata

- ID: `0255-hard-cut-bind-write-pin-only-cutover`
- Date: `2026-03-27`
- Owner: AI-assisted planning
- Branch: `dev_0255-hard-cut-bind-write-pin-only-cutover`
- Working directory: `/Users/drop/codebase/cowork/dongyuapp_elysia_based`
- Depends on:
  - `0253-hard-cut-ui-authoring-and-write-contract-freeze`
  - `0254-hard-cut-cellwise-authoring-runtime`

## WHAT

0255 不是“全面切掉所有旧写路”的总收尾，而是先把 **generic owner intent transport** 做实：

- `ui_owner_label_update`
- `ui_owner_label_remove`

必须在 local / isolated server / live local cluster 三条路径上都一致成立。

只有 transport layer 闭环后，后续 iteration 才允许继续扩大默认 authoring write 路由。

## WHY

当前 hard-cut 主线的真实 blocker 不是 contract 不清，也不是页面 authoring 不存在，而是：

- `ui_owner_*` 在 isolated validator 中可成立
- 但在 live local cluster 中只做到 `routed_by = pin`
- target owner truth 尚未稳定 materialize

如果 transport layer 不先完成，继续扩大 schema/page 默认写路，只会制造更多“isolated 绿 / live 红”的回归。

## Success Criteria

- `ui_owner_label_update` 在 local / isolated server / live local cluster 都能真正 materialize target truth
- `ui_owner_label_remove` 在 local / isolated server / live local cluster 都能真正 remove target truth
- source -> pin route -> target owner -> truth write 整条链路在 live local 可观测
- focused write-path regression 绿色
- 本 iteration 不要求“所有页面都已切到新写路”，只要求 transport layer 成为可靠基础设施

## Non-Goals

- 不在 0255 扩大所有 schema/page 的默认写路
- 不在 0255 删除所有 legacy write path
- 不在 0255 宣告全系统 hard-cut 完成
