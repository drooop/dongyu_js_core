---
title: "Feishu Data Model Contract v1"
doc_type: ssot
status: active
updated: 2026-04-29
source: ai
---

# Feishu Data Model Contract v1

## Purpose

This document freezes the repository target contract for `Data.*` models after re-checking the Feishu source document `软件工人模型2`.

Source:
- `https://bob3y2gxxp.feishu.cn/wiki/JYNWwQOOjiWcOLktv07cBvIVnOh`
- Iteration evidence: `docs/iterations/0348-feishu-data-model-contract-realignment/`

Authority:
- `CLAUDE.md` and higher repository SSOT still win over this file.
- This file supersedes the 0296-era Data.* shape and pin naming where they conflict.
- This file does not supersede `docs/ssot/temporary_modeltable_payload_v1.md`; 0347 remains current truth for temporary message transport and explicit materialization.

## 1. Boundary With Temporary ModelTable Message

Data-model pin payloads use Temporary ModelTable Message records.

Rules:
- Pin/event payload format remains `{id,p,r,c,k,t,v}` record arrays.
- The message is temporary and separate from the formal worker ModelTable.
- Receiving a message never persists it by itself.
- Formal persistence happens only when the receiving data model explicitly materializes labels into its own cells.
- `id` in a message remains message-local; it is not a formal `model_id`.

## 2. Data Model Placement

Feishu target:
- A data model is placed as a child matrix model or child model table inside another model.
- The data model exposes pins to its parent.
- The data model's `(0,0,0)` cell declares the data type through `model_type`.

Repository interpretation:
- The child/parent boundary still follows current `model.submt` and pin-chain rules.
- Parent models must not directly write child model internals.
- Data model behavior is Tier 2 template / program / worker behavior, not Tier 1 interpreter behavior.

## 3. Generic Data Pins

All Feishu-aligned data models expose these generic pins:

| pin name | direction | meaning |
|---|---|---|
| `add_data:in` | `pin.in` | add data |
| `delete_data:in` | `pin.in` | delete data |
| `update_data:in` | `pin.in` | update data |
| `get_data:in` | `pin.in` | query one data item |
| `get_data:out` | `pin.out` | one-item query result |
| `get_all_data:in` | `pin.in` | query all data |
| `get_all_data:out` | `pin.out` | all-data query result |
| `get_size:in` | `pin.in` | query size |
| `get_size:out` | `pin.out` | size query result |

Superseded:
- `add_data_in`, `delete_data_in`, `get_data_in`, `get_data_out`, `get_all_data_in`, `get_all_data_out`, `get_size_in`, `get_size_out`.
- Operation-specific Queue/Stack pins such as `enqueue_data_in`, `dequeue_data_in`, `push_data_in`, `pop_data_in`, `peek_data_in`.

These superseded names may remain in current implementation until a migration iteration, but they are not the target contract.

## 4. Data.Single

`Data.Single` is the primitive single-cell data model.

Canonical root / element shape:

```json
[
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "model_type", "t": "model.single", "v": "Data.Single" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "参数1", "t": "str", "v": "" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "参数2", "t": "str", "v": "" }
]
```

Rules:
- Other built-in data models are composed from `Data.Single` cells.
- A row/cell that stores only `{ k: "value", ... }` is an implementation shortcut, not the target contract.

## 5. Data.Array

Feishu splits Array by dimension. `Data.Array` by itself is only a family name or legacy shorthand in this repository after 0348.

### 5.1 Data.Array.One

Purpose:
- One-dimensional array.
- Default array form.
- Data starts at `(0,1,0)` and grows downward.

Root metadata:
- `model_type = Data.Array.One`
- `max_r`

Element cells:
- Each occupied element cell is a `Data.Single`.

### 5.2 Data.Array.Two

Purpose:
- Two-dimensional array on page `0`.
- Tracks maximum occupied row and column.

Root/page metadata:
- `model_type = Data.Array.Two`
- `max_r`
- `max_c`

Element cells:
- Each occupied element cell is a `Data.Single`.

### 5.3 Data.Array.Three

Purpose:
- Three-dimensional array.
- Data starts at `(0,1,0)` and grows across pages/rows/columns.

