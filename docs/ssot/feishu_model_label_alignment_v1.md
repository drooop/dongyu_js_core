---
title: "Feishu Model Label Alignment v1"
doc_type: ssot
status: target
updated: 2026-07-16
source: feishu
iteration_id: 0428-feishu-model-label-ssot-plan
---

# Feishu Model Label Alignment v1

## Positioning

This file freezes the repo-local target interpretation of the Feishu documents:

- `https://bob3y2gxxp.feishu.cn/wiki/LGsZwaXMRiHqOXkB2qocbyfwnKh`
- `https://bob3y2gxxp.feishu.cn/wiki/JYNWwQOOjiWcOLktv07cBvIVnOh`
- `https://bob3y2gxxp.feishu.cn/wiki/WBZjwY3DSil6pAkQ8DZcpsrWnUf`

Focus sections:

- `model: 模型标签`
- `Worker：软件工人类型标签`
- `pin: 引脚标签`
- Feishu source `pin_payload.v1` message structure and UI / task examples
- repo `pin_payload.v2` adoption, 0457 hard cut, and actor/bus placement

Authority:

- Below `CLAUDE.md` and `docs/architecture_mantanet_and_workers.md`.
- This file owns the 0428 target naming and alignment decisions for model labels.
- `docs/ssot/label_type_registry.md`, `docs/ssot/runtime_semantics_modeltable_driven.md`,
  `docs/ssot/pin_connection_contract_v2.md`, and
  `docs/ssot/temporary_modeltable_payload_v1.md` are the operational SSOTs.

Conflict behavior:

- If current runtime or current SSOT differs from this file, stop and reconcile
  the conflict through the iteration workflow; do not silently prefer Feishu text.
- Do not add compatibility aliases to make old and new labels both work.
- If this file conflicts with `CLAUDE.md` or architecture SSOT, fix this file.

## 1. Feishu Inputs Adopted

The Feishu documents establish these target ideas:

- Every Cell has exactly one model label.
- The model label is fixed at Cell creation time.
- Deleting the model label deletes the data owned by that model boundary.
- A ModelTable can run independently.
- Main ModelTables and child ModelTables can run independently.
- A plain model cannot run independently.
- A ModelTable can have an id; a plain model should not be treated as an
  independently runnable unit.
- Child ModelTable boundary pins relay through the parent/main
  `model.subtableconnection` Cell and the child table root `(0,0,0)` pins.
- A parent/main `model.subtableconnection` Cell may only coexist with pin
  labels.
- `pin.connect.model` is not part of the current repo target contract.
- Worker identity is expressed by `sys_worker_role / worker.role` and
  `sys_worker_id / worker.id`.
- Control-bus and management-bus communication is sent and received through
  worker pins.
- A formal bus message is ModelTable-like data, not an arbitrary JSON object.
- A message should separate envelope/version metadata, route/pin metadata, and
  business payload.
- UI operation data that does not need backend persistence does not need to be
  sent; explicit submit/refresh style operations should be sent as temporary
  ModelTable data.

Adoption notes:

- 0431 correction: Feishu `model.subtableconnection` and
  `model.submtconnection` are adopted as accepted parent-side relationship
  index `label.t` values. They are not pin wiring labels. Child-side identity
  is declared by `model.subtable` or `model.submt`; parent/main-side indexing
  is declared by `model.subtableconnection` or `model.submtconnection`.
- Feishu `pin_payload.v1` examples use `origin_pin`, `endpoint_pin`, and
  `response_pin` with full transport topic strings. The project target keeps
  `topic` and `response_topic` as explicit transport truth, while structured
  `origin_*`, `endpoint_*`, and `reply_target_*` records describe the table,
  model, worker, and pin semantics.
- Feishu examples that place the payload under a child table are adopted as the
  source idea that payload is ModelTable-shaped. The project target avoids
  nesting a second ModelTable record array inside a `json` label for formal
  business pin/bus payloads.

## 2. Decisions

### 2.1 Adopt Feishu `model.v1n` for software worker root

Project target labels:

- `model.v1n`
- `model.table`

Meaning:

- `model.v1n` declares the software worker main model table on host table Model
  0 root `(0,0,0)`.
- `model.table` remains the ordinary root declaration for independently
  runnable non-worker ModelTables.
- `label.k = "model_type"`.
- For `model.v1n`, `label.v` may be an empty string, matching the current
  Feishu examples.
- For `model.table`, `label.v` remains the domain type, for example
  `UI.SlideApp`, `Data.Array`, `Flow`, or `Doc.Markdown`.

Reason:

- The current Feishu source uses `model.v1n` for the software worker main
  model table, and the user confirmed on 2026-07-08 that this should be
  implemented according to the source.
