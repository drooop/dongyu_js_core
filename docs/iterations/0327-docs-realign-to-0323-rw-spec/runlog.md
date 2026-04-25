---
title: "0327 — docs-realign-to-0323-rw-spec Runlog"
doc_type: iteration-runlog
status: active
updated: 2026-04-22
source: ai
iteration_id: 0327-docs-realign-to-0323-rw-spec
id: 0327-docs-realign-to-0323-rw-spec
phase: phase1
---

# 0327 — docs-realign-to-0323-rw-spec Runlog

## Environment

- Date: 2026-04-22
- Branch: `dev_0327-docs-realign-to-0323-rw-spec`
- Runtime: 0326 branch `81e34c0` 已作为本迭代 docs 基线

Review Gate Record
- Iteration ID: `0327-docs-realign-to-0323-rw-spec`
- Review Date: 2026-04-22
- Review Type: AI-assisted
- Review Index: 1
- Decision: Change Requested
- Notes:
  - scope review（sub-agent `019db202-736d-7e72-a3c9-10d53590cf4f`）
  - 要求把 `docs/user-guide/modeltable_user_guide.md` 纳入范围，否则与 `docs/WORKFLOW.md` 的用户指南同步要求冲突

Review Gate Record
- Iteration ID: `0327-docs-realign-to-0323-rw-spec`
- Review Date: 2026-04-22
- Review Type: AI-assisted
- Review Index: 2
- Decision: Change Requested
- Notes:
  - current-truth review（sub-agent `019db202-79be-7e31-92ff-8b1301711861`）
  - 指出 `CLAUDE.md` 里不只两句 mailbox 标语滞后；`Model -1` / `(0,0,1)` / `(0,1,1)` 相关 current wording 也需纳入

Review Gate Record
- Iteration ID: `0327-docs-realign-to-0323-rw-spec`
- Review Date: 2026-04-22
- Review Type: AI-assisted
- Review Index: 3
- Decision: Change Requested
- Notes:
  - workflow/verification review（sub-agent `019db212-c3d4-7b01-811d-a1e8bc201a0e`）
  - 指出 `docs/ITERATIONS.md` 状态记录方式必须和 `docs/WORKFLOW.md` 一起定义；runlog gate 记录必须使用有效 decision 值

Review Gate Record
- Iteration ID: `0327-docs-realign-to-0323-rw-spec`
- Review Date: 2026-04-22
- Review Type: AI-assisted
- Review Index: 4
- Decision: Approved
- Notes:
  - current-truth review（sub-agent `019db202-79be-7e31-92ff-8b1301711861`）
  - 确认 `CLAUDE.md` 待改范围已扩到 registry / reserved-cell wording

Review Gate Record
- Iteration ID: `0327-docs-realign-to-0323-rw-spec`
- Review Date: 2026-04-22
- Review Type: AI-assisted
- Review Index: 5
- Decision: Approved
- Notes:
  - scope/summary review（sub-agent `019db202-736d-7e72-a3c9-10d53590cf4f`）
  - 确认 `docs/ITERATIONS.md` 的 0327 摘要已与 plan/resolution scope 对齐

Review Gate Record
- Iteration ID: `0327-docs-realign-to-0323-rw-spec`
- Review Date: 2026-04-22
- Review Type: AI-assisted
- Review Index: 6
- Decision: Approved
- Notes:
  - phase1-final review（sub-agent `019db22e-99e0-78a2-9a4c-20790f2acd5c`）
  - 确认 0326 Completed 前置、`superseded by` inventory、`modeltable_user_guide` scope 均已纳入，phase1 docs 已足够进入 phase3

## Planning Record

### Record 1 — Recreated from 0326-complete baseline (2026-04-22)

- Inputs reviewed:
  - `CLAUDE.md`
  - `docs/WORKFLOW.md`
  - `docs/handover/dam-worker-guide.md`
  - `docs/user-guide/modeltable_user_guide.md`
  - `docs/ITERATIONS.md`
  - 0326 landed branch `dev_0326-ui-event-ingress-via-model0-busin`
