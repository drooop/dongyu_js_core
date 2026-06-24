---
title: "Feishu Model Label Alignment v1"
doc_type: ssot
status: target
updated: 2026-06-24
source: feishu
iteration_id: 0428-feishu-model-label-ssot-plan
---

# Feishu Model Label Alignment v1

## Positioning

This file freezes the repo-local target interpretation of the Feishu document:

- `https://bob3y2gxxp.feishu.cn/wiki/LGsZwaXMRiHqOXkB2qocbyfwnKh`
- Focus section: `model: 模型标签`

Authority:

- Below `CLAUDE.md` and `docs/architecture_mantanet_and_workers.md`.
- This file owns the 0428 target naming and alignment decisions for model labels.
- `docs/ssot/label_type_registry.md`, `docs/ssot/runtime_semantics_modeltable_driven.md`,
  `docs/ssot/pin_connection_contract_v2.md`, and
  `docs/ssot/temporary_modeltable_payload_v1.md` remain the operational SSOTs
  until a follow-up implementation iteration updates them.

Conflict behavior:

- If current runtime or current SSOT differs from this file, treat the difference
  as implementation debt for the follow-up iteration.
- Do not add compatibility aliases to make old and new labels both work.
- If this file conflicts with `CLAUDE.md` or architecture SSOT, fix this file.

## 1. Feishu Inputs Adopted

The Feishu document establishes these target ideas:

- Every Cell has exactly one model label.
- The model label is fixed at Cell creation time.
- Deleting the model label deletes the data owned by that model boundary.
- A ModelTable can run independently.
- Main ModelTables and child ModelTables can run independently.
- A plain model cannot run independently.
- A ModelTable can have an id; a plain model should not be treated as an
  independently runnable unit.
- Child ModelTable boundary pins relay to the child table root `(0,0,0)` pins.
- A child ModelTable mount Cell may only coexist with pin labels.
- `pin.connect.model` is not part of the current repo target contract.

## 2. Decisions

### 2.1 Keep `model.table`; do not adopt `model.v1n`

Project target label:

- `model.table`

Meaning:

- Root declaration for an independently runnable ModelTable.
- Applies to host/root ModelTables and child ModelTables.
- `label.k = "model_type"`.
- `label.v` remains the domain type, for example `UI.SlideApp`,
  `Data.Array`, `Flow`, or `Doc.Markdown`.

Reason:

- `V1N` is a worker role / software-worker category, not a model form.
- Encoding worker role into a model label would mix two independent concepts.
- Worker identity remains expressed by `worker.role` and `worker.id`.

Feishu mapping:

- Feishu `model.v1n` maps to project `model.table` on the worker root table,
  plus an exact worker role label on Model 0 `(0,0,0)` where applicable:
  `k = "sys_worker_role"`, `t = "worker.role"`,
  `v = "V1N"` / `"DEM"` / `"WSM"`.

### 2.2 Keep `model.subtable` as the child ModelTable mount label

Project target label:

- `model.subtable`

Meaning:

- A host-table Cell that mounts one child ModelTable namespace.
- It is a mount/boundary label, not the child table root declaration.
- The child table root still declares `model.table`.

Target value:

```json
{
  "table_id": "app:install_abc",
  "root_model_id": 0,
  "mount_kind": "slide_app_instance",
  "owner_principal_id": "zitadel:123456789"
}
```

Rules:

- The hosting Cell may only coexist with boundary pin labels.
- Same-key and same-type pins on the hosting Cell and the child table root
  relay across the boundary.
- The child ModelTable has its own local non-negative model id space.
- Host/system negative models are not copied into the child table.
- Host/system capabilities are only reachable through explicit host-owned pins.

Feishu mapping:

- Feishu child ModelTable / child ModelTable mapping semantics map to project
  `model.subtable`.
- The project does not adopt a separate `model.subtableconnection` label.

### 2.3 Keep `model.submt` as same-table child model mount

Project target label:

- `model.submt`

Meaning:

- A Cell that mounts one same-table child model boundary.
- It is not a child ModelTable.
- It is not an alias of `model.subtable`.

Rules:

- `model.submt` remains single-parent.
- The hosting Cell may only coexist with ordinary pin labels.
- Removing `model.submt` removes the mount relation only, not necessarily the
  child data, unless an explicit deletion/materialization rule says so.

Feishu mapping:

- Feishu child model / child model mapping semantics map to project
  `model.submt`.
- The project does not adopt a separate `model.submtconnection` label.

### 2.4 Do not restore `pin.connect.model`

`pin.connect.model` is abandoned.

Rules:

- It must not be accepted as a current input.
- Feishu examples that still mention it are treated as stale examples, not as a
  target contract.
- Cross-model routing must use `model.submt` boundary pins plus
  `pin.connect.cell`.
- Cross-table routing must use `model.subtable` boundary pins plus
  table-local `pin.connect.cell` on each side.

### 2.5 Durable identity is table-qualified

Durable model references crossing any table, principal, snapshot, transport,
or persistence boundary must be table-qualified:

```json
{
  "table_id": "app:install_abc",
  "model_id": 0
}
```

Rules:

- Bare `model_id` is valid only when the surrounding table is already explicit
  and unambiguous.
