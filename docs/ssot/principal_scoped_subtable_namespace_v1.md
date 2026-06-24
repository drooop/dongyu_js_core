---
title: "Principal-Scoped Subtable Namespace v1"
doc_type: ssot
status: target
updated: 2026-06-23
source: ai
iteration_id: 0424-principal-subtable-ssot
---

# Principal-Scoped Subtable Namespace v1

## Positioning

This document freezes the target namespace contract for multi-user slide App isolation.

Authority:
- Below `CLAUDE.md` and architecture SSOT.
- This document owns the table/principal namespace target terms. Runtime semantics, label registry, PIN connection contract, and temporary payload contract continue to own their existing detailed domains and must reference this file for the 0424 namespace extension.
- Above implementation plans, user guides, test assets, and lower UI/server documents that describe slide App installation, snapshot visibility, or SSO-scoped state.

Status:
- This is a target SSOT for follow-up implementation.
- Current runtime still has bare positive `model_id` assumptions in several paths. Those paths become implementation debt under this contract; they are not redefined here as correct target behavior.

Conflict behavior:
- If this file conflicts with `CLAUDE.md` or architecture SSOT, the higher-priority document wins and this file must be fixed.
- If this file appears to conflict with runtime semantics, label registry, PIN connection contract, or temporary payload contract, do not choose one silently. Treat it as an SSOT alignment defect and update the relevant documents in the same iteration.
- If an implementation still uses bare `model_id`, treat it as pre-0424 behavior unless the value is explicitly scoped to the host table.

## 1. Problem Statement

The UI Server must support:

- multiple SSO users visiting `https://app.dongyudigital.com/` at the same time;
- each user seeing only the slide Apps and desktop state they are allowed to see;
- the same provider-owned slide App being installed by many users without sharing mutable state;
- the same user installing the same slide App more than once without sharing mutable state;
- App-local `model_id = 0` / `model_id = 1` values that do not collide across installed App instances.

The old global positive model id space cannot express this safely. Adding `user_id` labels inside one shared model table would only be soft filtering and is not sufficient for durable isolation.

## 2. Core Terms

### 2.1 PrincipalRef

`PrincipalRef` identifies the authenticated SSO principal for a browser session.

Rules:
- It must be derived from the server-side authenticated session.
- It must not be accepted from client-authored payload as authority.
- It should be stable enough to find the same user's desktop table across sessions.
- Public logs and UI projections should use a non-PII stable identifier or display name, not raw secrets or tokens.

Example shape:

```json
{
  "principal_id": "zitadel:123456789",
  "display_name": "yuanchen yang"
}
```

### 2.2 table_id

`table_id` is the namespace id for one ModelTable.

Canonical table classes:

| table class | example `table_id` | owner | mutable user data |
|---|---|---|---|
| Host table | `host` | UI Server / worker host | no ordinary user desktop/App state |
| User desktop table | `user:<principal_key>` | one SSO principal | yes, shell and installed App registry |
| App instance table | `app:<install_id>` | one installed slide App instance | yes, App-local state |

The exact string format may be implementation-defined, but it must be stable, opaque to ordinary App code, and collision-resistant inside one UI Server deployment.

### 2.3 ModelRef

`ModelRef` is the durable model identity:

```json
{
  "table_id": "app:install_abc",
  "model_id": 0
}
```

Rules:
- Durable references crossing any table, user, App, snapshot, payload, or persistence boundary must use `ModelRef`.
- Bare `model_id` is only valid where the surrounding table is already explicit and unambiguous.
- Runtime internals should normalize even host-table references to explicit `{ "table_id": "host", "model_id": N }`.
- A helper such as `get_current_model_id` is insufficient under this contract; follow-up implementation should expose `get_current_model_ref` or equivalent.

### 2.4 TableRef

`TableRef` identifies a ModelTable namespace and its owner metadata:

```json
{
  "table_id": "app:install_abc",
  "owner_principal_id": "zitadel:123456789",
  "scope": "app_instance"
}
```

`TableRef` is used for access checks, import/export decisions, snapshot subscriptions, and diagnostics. It is not a replacement for `ModelRef`.

## 3. ID Domains

### 3.1 Negative system model domain

`model_id < 0` remains the shared host/system capability domain.

Rules:
- Negative models resolve in the host table.
- Subtables cannot define their own independent negative model domain.
- App instance tables cannot directly mutate host negative models.
- App instance tables can use host system capability only through host-exposed PIN/capability boundaries.
- Auth, bus, routing, workspace shell, provider catalog, policy, and system support stay in host/system scope.