- Locked conclusions:
  - 0327 只做 docs-only
  - 0326 已经覆盖 `runtime_semantics` / `imported_slide_app_host_ingress_semantics_v1` / `mt_v0_patch_ops` / `slide_delivery`
  - 0327 不重复这些 0326 living docs，而是收口最高优先级文档、用户指南与 handover

## Gate Status

- Current status: **APPROVED**
- Basis:
  - Review 1-3 的 `Change Requested` 已全部吸收进 phase1 docs
  - Review 4-6 为最近连续 3 次 `Approved`

## Execution Records

### Step 1

- Command:
  - `rg -n "UI events write mailbox only|go through mailbox|editor_mailbox|0,0,1|0,1,1|POST /ui_event|helper scaffold|0,1,0|Superseded|superseded by" CLAUDE.md docs/WORKFLOW.md docs/handover/dam-worker-guide.md docs/user-guide/modeltable_user_guide.md docs/ITERATIONS.md`
- Key output:
  - 命中 `CLAUDE.md` mailbox / reserved-cell wording
  - 命中 `docs/WORKFLOW.md` 缺失 `Superseded` 定义
  - 命中 `docs/handover/dam-worker-guide.md` 的 `POST /ui_event` / `editor_mailbox` / `BUS_IN/BUS_OUT`
  - 命中 `docs/user-guide/modeltable_user_guide.md` 的 mailbox / helper current wording
  - 命中 `docs/ITERATIONS.md` 的 `Cancelled (superseded by 0249)` 历史 row
- Result: PASS
- Commit:

### Step 2

- Command:
  - `rg -n "UI events write mailbox only|UI direct bus connection .*mailbox|editor_mailbox|0,0,1|0,1,1" CLAUDE.md`
- Key output:
  - 旧的 mailbox 标语已清除
  - 剩余 `(0,0,1)` / `(0,1,1)` 命中只保留为 compat / deprecated / historical 说明
- Result: PASS
- Commit:

### Step 3

- Command:
  - `rg -n "Status.*Superseded / Superseded-by-<id>" docs/ITERATIONS.md`
  - `rg -n "Superseded|Superseded-by-<id>|superseded by" docs/WORKFLOW.md`
  - `rg -n "^\\| 0246-home-crud-pin-migration-pilot .*\\| Superseded-by-0249 \\||superseded by 0249" docs/ITERATIONS.md`
- Key output:
  - `docs/ITERATIONS.md` 头部状态说明包含 `Superseded / Superseded-by-<id>`
  - `docs/WORKFLOW.md` 新增 `Superseded` 专节
  - `0246-home-crud-pin-migration-pilot` 已规范化为 `Superseded-by-0249`
- Result: PASS
- Commit:

### Step 4

- Command:
  - `rg -n "POST /ui_event|editor_mailbox|helper scaffold|0,1,0|mt_bus_receive|mt_bus_send|mt_write|UI 只能写 event mailbox" docs/handover/dam-worker-guide.md docs/user-guide/modeltable_user_guide.md`
- Key output:
  - `POST /ui_event` / `editor_mailbox` 已清除
  - `mt_write` / `mt_bus_receive` / `mt_bus_send` 命中存在且作为 current wording
  - helper 仅保留为 retired / historical 说明
- Result: PASS
- Commit:

### Step 5

- Command:
  - `node scripts/ops/obsidian_docs_audit.mjs --root docs`
- Key output:
  - `missing_required_frontmatter_docs: 0`
  - `with_markdown_md_links_docs: 0`
  - `with_bare_md_paths_docs: 0`
- Result: PASS
- Commit:

## Docs Updated

- [x] `CLAUDE.md`
- [x] `docs/WORKFLOW.md`
- [x] `docs/handover/dam-worker-guide.md`
- [x] `docs/user-guide/modeltable_user_guide.md`
- [x] `docs/ITERATIONS.md`