- Worker identity remains separately expressed by `worker.role` and
  `worker.id`; `model.v1n` does not replace those labels.

Feishu mapping:

- Feishu `model.v1n` maps directly to project `model.v1n` on the worker root
  table, plus exact worker role labels on Model 0 `(0,0,0)` where applicable:
  `k = "sys_worker_role"`, `t = "worker.role"`,
  `v = "V1N"` / `"DEM"` / `"WSM"`.

### 2.2 Keep `model.subtable` as the child ModelTable declaration label and add `model.subtableconnection`

Project target labels:

- `model.subtable`
- `model.subtableconnection`

Meaning:

- `model.subtable` is written on the child ModelTable Model 0 `(0,0,0)`.
- It declares that the table is a child ModelTable.
- `model.subtableconnection` is written on the host/main/parent table side.
- It indexes one child ModelTable and points to the child `table_id` and root
  `model_id`.

Parent-side `model.subtableconnection` target value:

```json
{
  "table_id": "app:install_abc",
  "root_model_id": 0,
  "mount_kind": "slide_app_instance",
  "owner_principal_id": "zitadel:123456789"
}
```

Feishu numeric input is also current:

```json
{ "k": "model_type", "t": "model.subtableconnection", "v": 1 }
```

The numeric form means "child table id allocated by the parent table". Runtime
must normalize it to a table-qualified child table descriptor when the relation
is materialized. Temporary messages may use the same numeric value to point to
payload child ids such as `0.1`.

Rules:

- The child table root may use `model.subtable` as its effective model label.
- The parent-side connection Cell may only coexist with boundary pin labels.
- Same-key and same-type pins on the connection Cell and the child table root
  relay across the boundary.
- The child ModelTable has its own local non-negative model id space.
- Host/system negative models are not copied into the child table.
- Host/system capabilities are only reachable through explicit host-owned pins.

Feishu mapping:

- Feishu child ModelTable declaration semantics map to project
  `model.subtable`.
- Feishu child ModelTable connection/index semantics map to project
  `model.subtableconnection`.

### 2.3 Keep `model.submt` as child model declaration and add `model.submtconnection`

Project target labels:

- `model.submt`
- `model.submtconnection`

Meaning:

- `model.submt` is written inside the child model, normally on the child model
  root `(0,0,0)`.
- It declares that the model is a child model.
- `model.submtconnection` is written on the parent/main or secondary model
  side.
- It indexes one child model and points to the child `model_id`.
- Neither label is a child ModelTable.
- It is not an alias of `model.subtable`.

Rules:

- `model.submtconnection` remains single-parent for direct parent/child
  indexing.
- The parent-side connection Cell may only coexist with ordinary boundary pin
  labels.
- Removing `model.submtconnection` removes the index relation only, not
  necessarily the child data, unless an explicit deletion/materialization rule
  says so.

Feishu mapping:

- Feishu child model declaration semantics map to project `model.submt`.
- Feishu child model connection/index semantics map to project
  `model.submtconnection`.
- Feishu `model.submtconnect` is an upstream typo. The repo does not register or
  alias it; the only accepted parent-side name is `model.submtconnection`.
  Correcting Feishu itself still requires separate write authorization.

### 2.4 Do not restore `pin.connect.model`

`pin.connect.model` is abandoned.

Rules:

- It must not be accepted as a current input.
- Feishu examples that still mention it are treated as stale examples, not as a
  target contract.
- Cross-model routing must use parent-side `model.submtconnection` boundary
  pins plus
  `pin.connect.cell`.
- Cross-table routing must use parent-side `model.subtableconnection` boundary
  pins plus child table root boundary pins and
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

### 3.2 Adopted target message shape

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

Current flow:

```text
UI App instance table
  -> app root pin.out
  -> host model.subtableconnection boundary
  -> UI Server Model 0 pin.bus.cb.out / pin.bus.mb.out
  -> control: local MQTT directly to R1
     management: local Matrix/Synapse to MBR, then local MQTT to R1
  -> R1 Model -10 declared dispatcher
  -> R1 Model 3200 public pin and Tier 2 program chain
  -> response Temporary ModelTable message
  -> control: local MQTT directly to UI Server
     management: local MQTT to MBR, then local Matrix/Synapse to UI Server
  -> UI Server Model 0 ingress (exactly once)
  -> host model.subtableconnection boundary
  -> app instance table materializer
  -> visible label update
```

Rules:

- R1 must return a Temporary ModelTable message.
- MBR must not echo or bridge control responses; it bridges only management
  responses and only once.
- UI Server materializes the response only after validating request correlation,
  endpoint, response topic, table-qualified reply target, and capability.
