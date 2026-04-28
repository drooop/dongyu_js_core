---
title: "0348 — Feishu Data Model Contract Realignment Plan"
doc_type: iteration-plan
status: approved
updated: 2026-04-29
source: ai
iteration_id: 0348-feishu-data-model-contract-realignment
id: 0348-feishu-data-model-contract-realignment
phase: planning
---

# Iteration 0348-feishu-data-model-contract-realignment Plan

## Goal

- Re-check Feishu original document `软件工人模型2` and realign the repository Data.* contract to it.
- Freeze that 0347 Temporary ModelTable Message remains valid, while 0296 Data.* structure/pin choices are superseded where they differ from Feishu.
- Produce a docs-only target contract and migration plan for later implementation.

## Scope

- In scope:
- Feishu source evidence for data-model-relevant sections.
- Data model contract for:
  - `Data.Single`
  - `Data.Array.One`
  - `Data.Array.Two`
  - `Data.Array.Three`
  - `Data.Queue`
  - `Data.Stack`
  - `Data.CircularBuffer`
  - `Data.LinkedList`
  - `Data.FlowTicket`
- Canonical data model pins from Feishu:
  - `add_data:in`
  - `delete_data:in`
  - `update_data:in`
  - `get_data:in`
  - `get_data:out`
  - `get_all_data:in`
  - `get_all_data:out`
  - `get_size:in`
  - `get_size:out`
- Supersede map for current repository artifacts that still use:
  - `Data.Array`
  - operation-specific Queue/Stack pins such as `enqueue_data_in`, `dequeue_data_in`, `push_data_in`, `pop_data_in`, `peek_data_in`
  - `next_index`-based generic rows as the only data model layout
- Out of scope:
- Runtime implementation.
- Template rewrites.
- Browser/deploy verification.
- General pin family rename outside data-model pins.
- Flow engine implementation beyond `Data.FlowTicket` contract.

## Invariants / Constraints

- `CLAUDE.md` remains higher priority than Feishu source.
- 0347 remains current truth for transport: pin/event payload format is ModelTable-like and persistence is explicit materialization.
- Feishu source is adopted as the target truth for Data.* model names, layout intent, and data model pin names unless it conflicts with higher runtime safety rules.
- Feishu source has two apparent examples whose `model_type.v` does not match the section heading:
  - Stack section shows `Data.Array`.
  - CircularBuffer section shows `Data.Queue`.
  These are treated as source typos; target contract uses `Data.Stack` and `Data.CircularBuffer`.
- Existing shipped templates may remain as current implementation debt until a later implementation iteration migrates them.

## Success Criteria

- Feishu source metadata is captured with URL, token, line count, and hash without committing the full raw external document.
- A diff/audit document lists concrete differences between Feishu and repo Data.* sediment.
- A new SSOT freezes the Feishu-aligned Data.* contract.
- Existing SSOT and user-guide entry points point to the new contract and mark conflicting 0296-era details as superseded target debt.
- A deterministic docs test fails if the new Feishu Data.* contract markers disappear.
- Each stage receives sub-agent `codex-code-review` approval before the next stage starts.

## Inputs

- Created at: 2026-04-29
- Iteration ID: 0348-feishu-data-model-contract-realignment
