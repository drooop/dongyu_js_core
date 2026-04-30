---
title: "Data Models Fill-Table Guide"
doc_type: user-guide
status: active
updated: 2026-04-29
source: ai
---

# Data Models Fill-Table Guide

This guide explains the Feishu-aligned target contract for writing and using `Data.*` models through ModelTable labels.

Authoritative contract:
- `docs/ssot/feishu_data_model_contract_v1.md`
- `docs/ssot/data_model_tier2_implementation_v1.md`

Important status:
- The 0348 contract is the target contract.
- 0349 defines how to implement this target as Tier 2 fill-table templates and programs.
- Current templates may still lag behind this guide until a later implementation iteration migrates them.
- Do not use 0296-era examples as new authoring guidance where they conflict with this guide.

## 1. Temporary Message Versus Formal Persistence

Data model pins carry Temporary ModelTable Message records.

```text
format is ModelTable-like; persistence is explicit materialization
```

Meaning:
- The payload is a `{id,p,r,c,k,t,v}` record array.
- `id` in the payload is message-local; it is 不是正式 `model_id`.
- Writing a payload to a pin does not create or update the formal ModelTable by itself.
- Persistence happens only after 正式 materialization by the receiving data model into its own cells.

## 2. Generic Data Pins

All Feishu-aligned data models use generic data pins:

| pin name | direction | meaning |
|---|---|---|
| `add_data:in` | `pin.in` | add data |
| `delete_data:in` | `pin.in` | delete data |
| `update_data:in` | `pin.in` | update data |
| `get_data:in` | `pin.in` | get one item |
| `get_data:out` | `pin.out` | one-item result |
| `get_all_data:in` | `pin.in` | get all items |
| `get_all_data:out` | `pin.out` | all-item result |
| `get_size:in` | `pin.in` | get size |
| `get_size:out` | `pin.out` | size result |

Superseded names:
- `add_data_in`
- `get_data_out`
- `enqueue_data_in`
- `dequeue_data_in`
- `push_data_in`
- `pop_data_in`
- `peek_data_in`

Those names may still appear in current implementation artifacts, but they are not the target authoring contract.

## 3. Data.Single

`Data.Single` is the primitive element type.

Example message / element shape:

```json
[
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "model_type", "t": "model.single", "v": "Data.Single" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "参数1", "t": "str", "v": "" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "参数2", "t": "str", "v": "" }
]
```

Do not treat a single `value` label as the whole target contract. A data item can carry multiple labels.

## 4. Data.Array

`Data.Array` is a family name. New authoring should choose a dimensional type.

### Data.Array.One

Use for a one-dimensional array.

Root labels:
- `model_type`: `model.table`, value `Data.Array.One`
- `max_r`: largest used row

Element placement:
- Data starts at `(0,1,0)`.
- Each occupied element cell is a `Data.Single`.

### Data.Array.Two

Use for a two-dimensional array on page `0`.

Root labels:
- `model_type`: `model.table`, value `Data.Array.Two`
- `max_r`
- `max_c`

Each occupied element cell is a `Data.Single`.

### Data.Array.Three

Use for a three-dimensional array.

Root labels:
- `model_type`: `model.table`, value `Data.Array.Three`
- `max_p`
- `max_r`
- `max_c`

Additional pages may record their own `max_r` and `max_c`.

## 5. Data.Queue

Use for FIFO data.

Root labels:
- `model_type`: `model.table`, value `Data.Queue`
- `size_now`
- `start_pos`
- `end_pos`

Behavior:
- Write from top to bottom.
- Read from top to bottom.
- Each queued item is a `Data.Single`.

## 6. Data.Stack

Use for LIFO data.

Root labels:
- `model_type`: `model.table`, value `Data.Stack`
- `size_now`

Behavior:
- Write from top to bottom.
- Read from bottom to top.
- Each stack item is a `Data.Single`.

## 7. Data.CircularBuffer

Use for a fixed-size circular buffer.

Root labels:
- `model_type`: `model.table`, value `Data.CircularBuffer`
- `size_now`
- `start_pos`
- `end_pos`
- `size_max`

Behavior:
- Insert at the tail.
- Read from the head.
- If insertion exceeds range, the operation errors.
- Each buffer item is a `Data.Single`.

## 8. Data.LinkedList

Use for linked list data.

Root labels:
- `model_type`: `model.table`, value `Data.LinkedList`
- `size_now`
- `start_node`
- `last_pos`

Node labels:
- each node is a `Data.Single`
- each node carries `next_node`

## 9. Data.FlowTicket

Use for workflow ticket storage.

Root labels:
- `model_type`: `model.table`, value `Data.FlowTicket`
- `workorderSize`

Ticket row labels:
- `~STATUS~`
- `ticket_id`
- `flow_model`
- `now_ticket_r`

Step row labels:
- `~StepName~`
- business parameter labels
- `~next_step~` when a transfer step records branch direction

This guide only freezes the data shape. Flow execution is separate.

## 10. Migration Notes

Do not copy current `data_array_v0`, `data_queue_v0`, or `data_stack_v0` templates as new canonical examples if they conflict with this guide.

New Data.* templates should follow `docs/ssot/data_model_tier2_implementation_v1.md`:
- `Data.Single` is a `model.single` element cell.
- Collection-like Data.* models are Tier 2 `model.table` or `model.matrix` definitions.
- Public pins use colon names only.
- Payloads are Temporary ModelTable Message arrays.
- Persistence happens only after explicit materialization by the receiving data model.

Known implementation debt:
- `Data.Array` should be split into `Data.Array.One/Two/Three`.
- Queue should use `start_pos/end_pos`, not only `next_index`.
- Stack should not require `next_index` as target metadata.
- CircularBuffer should error on overflow, not overwrite by default.
- Rows should carry `Data.Single` element cells, not only one `value` label.