- UI update data must be a temporary model / temporary child table in the same
  message, not a nested JSON patch.
- The materializer decides which records become formal labels; transport alone
  does not persist them.

## 4. Additional Feishu Source Review

### 4.1 `JYNW...` software-worker model document

This source is useful and should be kept as an upstream design input.

Adopted:

- Exact worker labels:
  - `k = "sys_worker_role"`, `t = "worker.role"`,
    `v = "WSM" | "DEM" | "V1N"`.
  - `k = "sys_worker_id"`, `t = "worker.id"`,
    `v = "ws/dam/pic/de/sw"`.
- Every Cell has exactly one model label and that model label owns the model
  boundary lifecycle.
- ModelTables can run independently; plain models cannot run independently.
- `model.single`, `model.matrix`, `model.subtable`, `model.subtableconnection`,
  `model.submt`, and `model.submtconnection` remain meaningful model-boundary
  and relationship-index concepts.
- `pin.in`, `pin.out`, `pin.bus.cb.*`, `pin.bus.mb.*`,
  `pin.connect.label`, and `pin.connect.cell` align with the current project
  direction.
- The same-key/same-type boundary-pin relay rule for child ModelTables maps to
  project `model.subtableconnection` parent-side connection Cell semantics plus
  child root `model.subtable` declaration semantics.

Recommended follow-up:

- Use this source when updating `label_type_registry` so the worker-role table
  and model-boundary table stay aligned.
- Update developer-facing wording from "main ModelTable" to the repo terms:
  root `model.table`, child root `model.subtable`, host/main
  `model.subtableconnection` index Cell, child root `model.submt`, and
  same-table `model.submtconnection` index Cell.

### 4.2 `WBZj...` software-worker message API document

This source is also useful and should be kept as an upstream design input.

Adopted:

- A worker-to-worker message is transmitted as one ModelTable-like message with
  message version, route/pin metadata, and payload data.
- `route_kind` distinguishes control-bus and management-bus intent.
- Control-bus messages can use local/global message server information.
- Management-bus messages can include Matrix sender/receiver user information.
- Formal UI submit, UI refresh, and task actions are payload records, not
  direct UI writes.
- Temporary UI data that is not meant to persist does not need to be sent.

Adjusted for project target:

- The source `pin_payload.v1` examples use `model.subtableconnection` as a
  relationship/index label. Their documented child ModelTable shape such as
  `0.1` is preserved as source/history evidence; current public input expresses
  the business temporary model through v2 `payload_model_id` in one flat array.
- The source examples use full topic strings in `origin_pin`, `endpoint_pin`,
  and `response_pin`. The project target separates transport truth from
  semantic endpoint truth:
  - `topic` is the current request/response transport topic.
  - `response_topic` is the response transport topic and must not equal the
    request `topic`.
  - `endpoint_worker_id` / `endpoint_table_id` / `endpoint_model_id` /
    `endpoint_pin` describe the delivery endpoint.
  - `origin_worker_id` / `origin_table_id` / `origin_model_id` / `origin_pin`
    describe where the request came from.
  - `reply_target_worker_id` / `reply_target_table_id` /
    `reply_target_model_id` / `reply_target_pin` describe where the response
    should be materialized.
0457 current supersession:

- Public Feishu Message API input accepts only a flat `pin_payload.v2`
  Temporary ModelTable record array. Legacy v1 child-table envelopes,
  `route_kind="manage"`, `response_pin`, nested payload arrays, and unknown or
  invalid root metadata fail closed before business execution.
- R1 Model 3200 is the Tier 2 owner for schema dispatch and resource/data/UI/task
  state. It exposes the documented request pins plus one generic `result:pin.out`;
  generic runtime owns only transport, PIN routing, and materialization.
- Control request/response traffic is direct between UI Server and R1 over the
  local MQTT control plane. Management request/response traffic alone crosses
  the local Matrix/Synapse MBR plane; MBR never echoes a control response.
- Local actor declarations are loaded from authoritative fill-table assets:
  MBR=`DEM`, R1=`V1N`, WM1=`DEM`, with only role-legal split-bus pins.
- F-05 remains pending: `ui.refresh_data` rejects visibly with
  `ui_action_pending:refresh_data`, writes no refresh state, and emits no result.
- F-08 remains pending: `add_task_return` rejects visibly with
  `task_action_pending:add_task_return`; the generic `result` response is not a
  dedicated `add_task_return` PIN message.

Historical implementation evidence (0442-0450; superseded by 0457):

- The source document calls this family `pin_payload.v1`; 0442 reintroduced
  `pin_payload.v1` as the then-current Feishu message API input shape while keeping
  table-qualified runtime paths for durable App instance traffic.
