---
title: "0349 Data Model Tier 2 Inventory"
doc_type: iteration-evidence
status: draft
updated: 2026-04-29
source: ai
---

# 0349 Data Model Tier 2 Inventory

## 1. Current Truth From 0348

0348 froze the target data model contract:

- Transport payloads are Temporary ModelTable Message record arrays.
- `format is ModelTable-like; persistence is explicit materialization`.
- Formal persistence happens only after an owner/data model program explicitly materializes labels.
- Data model behavior belongs in Tier 2 model definitions/templates/programs, not in Tier 1 interpreter code.
- Feishu-aligned target types are:
  - `Data.Single`
  - `Data.Array.One`
  - `Data.Array.Two`
  - `Data.Array.Three`
  - `Data.Queue`
  - `Data.Stack`
  - `Data.CircularBuffer`
  - `Data.LinkedList`
  - `Data.FlowTicket`
- Generic target pins are:
  - `add_data:in`
  - `delete_data:in`
  - `update_data:in`
  - `get_data:in`
  - `get_data:out`
  - `get_all_data:in`
  - `get_all_data:out`
  - `get_size:in`
  - `get_size:out`

## 2. Current Implementation Inventory

Current executable Data.* templates are 0296-era artifacts:

| Area | Current file | Current behavior | Gap to 0348 |
|---|---|---|---|
| Array | `packages/worker-base/system-models/templates/data_array_v0.json` | model `2001`, `Data.Array`, `size_now` + `next_index`, row `value` labels, underscore pins | Must split into `Data.Array.One/Two/Three`, use generic colon pins, and compose element cells from `Data.Single` |
| Queue | `packages/worker-base/system-models/templates/data_queue_v0.json` | model `2101`, compacted row queue, operation-specific pins such as `enqueue_data_in` | Must expose generic data pins, track `start_pos`/`end_pos`, and avoid operation-specific target pins |
| Stack | `packages/worker-base/system-models/templates/data_stack_v0.json` | model `2201`, row stack, operation-specific pins such as `push_data_in` | Must expose generic data pins and align output shape with Temporary ModelTable Message |
| CircularBuffer helper | `packages/worker-base/src/data_models.js` | runtime helper registered through `data_type = CircularBuffer`; overwrites oldest on overflow | Must become a Tier 2 data model if kept as formal Data.CircularBuffer; Feishu target says overflow should error |
| Matrix Debug trace | `packages/ui-model-demo-server/server.mjs`, `packages/worker-base/system-models/matrix_debug_surface.json` | creates model `-100` as `type: Data`, adds `data_type = CircularBuffer`, then calls `initDataModel` | Good candidate for later Tier 2 Data.CircularBuffer migration, but not part of 0349 implementation |

Tests that intentionally represent old behavior:

- `scripts/tests/test_0190_data_array_template_patch.mjs`
- `scripts/tests/test_0190_data_array_contract.mjs`
- `scripts/tests/test_0296_data_queue_contract.mjs`
- `scripts/tests/test_0296_data_stack_contract.mjs`
- `scripts/fixtures/0190_data_array_cases.json`
- `scripts/fixtures/0296_data_model_cases.json`

## 3. Tier 2 Implementation Direction

The target implementation should be template-first:

1. `Data.Single` is a `model.single` element cell created by fill-table records.
2. Collection-like Data.* models are `model.table` or `model.matrix` definitions created by fill-table patches, depending on the target contract.
3. The root cell declares `model_type`.
4. Public behavior is exposed only through Data.* pins.
5. Each pin receives a Temporary ModelTable Message.
6. The internal function cell reads the temporary message, validates it, then explicitly materializes allowed changes through current-model owner paths.
7. Result pins emit Temporary ModelTable Message record arrays.
8. Errors are visible as ModelTable labels and must not be silent.

Tier 1 should not gain new data-structure behavior. Runtime changes are only allowed if an existing interpreter bug prevents Tier 2 templates from expressing the contract.

## 4. Recommended Migration Order

1. `Data.Single`
   - Freeze canonical element cell shape.
   - Define how arbitrary business labels are carried.
2. `Data.Array.One`
   - Replaces current `Data.Array` as the smallest useful collection.
   - Converts row `value` shortcuts into `Data.Single` element cells.
3. `Data.Array.Two` and `Data.Array.Three`
   - Add dimensional metadata and coordinate validation.
4. `Data.Queue` and `Data.Stack`
   - Reuse generic pins.
   - Remove operation-specific target pins.
5. `Data.CircularBuffer`
   - Migrate Matrix Debug trace away from `data_type = CircularBuffer`.
   - Decide whether trace overflow should follow Feishu error semantics or remain a separate non-Data helper.
6. `Data.LinkedList`
   - Use `next_node` labels inside node cells.
7. `Data.FlowTicket`
   - Treat as orchestration state, not as generic list storage.

## 5. Good Use Cases In This Project

Data.* is a good fit when the state is user/business data and needs stable pin-based access:

- Matrix Debug event timeline, after migrating the current trace buffer to a Tier 2 `Data.CircularBuffer`.
- Mgmt Bus Console event timeline and route status history.
- Flow execution tickets and step state, through `Data.FlowTicket`.
- Prompt/session history that needs queryable append/list behavior.
- Workspace collections that are formal user data rather than static system catalogs.
- Remote worker task queues if the queue is part of the ModelTable business state.
- MBR route/event diagnostic buffers, if exposed as data models and not as raw transport logs.

## 6. Bad Use Cases / Boundaries

Data.* should not be used for:

- Temporary pin/event payloads before materialization.
- Frontend input drafts or keystroke overlays.
- Secrets and bootstrap credentials.
- Model structure itself, such as `model.submt`, pin wiring, or UI component definitions.
- Raw Matrix initial sync caches.
- Pure transport envelopes whose only role is routing.
- Hidden compatibility aliases for old pins.

## 7. Main Risks

- Copying 0296 templates directly would preserve old pins and old storage shape.
- Leaving `CircularBuffer` in `packages/worker-base/src/data_models.js` as the formal path would violate Tier 2 placement.
- Migrating Matrix Debug trace too early may break observability; it should be a separate implementation iteration with browser/remote verification.
- Adding compatibility aliases for old pins would conflict with the current "no compatibility layer without explicit approval" rule.
