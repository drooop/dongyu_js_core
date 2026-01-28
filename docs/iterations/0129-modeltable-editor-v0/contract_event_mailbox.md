# Contract: Event Mailbox & LocalBusAdapter (Editor v0)

This contract defines the event mailbox, payload shape, write policy, and LocalBusAdapter rules for iteration 0129.

## Mailbox Location
- model_id: 99 (editor-only)
- Cell: `Cell(0,0,1)`
- Labels:
  - `k="ui_event"`, `t="event"`, `v=<event envelope>`
  - `k="ui_event_error"`, `t="json"`, `v={ op_id, code, detail }`
  - `k="ui_event_last_op_id"`, `t="str"`, `v=<op_id>`

## Event Envelope (Label.v)
- Shape: `{ event_id, type, payload, source, ts }`
- `op_id` must be stored at `payload.meta.op_id`.
- `type` must equal `payload.action`.
- `source` must be fixed string `ui_renderer`.
- Determinism:
  - `event_id` must be monotonic increasing integer.
  - In tests: counter starts at 1 per test run.
  - `ts` must be fixed or excluded from hash/assertions.
- `op_id` must equal `op_${event_id}`.

## Payload (Editor Actions)
- `payload.action`:
  - `label_add` | `label_update` | `label_remove` | `cell_clear` | `submodel_create`
- `payload.target`:
  - `{ model_id, p, r, c, k? }`
- required for `label_*` and `cell_clear`; optional/ignored for `submodel_create`
- `payload.value`:
  - `{ t, v }` (required for add/update; required for submodel_create with `t="json"`; omitted for label_remove/cell_clear)
- `payload.meta`:
  - `{ op_id, reason? }` (op_id required string)

## Action → Runtime API Mapping
- `label_add`:
  - require: `target.model_id/p/r/c/k`, `value.{t,v}`
  - if `target.model_id` in `{0,99}` => `reserved_cell`
  - runtime: `addLabel(model, p, r, c, { k, t, v })`
- `label_update`:
  - same as `label_add` (overwrite)
- `label_remove`:
  - require: `target.model_id/p/r/c/k`
  - if `target.model_id` in `{0,99}` => `reserved_cell`
  - runtime: `rmLabel(model, p, r, c, k)`
- if payload.value is present, LocalBusAdapter MUST ignore it
- `cell_clear`:
  - require: `target.model_id/p/r/c`
  - if `target.model_id` in `{0,99}` => `reserved_cell`
  - runtime: iterate labels in that cell and `rmLabel` each editable label only (ignore payload.value if present)
  - forbidden or reserved labels are left intact (no error)
- payload.value MUST be ignored and MUST NOT affect error priority
- `submodel_create`:
  - require: `value.t = "json"`, `value.v = { id, name, type }`, and `id` not in `{0,99}`
  - runtime: `createModel({ id, name, type })`
  - if payload.target is present, LocalBusAdapter MUST ignore it and MUST NOT validate reserved/forbidden rules
  - LocalBusAdapter MUST check for duplicate id via `runtime.getModel(id)` before calling createModel
  - name/type must be non-empty strings; otherwise `invalid_target`
  - runtime createModel is idempotent (existing id returns existing model)

## Event Consumption Rules
- Single-slot mailbox: only one event processed at a time.
- On success: write `ui_event_last_op_id` then clear `ui_event`.
- On failure: write `ui_event_error` then clear `ui_event`.
- Idempotency: if `op_id` equals `ui_event_last_op_id`, reject with `op_id_replay`.
- State transition order (deterministic):
  - read `ui_event` -> validate -> write `ui_event_error` or `ui_event_last_op_id` -> clear `ui_event`.
- `ui_event_error` is overwritten on next failure and left intact on success (no auto-clear).

## ui_event_error Semantics (UI Visibility)
- `ui_event_error.v.op_id` MUST be the op_id of the last failing event (or `""` when op_id is missing/non-string).
- If `ui_event_error.v.op_id` is non-empty, it MUST match `op_<integer>`.
- UI MUST treat `ui_event_error` as stale when either:
  - `ui_event_error.v.op_id === ""`, or
  - both op_ids are parseable and `opNumber(ui_event_error.v.op_id) <= opNumber(ui_event_last_op_id)`, or
  - `ui_event_error.v.op_id === ui_event_last_op_id` (e.g. op_id_replay).

## Error Payload Schema (ui_event_error.v)
- Shape: `{ op_id: string, code: string, detail: string }`

## Error Codes (Fixed)
- `unknown_action` | `invalid_target` | `forbidden_k` | `forbidden_t` | `reserved_cell` | `op_id_replay`

