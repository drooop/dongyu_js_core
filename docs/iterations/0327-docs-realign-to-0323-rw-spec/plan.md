---
title: "0327 — docs-realign-to-0323-rw-spec Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-22
source: ai
iteration_id: 0327-docs-realign-to-0323-rw-spec
id: 0327-docs-realign-to-0323-rw-spec
phase: phase1
---

# 0327 — docs-realign-to-0323-rw-spec Plan

## Goal

- 在 0326 已经把 bus-event ingress / imported-host egress current truth 落到代码与核心 SSOT 之后，把仍然滞后的高优先级文档统一收口：
  - `CLAUDE.md` 仍写着“UI events write mailbox only”与“must go through mailbox”，并在 model registry / reserved cells 里继续把 mailbox 写成活路径
  - `docs/WORKFLOW.md` 还没有正式定义 `Superseded` / `Superseded-by-<id>` 语义
  - `docs/handover/dam-worker-guide.md` 仍以 `POST /ui_event`、`editor_mailbox`、`BUS_IN/BUS_OUT` 历史名词为主，未把 `Model 0 pin.bus.in`、`mt_write` / `mt_bus_receive` / `mt_bus_send` 与 helper 退役说清楚
  - `docs/user-guide/modeltable_user_guide.md` 仍把 mailbox / helper scaffold 写成 current truth

## Scope

- In scope:
  - `CLAUDE.md`
  - `docs/WORKFLOW.md`
  - `docs/handover/dam-worker-guide.md`
  - `docs/user-guide/modeltable_user_guide.md`
  - `docs/ITERATIONS.md`（登记 0327；必要时补充状态说明引用）
- Out of scope:
  - 代码改动
  - 0326 已经改完的 4 篇 current-truth SSOT/user-guide
  - 0319 / 0326 / 0327 的 merge 动作本身

## Invariants / Constraints

- docs-only；不得修改 `packages/`、`scripts/`、`deploy/`
- `CLAUDE.md` 是最高优先级文档：只改过时口径，不重排顶层结构
- `docs/handover/dam-worker-guide.md` 是 handover/implementation guide，不得覆盖 `CLAUDE.md` 或 `docs/ssot/**`
- `Superseded` 状态定义必须兼容现有 `Planned / Approved / Change Requested / On Hold / Completed / Cancelled`
- 若某历史术语必须保留，只能放在显式 historical/compat 说明里，且要同时给出现行替代路径

## Success Criteria

1. `CLAUDE.md` 不再把 UI 业务事件写成“必须先落 mailbox”，也不再把 `Model -1` / `(0,0,1)` 写成 current mailbox truth
2. `CLAUDE.md` 不再把 “UI direct bus connection” 解释成“必须经 mailbox”
3. `docs/WORKFLOW.md` 与 `docs/ITERATIONS.md` 对 `Superseded` / `Superseded-by-<id>` 的记录方式一致，且至少有一条历史 row 被规范化到该状态写法
4. `docs/handover/dam-worker-guide.md` 明确：
   - frontend/server current path 是 `bus_event_v2 -> Model 0 pin.bus.in`
   - model.table `(0,0,0)` 默认三程序职责
   - `(0,1,0)` helper scaffold 对 model.table 已退役
5. `docs/user-guide/modeltable_user_guide.md` 不再把 mailbox / helper scaffold 写成 current truth
6. `node scripts/ops/obsidian_docs_audit.mjs --root docs` PASS

## Inputs

- Created at: 2026-04-22
- Iteration ID: `0327-docs-realign-to-0323-rw-spec`
- Depends on: 0326 current-truth docs与实现已收口
- Source:
  - `CLAUDE.md`
  - `docs/WORKFLOW.md`
  - `docs/handover/dam-worker-guide.md`
  - 0326 landed branch `dev_0326-ui-event-ingress-via-model0-busin`