Rationale:
- Duplicating auth, bus, and routing inside every slide App would make permissions, topic/reply routing, and system state harder to reason about.
- Shared negative system models provide one system boundary while positive App state remains isolated.

### 3.2 Non-negative table-local model domain

`model_id >= 0` is local to its `table_id`.

Rules:
- `{ "table_id": "app:A", "model_id": 1 }` and `{ "table_id": "app:B", "model_id": 1 }` are different models.
- `{ "table_id": "host", "model_id": 0 }` is the worker/root host model.
- `{ "table_id": "app:A", "model_id": 0 }` is the root model of one installed App instance.
- App packages should keep their package-local model ids during import; the installer assigns a new `table_id`, not a new global positive model id.

## 4. Table Classes And Ownership

### 4.1 Host table

The host table contains:

- worker root Model 0;
- negative system models;
- host-owned system capabilities;
- public or capability-filtered provider/App catalogs;
- host-owned bridge Cells for mounted subtables.

The host table must not store ordinary per-user foreground App state, task stack, or installed App mutable state as global truth.

### 4.2 User desktop table

Each SSO principal has one user desktop table.

It contains:

- foreground App reference;
- task stack;
- user's installed App registry;
- user shell preferences;
- user-scoped local workspace state that must survive browser reload.

Rules:
- Two simultaneous sessions for different principals must use different user desktop tables.
- Browser-local UI state may be faster and session-local, but any durable user desktop state must materialize into the principal's user desktop table.
- Guest/read-only sessions may receive a temporary or read-only desktop projection, but they must not write to another principal's desktop table.

### 4.3 App instance table

Each installed slide App instance has one App instance table.

It contains:

- the materialized imported App models;
- App-local UI and business labels;
- App-local program models;
- App-local pins and routes;
- App-local data such as color value, To Do tasks, or draft/task state that belongs to this installed instance.

Rules:
- Installing the same provider App twice creates two App instance tables.
- Installing the same provider App for two different users creates two App instance tables.
- Provider-owned source assets remain provider assets; installed App instance tables are local materializations owned by the installing principal.

## 5. `model.subtable`

`model.subtable` is the target label type for mounting a child ModelTable namespace.

It is not an alias of `model.submt`.

Comparison:

| label.t | meaning | value points to | id namespace |
|---|---|---|---|
| `model.submt` | mount one child model | child `model_id` | same table as parent/child relation |
| `model.subtable` | mount one child ModelTable | child `table_id` and root `model_id` | child table has independent model id domain |

Target value shape:

```json
{
  "table_id": "app:install_abc",
  "root_model_id": 0,
  "mount_kind": "slide_app_instance",
  "owner_principal_id": "zitadel:123456789"
}
```

Placement:
- `model.subtable` is written on a host-table hosting Cell.
- The hosting Cell may also declare ordinary boundary pins.
- The mounted child table must have an explicit root model, normally `{ "table_id": "...", "model_id": 0 }`.

Deletion:
- Removing `model.subtable` removes the host mount relation.
- It must not silently delete the child table data unless an explicit uninstall/materialization rule also deletes that table.
- Uninstall must define and execute an explicit cleanup plan for host labels, user desktop registry entries, and App instance table data.

## 6. PIN Boundary

`pin.connect.cell` remains intra-table only.

Cross-table routing must pass through a host-owned boundary:

```text
host table Model 0 / parent model
  -> host table hosting Cell with model.subtable
  -> app table root model pin.in
  -> app table internal pin.connect.cell
  -> app table internal Cell / function
  -> app table root pin.out
  -> host table hosting Cell pin.out
  -> host table pin.connect.cell
```

Rules:
- No `pin.connect.model`.
- No cross-table `[modelId, pin]` endpoint.
- No `pin.connect.cell` endpoint may name another `table_id`.
- Child table non-root Cells cannot connect directly to the host table.
- Host routing may only connect to boundary pins declared on the hosting Cell and the child table root.

## 7. Snapshot And SSE

Client-visible snapshot and SSE subscriptions must become table-qualified.

Target terms:
- `visibleModelIds` becomes `visibleModelRefs`.
- Query/wire encoding must preserve both `table_id` and `model_id`.
- Projection cache keys must become `table_id / model_id / p / r / c / k`.

