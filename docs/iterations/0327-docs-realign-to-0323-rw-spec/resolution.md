---
title: "0327 — docs-realign-to-0323-rw-spec Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-04-22
source: ai
iteration_id: 0327-docs-realign-to-0323-rw-spec
id: 0327-docs-realign-to-0323-rw-spec
phase: phase1
---

# 0327 — docs-realign-to-0323-rw-spec Resolution

## Execution Strategy

1. 建 grep inventory，锁定仍滞后的高优先级文案
2. 改 `CLAUDE.md`
3. 改 `docs/WORKFLOW.md`
4. 改 `docs/handover/dam-worker-guide.md`
5. 跑 audit + grep 复核并填 runlog

## Step 1 — Inventory

- Commands:
  - `rg -n "UI events write mailbox only|go through mailbox|editor_mailbox|0,0,1|0,1,1|POST /ui_event|helper scaffold|0,1,0|Superseded|superseded by" CLAUDE.md docs/WORKFLOW.md docs/handover/dam-worker-guide.md docs/user-guide/modeltable_user_guide.md docs/ITERATIONS.md`
- Acceptance:
  - 需要改的旧口径有清单

## Step 2 — CLAUDE.md

- Files:
  - `CLAUDE.md`
- Changes:
  - `UI events write mailbox only` 改成 `UI events enter via Model 0 (0,0,0) pin.bus.in`
  - `UI direct bus connection (must go through mailbox)` 改成 `must go through Model 0 pin.bus.in`
  - `Model -1` / `(0,0,1)` / `(0,1,1)` 的说明改成 historical / reserved wording，不再表述成 current mailbox truth
- Verification:
  - `rg -n "UI events write mailbox only|UI direct bus connection .*mailbox|editor_mailbox|0,0,1|0,1,1" CLAUDE.md`

## Step 3 — WORKFLOW

- Files:
  - `docs/WORKFLOW.md`
- Changes:
  - 新增 `Superseded` / `Superseded-by-<id>` 语义说明
  - 说明与 `Completed` 的区别
  - 明确 `docs/ITERATIONS.md` 的记录方式（例如 `Superseded-by-0326`）
  - 规范化一条已存在的 superseded 历史记录（`0246-home-crud-pin-migration-pilot`）
- Verification:
  - `rg -n "Status.*Superseded / Superseded-by-<id>" docs/ITERATIONS.md`
  - `rg -n "Superseded|Superseded-by-<id>|superseded by" docs/WORKFLOW.md`
  - `rg -n "^\\| 0246-home-crud-pin-migration-pilot .*\\| Superseded-by-0249 \\||superseded by 0249" docs/ITERATIONS.md`

## Step 4 — Handover + User Guide

- Files:
  - `docs/handover/dam-worker-guide.md`
  - `docs/user-guide/modeltable_user_guide.md`
- Changes:
  - 把拓扑图与正文里的 `POST /ui_event`、`editor_mailbox`、历史 BUS 名称改成 current truth/compat 口径
  - 新增或改写 model.table 三程序与 helper 退役说明
  - 保留 handover 视角，但不覆盖 SSOT
  - 用户指南里 mailbox / helper / current input path 改成与 0326 current truth 一致
- Verification:
  - `rg -n "POST /ui_event|editor_mailbox|helper scaffold|0,1,0|mt_bus_receive|mt_bus_send|mt_write|UI 只能写 event mailbox" docs/handover/dam-worker-guide.md docs/user-guide/modeltable_user_guide.md`

## Step 5 — Audit + Runlog

- Commands:
  - `node scripts/ops/obsidian_docs_audit.mjs --root docs`
  - 复跑 Step 1 grep
- Acceptance:
  - docs audit PASS
  - 旧口径只在明确历史说明中保留
