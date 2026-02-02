# Weekly Handoff (0122-0133)

This artifact is derived from repo docs only.

## Sources (SSOT)
- `docs/architecture_mantanet_and_workers.md`
- `docs/ssot/runtime_semantics_modeltable_driven.md`
- `docs/WORKFLOW.md`
- `docs/ITERATIONS.md`
- `docs/iterations/0122-*` .. `docs/iterations/0133-*`

## Current Architecture Snapshot (As Implemented)

### Worker Base (software worker runtime)
- `ModelTableRuntime` is the single source of truth (ModelTable / Cell / Label).
- Side effects are triggered only by ModelTable structural changes: `add_label` / `rm_label`.
- Persistence (sqlite) exists for replay/restore.

### Frontend (renderer-only mode and local mode)
- UI is rendered from `ui_ast_v0`.
- UI events are normalized into an envelope and written to the event mailbox cell.
- Remote mode: backend holds truth and streams snapshots; frontend submits events.

### UI AST / UI Model
- UI AST is a JSON component tree.
- UI model is expressed as labels in ModelTable and rendered via Vue3 + Element Plus.
- UI interaction policy: UI does not touch buses directly; it writes mailbox/event labels.

### Program Model / Flow Model
- Program model: loader/replay from sqlite exists (test7 yhl.db).
- Flow model: not yet implemented (explicitly out of scope / no evidence of full flow runtime).

### Buses (Control / Management)
- Control Bus: MQTT loop is validated via scripts (PIN_IN/OUT path).
- Management Bus / Dual-bus: v0 contract/harness exists (contract + loopback + optional matrix-live adapter) as a staged approach.

## Timeline (0122 -> 0133)

### 0122 Evidence-first foundation
- Extract PICtest observable behavior evidence tables.
- Define harness plan: concrete key inventory, coverage matrix, assertion rules.

### 0123 Runtime + Builtins + PIN loop + UI AST spec + renderer
- Establish ModelTable runtime semantics and built-in k validation approach.
- Validate PIN_IN/OUT + MQTT loop.
- Define UI AST spec and implement renderer mapping.

### 0127 Loader then UI/Editor
- Program model loader v0 from sqlite (test7) to rebuild ModelTable deterministically.

### 0128 UI demo frontend
- UI model demo frontend to exercise UI AST + renderer under script validation.

### 0129-0130 Editor (mailbox contract + typed values)
- Mailbox contract frozen; editor v0 validated.
- Editor v1 adds typed value normalization (additive).

### 0131-0133 Server-connected + dual-bus harness + gallery
- 0131: server-connected editor design and handoff.
- 0132: dual-bus contract/harness v0.
- 0133: UI component gallery and UI AST expansion.

## Verification Commands (from runlogs)
- `node scripts/validate_ui_renderer_v0.mjs --case all --env jsdom`
- `node scripts/validate_pin_mqtt_loop.mjs --case all`
- `node packages/ui-model-demo-frontend/scripts/validate_editor_server_static.mjs`
- `node packages/ui-model-demo-frontend/scripts/validate_editor_server_sse.mjs`
- `npm -C packages/ui-model-demo-frontend run test`