- App instance traffic must carry `origin_table_id` and
  `reply_target_table_id` alongside the existing model id fields.
- Client-provided `table_id`, `principal_id`, or `owner_principal_id` is never
  authority by itself; server-side session/capability checks remain authority.

## 3. Temporary ModelTable Message Rules

### 3.1 No nested ModelTable patch in `label.v`

Formal business pin values and bus payloads remain Temporary ModelTable
messages.

Target rule:

- The message itself is a record array.
- If the message needs envelope metadata and business payload, both must be
  represented as records in the same Temporary ModelTable message.
- Do not put a second ModelTable patch / record array inside a `json` label
  such as `payload.v`, `bundle_payload.v`, or `json_patch.v`.

Allowed:

- Multiple temporary model ids in the same message.
- Temporary child model / child table records in the same message.
- `json` labels for ordinary business values such as a UI config object, a
  scalar payload, or a non-ModelTable object.

Not allowed as target contract:

- `payload: { ... }` object envelope as a business pin value.
- `payload.v = [ { id, p, r, c, k, t, v }, ... ]` nested inside a `json` label.
- `bundle_payload.v = [ ...ModelTable records... ]` as the long-term provider
  bundle response shape.

### 3.2 Recommended message shape

Use temporary `id=0` for the message envelope and separate temporary ids for
payload tables/models.

Example:

```json
[
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "__mt_payload_kind", "t": "str", "v": "pin_payload.v2" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "__mt_request_id", "t": "str", "v": "req_123" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "op_id", "t": "str", "v": "req_123" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "message_role", "t": "str", "v": "request" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "topic", "t": "str", "v": "UIPUT/ws/dam/pic/de/R1/3000/submit1" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "response_topic", "t": "str", "v": "UIPUT/ws/dam/pic/de/U1/2000/result" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "route_kind", "t": "str", "v": "control" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "bus", "t": "str", "v": "control" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "payload_model_id", "t": "int", "v": 1 },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "endpoint_worker_id", "t": "str", "v": "R1" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "endpoint_table_id", "t": "str", "v": "host" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "endpoint_model_id", "t": "int", "v": 3000 },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "endpoint_pin", "t": "str", "v": "submit1" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "origin_worker_id", "t": "str", "v": "U1" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "origin_table_id", "t": "str", "v": "app:install_abc" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "origin_model_id", "t": "int", "v": 0 },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "origin_pin", "t": "str", "v": "submit1" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "reply_target_worker_id", "t": "str", "v": "U1" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "reply_target_table_id", "t": "str", "v": "app:install_abc" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "reply_target_model_id", "t": "int", "v": 0 },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "reply_target_pin", "t": "str", "v": "result" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "timestamp", "t": "int", "v": 1782268800000 },

  { "id": 1, "p": 0, "r": 0, "c": 0, "k": "model_type", "t": "model.table", "v": "Data.UIEvent" },
  { "id": 1, "p": 0, "r": 0, "c": 0, "k": "input_text", "t": "str", "v": "hello" }
]
```

In this shape:

- `id=0` is the message envelope.
- `payload_model_id=1` points to the payload model inside the same temporary
  message.
- `id=1` is the actual business payload model.
- `topic` is the request transport target.
- `response_topic` is the response transport target and must not equal
  `topic`.
- `origin_*` and `reply_target_*` are table-qualified and must not be reduced
  to bare model ids for App instance traffic.
- Nothing is hidden inside a nested JSON patch.

### 3.3 R1 / UI Server update path

Target flow:

```text
UI App instance table
  -> app root pin.out
  -> host model.subtable boundary
  -> UI Server Model 0 pin.bus.cb.out / pin.bus.mb.out
  -> transport topic
  -> R1 ModelTable root public pin
  -> R1 program model
  -> response Temporary ModelTable message
  -> UI Server Model 0 ingress
  -> host model.subtable boundary
  -> app instance table materializer
  -> visible label update
```

Rules:

- R1 must return a Temporary ModelTable message.
- UI Server materializes the response only after validating request correlation,
  endpoint, response topic, table-qualified reply target, and capability.
- UI update data must be a temporary model / temporary child table in the same
  message, not a nested JSON patch.
- The materializer decides which records become formal labels; transport alone
  does not persist them.

## 4. Follow-Up Implementation Scope

A follow-up implementation iteration must update at least:

- `docs/ssot/label_type_registry.md`
- `docs/ssot/runtime_semantics_modeltable_driven.md`
- `docs/ssot/pin_connection_contract_v2.md`
- `docs/ssot/temporary_modeltable_payload_v1.md`
- `docs/ssot/imported_slide_app_host_ingress_semantics_v1.md`
- UI developer guides and slide app runtime examples
- runtime label validators and rejected legacy label tests
- UI Server / R1 / MBR fill-table patches
- provider bundle request/response payload shape
- browser E2E tests for installed App request/response materialization

## 5. Non-Goals

This file does not:

- implement runtime behavior;
- create compatibility aliases;
- make `model.v1n` a project-accepted `label.t`;
- make `model.subtableconnection` or `model.submtconnection` accepted
  project labels;
- restore `pin.connect.model`;
- define the final database migration SQL;
- decide collaborative/shared App state semantics.