## Error Code Mapping (Evaluation Order)
0) `invalid_target` when `payload.meta.op_id` is missing or non-string; write `ui_event_error.v.op_id = ""`
1) `op_id_replay` when `op_id` equals `ui_event_last_op_id`
2) `unknown_action` when `payload.action` missing or not in supported set
3) `invalid_target` when required fields missing or invalid types (excluding op_id schema)
4) `reserved_cell` when action uses `payload.target` and target points to reserved cells/mailbox or target.model_id in {0,99}
5) `forbidden_k` when target.k matches forbidden patterns
6) `forbidden_t` when action in {label_add,label_update} and value.t is a string but not in allowlist
7) `invalid_target` when createModel throws after pre-check (defensive; runtime does not require throws)

Hard rule:
- if action uses `payload.target` and `payload.target.model_id` in `{0,99}` => `reserved_cell`
- if action does NOT use `payload.target` (e.g. submodel_create value.id) => do not evaluate reserved_cell for target

Note: `invalid_target` has two categories: schema/shape failures (step 3) and unexpected createModel throws (step 7).

## Invalid Target Conditions (Non-exhaustive)
- missing `payload.meta.op_id` (handled in step 0)
- non-string `payload.meta.op_id` (handled in step 0)
- missing `payload.target` for `label_*` / `cell_clear`
- missing target coords (`model_id/p/r/c`) for `label_*` / `cell_clear`
- missing `target.k` for `label_add`/`label_update`/`label_remove`
- missing `payload.value` for add/update/submodel_create
- non-string `value.t`
- submodel_create with `value.t != "json"`
- submodel_create with duplicate id (runtime.getModel(id) exists)
- submodel_create with empty/non-string name/type
- createModel throws (after pre-check; defensive handling)

Note: `submodel_create` does NOT apply forbidden_t; any `value.t != "json"` is `invalid_target`.

## Reserved Labels (cell_clear exclusion)
- `ui_event`
- `ui_event_error`
- `ui_event_last_op_id`

## Editable Labels (cell_clear allowlist)
- Pseudocode:
  - `editable(label) :=`
    - `label.k NOT IN ReservedLabels`
    - `AND NOT matchForbiddenK(label.k)`
    - `AND label.t IN {"str","int","bool","json"}`

## Write Policy
- UI Writes (renderer/host):
  - Allowed: only `model_id=99 Cell(0,0,1) k="ui_event" t="event"`
  - Forbidden: any other `ui_*` / `editor_*` writes
- UI allowed mutations:
  - `addLabel` for `ui_event` only
  - `rmLabel` for `ui_event` only
- Single outstanding event:
  - UI MUST NOT write `ui_event` when it already exists.
  - Renderer/host MUST enforce this (reject overwrite).
- LocalBusAdapter Writes:
  - Allowed mailbox status:
    - `ui_event_error` (t=json), `ui_event_last_op_id` (t=str)
  - Allowed UI model derived labels (model_id=99 only):
    - `Cell(0,0,0)` `k="ui_ast_v0"` (t=json)
    - `Cell(0,1,0)` `k="snapshot_json"` (t=str)
    - `Cell(0,1,1)` `k="event_log"` (t=str)
- Model Edit Writes (editor target model):
  - Allowed `t`: `str`, `int`, `bool`, `json`
  - For `label_add`/`label_update`: if `value.t` not in allowlist => `forbidden_t`
  - Forbidden `k`:
    - `run_*`
    - `*_CONNECT`
    - `CONNECT_*`
    - `pin_in`, `pin_out`
    - `v1n_id`, `data_type`
    - `mqtt_*`, `matrix_*`

## Pattern Semantics
- `run_*`, `mqtt_*`, `matrix_*` are prefix matches (case-sensitive)
- `*_CONNECT` is suffix match (case-sensitive)
- `CONNECT_*` is prefix match (case-sensitive)
- Reserved Cells (never edit except mailbox):
  - model_id=0 `Cell(0,0,0)` config
  - model_id=0 `Cell(0,0,1)` pin registry
  - model_id=0 `Cell(0,1,1)` pin mailbox
  - model_id=99 `Cell(0,0,1)` mailbox (only `ui_event` / `ui_event_error` / `ui_event_last_op_id`)

## LocalBusAdapter Rules
- Only consumes the event mailbox and calls ModelTableRuntime API.
- Must NOT import or call MQTT/Matrix/Bus Adapter.
- UI code must NOT call ModelTableRuntime mutators directly.

## Charter Mapping Note
- `labels` is a projection of `(p,r,c,k,t,v)` records (no new semantic fields).