Rules:
- `bootstrap` returns only the current principal's shell and allowed App index.
- `visible` returns only requested `ModelRef` bodies that the current principal may access.
- A client cannot subscribe to another principal's user desktop table or App instance table.
- Principal or capability change invalidates the current profile baseline and requires a same-profile reset.
- Patch generation must filter by principal, capability, profile, and visible `ModelRef` before diffing.

## 8. Import And Export

Slide App import/export must preserve package-local non-negative model ids.

Rules:
- A package may contain local models such as `0`, `1`, and `2`; these are package-local ids.
- During install, the host assigns a new `table_id` and materializes package records into that App instance table.
- The installer must not remap package-local positive ids into a global positive pool.
- Package-authored references inside the package may omit `table_id` only when they are explicitly local to the package table.
- Package content must not author host-owned `table_id`, host negative models, `pin.bus.*`, `pin.connect.model`, or host-owned reply targets.
- Export of an installed App should either:
  - export package-local ids with a symbolic local table marker; or
  - export a host-created diagnostic bundle that clearly includes concrete `table_id`.

## 9. Payload, Topic, And Reply Targets

Temporary ModelTable payloads remain ModelTable-like record arrays and remain non-materialized until explicit materialization.

Target table-qualified metadata records:

| key | t | meaning |
|---|---|---|
| `origin_table_id` | `str` | sender table namespace |
| `origin_model_id` | `int` | sender model id inside `origin_table_id` |
| `reply_target_table_id` | `str` | response target table namespace |
| `reply_target_model_id` | `int` | response target model id inside `reply_target_table_id` |
| `principal_ref` | `json` | non-authoritative diagnostic principal info; server session remains authority |

Rules:
- `origin_model_id` without `origin_table_id` is not enough for App instance traffic.
- `reply_target_model_id` without `reply_target_table_id` is not enough for App instance traffic.
- Transport topic can still be provider/worker/model/pin oriented, but local UI Server reply materialization must use table-qualified reply target records.
- Remote workers that provide stateful service must use an explicit state partition key. The App instance table id or an approved derived tenant key is the natural partition key.
- Remote workers that are stateless may ignore App state partitioning, but still must preserve table-qualified reply metadata when returning results.

## 10. SSO And Multi-User Data Isolation

Different SSO users visiting the same UI Server must not share mutable user/App state unless a separate product feature explicitly creates shared state.

Rules:
- The server-side session principal determines the user desktop table.
- Client-provided `principal_id`, `table_id`, or `owner_principal_id` is never authority by itself.
- User A and User B must be able to log in from different browsers and receive different desktop/App scopes.
- Snapshot filtering alone is not sufficient if the underlying mutable state is still one shared table. Durable user/App state must be namespace-separated first, then filtered.
- Permission checks decide which tables are visible; table namespace decides where data lives.

Minimum expected behavior:
- User A opens App X and changes its color/task state.
- User B opens the same provider App X installed under B's account.
- User B must not see User A's App instance data unless App X is explicitly a shared/collaborative App.

## 11. UI State Rules

Durable UI state must be classified before storage.

| state kind | owner table |
|---|---|
| auth/session claims | host/system session store, not ordinary App table |
| app catalog / provider index | host table or provider-owned table |
| foreground app | user desktop table |
| task stack | user desktop table |
| installed app registry | user desktop table |
| app-local business labels | App instance table |
| input draft before submit | browser-local overlay unless explicit sync is requested |
| dialog open/closed ephemeral state | browser-local overlay unless durable behavior is explicitly requested |

Rules:
- Input/dialog local state should stay browser-local by default.
- Submit must read the currently visible local value, not a stale committed label.
- Loading locks and pending operation status may be browser-local while waiting, but formal success/failure must become visible through the approved materialization path.

## 12. Implementation Follow-Up Checklist

Follow-up implementation must update at least:

- runtime model storage keys;
- parent/child and table mount maps;
- PIN route graph keys;
- persistence primary keys;
- import/export materialization;
- snapshot/SSE query and patch profiles;
- frontend projection cache keys;
- desktop foreground/task stack records;
- payload and reply target records;
- SSO authorization gates and per-principal table selection;
- docs and developer examples that currently show bare installed `model_id`.

## 13. Non-Goals

This contract does not:

- define a compatibility alias from `model.submt` to `model.subtable`;
- allow `pin.connect.model`;
- require every App to own private auth/bus/routing negative models;
- make client-supplied principal/table fields authoritative;
- decide the exact database migration SQL;
- implement collaborative/shared App state. Shared App state needs a later explicit owner and permission contract.
