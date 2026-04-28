---
title: "0348 — Feishu Data Model Diff"
doc_type: iteration-evidence
status: active
updated: 2026-04-29
source: ai
iteration_id: 0348-feishu-data-model-contract-realignment
id: 0348-feishu-data-model-contract-realignment
phase: execution
---

# Feishu Data Model Diff

## Source

- Feishu URL: `https://bob3y2gxxp.feishu.cn/wiki/JYNWwQOOjiWcOLktv07cBvIVnOh`
- Title observed from raw content: `软件工人模型2`
- Token: `JYNWwQOOjiWcOLktv07cBvIVnOh`
- Snapshot metadata: `assets/feishu_source_meta.json`
- Snapshot sha256: `115bb3e3f92ca12bd1b3844976a4b91eb3088224eb13934b14029b6a48ebc8bf`

The full raw source document is external Feishu content and is not committed. This evidence file records only the extracted facts needed for repository alignment.

## Feishu Facts Relevant To Data Models

- Program pin payloads are model data. When passed to a function, the input is a temporary model table rooted at model-table id `0`; it is separate from the worker's formal ModelTable and is not directly persisted.
- A data model is identified by `model_type` on its `(0,0,0)` cell.
- `Data.Single` is the primitive single-cell data model. Other built-in data models are composed from `Data.Single` cells.
- `Data.Array` is split into dimensional variants:
  - `Data.Array.One`
  - `Data.Array.Two`
  - `Data.Array.Three`
- `Data.Queue` stores `size_now`, `start_pos`, and `end_pos`.
- `Data.Stack` stores `size_now`; rows are read from bottom to top. The source example uses `Data.Array` under the Stack heading, which is treated as a source typo.
- `Data.CircularBuffer` stores `size_now`, `start_pos`, `end_pos`, and `size_max`; insertion beyond range is described as an error. The source example uses `Data.Queue` under the CircularBuffer heading, which is treated as a source typo.
- `Data.LinkedList` stores `size_now`, `start_node`, and `last_pos`; each node carries `next_node`.
- `Data.FlowTicket` stores one ticket per column and one step per cell/row, with a `workorderSize` root label.
- Hash, Tree, AVLTree, MaxHeap, and MinHeap are explicitly listed as not-yet-supported data types.
- Data models should be placed as a child matrix model or child model table inside another model, and expose pins to their parent.
- Feishu data-model pins are generic:
  - `add_data:in`
  - `delete_data:in`
  - `update_data:in`
  - `get_data:in`
  - `get_data:out`
  - `get_all_data:in`
  - `get_all_data:out`
  - `get_size:in`
  - `get_size:out`

## Repository Facts Before 0348

- 0347 already matches Feishu on transport/persistence boundary: pin/event transport is a Temporary ModelTable Message and formal persistence requires explicit materialization.
- 0296 limited the first formal data model family to `Data.Array / Data.Queue / Data.Stack`.
- Current templates implement:
  - `Data.Array` with root `size_now` and `next_index`
  - `Data.Queue` with root `size_now` and `next_index`
  - `Data.Stack` with root `size_now` and `next_index`
- Current data rows are simplified to a `value` label rather than full `Data.Single` element cells.
- Current repository pin names are mixed:
  - `Data.Array` uses generic-ish underscore names such as `add_data_in` and `get_data_out`.
  - `Data.Queue` uses operation-specific names such as `enqueue_data_in`, `dequeue_data_in`, and `peek_data_in`.
  - `Data.Stack` uses operation-specific names such as `push_data_in`, `pop_data_in`, and `peek_data_in`.
- `Data.LinkedList`, `Data.CircularBuffer`, and `Data.FlowTicket` are not in the current formal template family. `packages/worker-base/src/data_models.js` still contains a legacy CircularBuffer implementation with overwrite-on-overflow behavior.

## Differences To Freeze

| Area | Feishu target | Current repo sediment | 0348 recommendation |
|---|---|---|---|
| Transport persistence | Temporary model table input is separate and not directly saved | 0347 matches this | Keep 0347 unchanged |
| Element shape | Built-in data models are composed from `Data.Single` cells | Rows often store one `value` label | Supersede simplified `value`-only row as target contract |
| Array identity | `Data.Array.One/Two/Three` | `Data.Array` only | Adopt dimensional variants; keep `Data.Array` only as legacy shorthand/debt |
| Array metadata | `max_r`, `max_c`, `max_p` according to dimension | `size_now`, `next_index` | Replace target contract with Feishu metadata |
| Queue metadata | `size_now`, `start_pos`, `end_pos` | `size_now`, `next_index` plus row compaction | Adopt Feishu queue metadata |
| Stack metadata | `size_now` | `size_now`, `next_index` | Remove `next_index` from target Stack contract |
| CircularBuffer | Fixed `size_max`, insertion beyond range errors | Legacy implementation overwrites oldest item | Adopt Feishu overflow-error behavior |
| LinkedList | `start_node`, `last_pos`, per-node `next_node` | Not formalized | Add to target contract |
| FlowTicket | One ticket per column; `workorderSize` root label | Out of 0296 scope | Add target contract, implementation later |
| Pin naming | `add_data:in`, `get_data:out`, etc. | underscore and operation-specific names | Adopt Feishu names as target; mark current names as implementation debt |
| `update_data` | Present | Missing | Add to target contract |

## Recommendation

Adopt Feishu as the target truth for Data.* model structure and data-model pin names. Keep the repository's stricter runtime safety rules and 0347 Temporary ModelTable Message boundary.

Implementation should be split into a later iteration because current templates, fixtures, tests, and guides still encode 0296-era assumptions. The later implementation should migrate templates and tests rather than adding compatibility aliases unless explicitly approved.
