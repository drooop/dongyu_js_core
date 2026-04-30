---
title: "Data Model Tier 2 Implementation v1"
doc_type: ssot
status: active
updated: 2026-04-30
source: ai
---

# Data Model Tier 2 Implementation v1

## Purpose

This document defines how the Feishu-aligned `Data.*` contract should be implemented in this repository.

Authoritative inputs:

- `docs/ssot/feishu_data_model_contract_v1.md`
- `docs/ssot/temporary_modeltable_payload_v1.md`
- `CLAUDE.md`

Core rule:

```text
Data.* behavior is Tier 2 fill-table capability.
```

Runtime code must not hard-code data-structure algorithms as the canonical implementation. Runtime changes are allowed only when an interpreter bug prevents a compliant Tier 2 model from running.

## 1. Model Placement

`Data.Single`:

- Form: `model.single`
- Purpose: primitive element cell
- Typical location: inside collection-like Data.* models or inside temporary message payloads
- It may carry multiple business labels. A single `value` label is only a shortcut, not the target contract.

Collection-like Data.* models:

- Form: `model.table` or `model.matrix`, depending on the target contract.
- They expose public pins on their root.
- They own their internal cells.
- Parent models must not directly write child internals.

Target collection models:

- `Data.Array.One`
- `Data.Array.Two`
- `Data.Array.Three`
- `Data.Queue`
- `Data.Stack`
- `Data.CircularBuffer`
- `Data.LinkedList`
- `Data.FlowTicket`

## 2. Public Pin Surface

All target Data.* collection models use the generic pins from 0348:

- `add_data:in`
- `delete_data:in`
- `update_data:in`
- `get_data:in`
- `get_data:out`
- `get_all_data:in`
- `get_all_data:out`
- `get_size:in`
- `get_size:out`

The following names are not allowed in new target templates:

- `add_data_in`
- `delete_data_in`
- `get_data_in`
- `get_data_out`
- `get_all_data_in`
- `get_all_data_out`
- `get_size_in`
- `get_size_out`
- `enqueue_data_in`
- `dequeue_data_in`
- `push_data_in`
- `pop_data_in`
- `peek_data_in`

No compatibility aliases may be added unless a later iteration explicitly approves a compatibility period.

0355 implementation status:
- `Data.Array.One` has no compatibility aliases for 0296-era names.
- `data_array_v0.json` is a superseded tombstone, not a runnable fallback.
- Later data-family iterations must follow the same break-and-replace rule for
  their target type.

## 3. Payload And Materialization

Every non-empty Data.* pin value must be a Temporary ModelTable Message record array.

Rules:

- Incoming payload records use `{id,p,r,c,k,t,v}`.
- Payload `id` is message-local.
- Receiving a payload does not persist it automatically.
- The data model function validates the payload.
- The function explicitly materializes allowed labels into the model's own cells.
- Result pins emit Temporary ModelTable Message record arrays.
- Errors must be visible as ModelTable labels or result records; silent failure is not allowed.

## 4. Internal Template Pattern

A compliant Tier 2 Data.* template should contain:

1. A model root with `model_type`.
2. Root metadata required by the target contract.
3. Public `pin.in` and `pin.out` labels.
4. Internal `func.js` or `func.python` labels for operations.
5. `pin.connect.*` labels wiring public pins to internal functions.
6. Explicit error labels or error result records.
7. Tests that apply the template to at least one canonical model id and one remapped model id.

Function requirements:

- Use current-model access only.
- Use `V1N.table.addLabel` / `V1N.table.removeLabel` for formal writes inside the model table.
- Do not call legacy `ctx.writeLabel`, `ctx.getLabel`, or `ctx.rmLabel`.
- Do not depend on hard-coded canonical model ids after remapping.

## 5. Migration Order

The migration should happen in separate implementation iterations:

1. `Data.Single` and shared payload/result helpers. Implemented for the
   `Data.Array.One` slice in 0355.
2. `Data.Array.One`. Implemented in 0355 as
   `packages/worker-base/system-models/templates/data_array_one_v1.json`.
3. `Data.Array.Two` and `Data.Array.Three`.
4. `Data.Queue` and `Data.Stack`.
5. `Data.CircularBuffer`.
6. `Data.LinkedList`.
7. `Data.FlowTicket`.

Reasoning:

- `Data.Single` must stabilize before collection models can store element cells.
- `Data.Array.One` is the smallest useful replacement for 0296-era `Data.Array`.
- Queue and Stack can reuse the same generic pin parser once array semantics are stable.
- `Data.CircularBuffer` affects Matrix Debug trace and should be migrated with live verification.
- `Data.FlowTicket` has orchestration semantics and should not be mixed into generic collection migration.

## 6. Where To Use Data.* In This Project

Good fits:

- User/business collections that need formal pin-based add/query/update/delete.
- Mgmt Bus Console event timeline and route status history.
- Matrix Debug trace after migrating from the current runtime helper to Tier 2 `Data.CircularBuffer`.
- Flow execution tickets through `Data.FlowTicket`.
- Prompt/session history that must be queryable as business state.
- Remote worker task queues when the queue is the model-owned business truth.
- MBR route/event diagnostics when exposed as model-owned data.

Poor fits:

- Temporary pin/event payloads before materialization.
- Frontend local drafts, keystroke overlays, or optimistic UI state.
- Raw transport envelopes.
- Secrets and bootstrap credentials.
- UI component definitions.
- Model topology such as `model.submt` and pin wiring.
- Compatibility aliases for old Data.* pins.

## 7. Current Debt

These artifacts are known migration debt:

- `packages/worker-base/system-models/templates/data_queue_v0.json`
- `packages/worker-base/system-models/templates/data_stack_v0.json`
- `scripts/fixtures/0190_data_array_cases.json`
- `scripts/fixtures/0296_data_model_cases.json`
- `scripts/tests/test_0296_data_queue_contract.mjs`
- `scripts/tests/test_0296_data_stack_contract.mjs`
- `packages/worker-base/src/data_models.js`

Do not copy these as new canonical examples. They are useful as migration references only.

Superseded but intentionally retained as non-runnable evidence:

- `packages/worker-base/system-models/templates/data_array_v0.json`
- `scripts/tests/test_0190_data_array_contract.mjs`
- `scripts/tests/test_0190_data_array_template_patch.mjs`

## 8. Verification Expectations

Each future Data.* implementation iteration must verify:

- Template patch applies without rejection.
- Canonical model id and remapped model id both work.
- Public pins use colon names only.
- Incoming payload rejects malformed Temporary ModelTable Message records.
- Formal writes happen only after explicit materialization.
- Output pins emit Temporary ModelTable Message arrays.
- Negative tests prove legacy pin names are not accepted as target pins.
- No legacy ctx API remains in new functions.