- 0442 validates the Feishu-current API envelope before it reaches bus ingress:
  `route_kind` accepts the source values `"control"` / `"manage"`;
  optional `message_server` must be `"local"` / `"global"`; optional
  `between` must be `"WSM_DEM"` / `"DEM_V1N"`; `manage` route messages must
  include non-empty management users; unknown `sys_msg_type` values fail
  closed; `task_data` must target one of the documented task manager pins.
- 0443 adds a narrow business dispatch point after accepted bus ingress:
  resource/data/UI/task messages are classified into handler families and
  mirrored to observable runtime labels and intercepts. This is not the final
  resource catalog, DAM persistence, UI mutation, or task-state implementation;
  those remain downstream handlers. Task messages already fail closed when a
  documented task pin is missing its required payload fields.
- 0444 implements the first downstream handler for `task_data`: it creates and
  mutates runtime task manager state for `add_task`, `edit_task`,
  `delete_task`, `receive_task`, `finish_task`, and `archive_task`, exposing
  current tasks and the last result on Model 0. It still does not synthesize
  `add_task_return`; response publishing remains bound to the existing
  `response_topic` contract.
- 0445 implements the first downstream handler for `resource.report`,
  `resource.request`, and `resource.result`: report/result payload rows update
  a visible runtime resource catalog, and request records the current catalog
  without synthesizing a response packet. Empty report/result payloads fail
  closed with `missing_resource_entries`; cross-worker result publishing
  remains bound to the existing `response_topic` contract.
- 0446 implements the first downstream handler for `data.save_modeltable`,
  `data.load_modeltable`, `data.save_flow`, and `data.load_flow`: the payload
  child table records are captured in a visible runtime data-manager store.
  ModelTable payloads require a `Data` payload root, Flow payloads require a
  `Flow` payload root, and empty data payloads fail closed. This is not DAM
  persistence, and load actions still do not synthesize response packets.
- 0447 implements the first downstream handler for `ui.update_data`,
  `ui.tmp_data`, `ui.form_data`, and `ui.refresh_data`: the payload child table
  records are captured in visible runtime UI-manager state. UI payloads require
  a `Data` payload root and at least one non-metadata record. `refresh_data`
  records pending refresh parameters but does not directly mutate UI labels or
  synthesize a response packet.
- 0448 added the first response outbox bridge from then-current
  `pin_payload.v1` requests to formal `pin_payload.v2` responses. If
  `is_need_response=true` and both `response_pin` and `endpoint_pin` are valid
  full v2 topics, runtime writes `feishu_message_api_response_out` on Model 0 as
  a `pin.bus.cb.out` response packet. The response uses
  `topic=response_topic=<response_pin>`, response endpoint metadata from
  `response_pin`, origin metadata from the request endpoint, and handler result
  records as payload. Missing/no-response or invalid response destinations are
  recorded as skipped response results and never fall back to the request topic.
- 0449 makes the response outbox delivery state observable: a running runtime
  with an MQTT client publishes the response packet through the existing
  `pin.bus.cb.out` path to `response_pin` and records
  `publish_status="published"` plus `publish_topic=<response_pin>` in
  `feishu_message_api_response_last_result`. Edit/non-running mode can prepare
  the outbox but records `publish_status="prepared_not_published"` and an empty
  `publish_topic`.
- 0450 materializes inbound formal response packets into the local reply target:
  runtime accepts `message_role="response"` on the response endpoint topic,
  checks that `reply_target_worker_id` is local, and writes payload records to
  `reply_target_table_id + reply_target_model_id` via `addLabel`. It does not
  write `pin.in` to the response endpoint model, does not re-trigger endpoint
  programs, validates all payload records before writing so invalid records do
  not leave partial materialization, and rejects foreign or missing reply targets
  without falling back to host/shared runtime.

## 5. Implementation Status And Follow-Up Boundaries

Iteration 0457 implements and locally verifies the v2 public hard cut, the R1
Model 3200 actor, role-correct MBR/R1/WM1 assets, split-bus routing, v1 rejection,
and table-qualified response materialization. Current behavior is governed by
the operational SSOT files listed above and by the versioned actor patches.

Remaining decisions are intentionally separate:

- F-04: correct the Feishu typo only after explicit Feishu write authorization;
  no repo alias is needed.
- F-05: define the authorized ModelTable write performed by `ui.refresh_data`;
  frontend remains projection-only.
- F-08: define and implement the real dedicated `add_task_return` PIN message.
- F-06/F-07 retain their existing decision states.

## 6. Non-Goals

This file does not:

- implement runtime behavior;
- create compatibility aliases;
- restore `pin.connect.model`;
- define the final database migration SQL;
- decide collaborative/shared App state semantics.