Root/page metadata:
- root records `model_type = Data.Array.Three`
- root records `max_p`, `max_r`, `max_c`
- additional pages may record their own `max_r` and `max_c`

Element cells:
- Each occupied element cell is a `Data.Single`.

Superseded:
- Current `Data.Array` target using only `size_now` + `next_index`.
- Current output names such as `Data.ArrayResult` as a target contract unless reintroduced by a later Feishu-compatible result model.

## 6. Data.Queue

Purpose:
- FIFO queue.
- Write top-to-bottom by column and read top-to-bottom.
- Track head and tail positions.

Root metadata:
- `model_type = Data.Queue`
- `size_now`
- `start_pos`
- `end_pos`

Element cells:
- Each queued item is a `Data.Single`.

Superseded:
- Queue implemented only as compacted rows with `next_index`.
- Queue operation-specific pins such as `enqueue_data_in`, `dequeue_data_in`, and `peek_data_in`.

## 7. Data.Stack

Purpose:
- LIFO stack.
- Write top-to-bottom by column and read bottom-to-top.
- Track the current size/head position.

Root metadata:
- `model_type = Data.Stack`
- `size_now`

Element cells:
- Each stack item is a `Data.Single`.

Source-note:
- The Feishu source example under the Stack heading shows `Data.Array`. This contract treats that as a source typo and uses `Data.Stack`.

Superseded:
- Stack implemented with `next_index` as a target requirement.
- Stack operation-specific pins such as `push_data_in`, `pop_data_in`, and `peek_data_in`.

## 8. Data.CircularBuffer

Purpose:
- Fixed-size circular buffer.
- Track head, tail, current size, and maximum size.
- Insert at the tail and read from the head.
- If insertion exceeds range, the operation errors.

Root metadata:
- `model_type = Data.CircularBuffer`
- `size_now`
- `start_pos`
- `end_pos`
- `size_max`

Element cells:
- Each buffer item is a `Data.Single`.

Source-note:
- The Feishu source example under the CircularBuffer heading shows `Data.Queue`. This contract treats that as a source typo and uses `Data.CircularBuffer`.

Superseded:
- Legacy overwrite-oldest behavior in `packages/worker-base/src/data_models.js`.

## 9. Data.LinkedList

Purpose:
- Linked list stored downward by column.
- Each node records its next-node position.

Root metadata:
- `model_type = Data.LinkedList`
- `size_now`
- `start_node`
- `last_pos`

Node cells:
- Each node is a `Data.Single`.
- Each node carries `next_node`.

## 10. Data.FlowTicket

Purpose:
- Store workflow ticket data.
- One ticket is stored per column.
- One step is stored per row/cell under that ticket column.

Root metadata:
- `model_type = Data.FlowTicket`
- `workorderSize`

Ticket row labels:
- `~STATUS~`
- `ticket_id`
- `flow_model`
- `now_ticket_r`

Step row labels:
- `~StepName~`
- business parameter labels
- `~next_step~` when a transfer step records a boolean branch result

Implementation note:
- Flow execution is not implemented by this contract.
- This contract only freezes the data model shape used by later Flow work.

## 11. Not-Yet-Supported Data Types

The Feishu source lists these as not yet supported:
- `Data.Hash`
- `Data.Tree`
- `Data.AVLTree`
- `Data.MaxHeap`
- `Data.MinHeap`

They are reserved planning inputs, not current implementation targets.

## 12. Migration Impact

Current 0296-era artifacts should be treated as implementation debt where they conflict with this file:
- `docs/iterations/0296-foundation-c-data-models/*`
- `docs/user-guide/data_models_filltable_guide.md`
- `packages/worker-base/system-models/templates/data_array_v0.json`
- `packages/worker-base/system-models/templates/data_queue_v0.json`
- `packages/worker-base/system-models/templates/data_stack_v0.json`
- `scripts/fixtures/0190_data_array_cases.json`
- `scripts/fixtures/0296_data_model_cases.json`

Future implementation should migrate templates and tests to this contract instead of adding compatibility aliases, unless a user explicitly approves a compatibility period.
