---
title: "Iteration 0425 Principal-Scoped Subtable Implementation Resolution"
doc_type: iteration-resolution
status: completed
updated: 2026-06-24
source: ai
iteration_id: 0425-principal-subtable-impl
id: 0425-principal-subtable-impl
phase: completed
---

# Iteration 0425-principal-subtable-impl Resolution

## Execution Strategy

Work in small TDD stages. Each stage starts with a failing test, then implements the minimum runtime/frontend change needed to pass, then runs targeted verification, then asks a sub-agent to review before continuing.

## Rollback Plan

- Stop before the next stage if a deterministic check or sub-agent review fails.
- Revert only the files touched by the failing 0425 stage; keep `runlog.md` evidence and review text.
- Do not use `model.submt` aliasing, `pin.connect.model`, host-table soft filtering, or global positive `model_id` fallback as a rollback path.
- 0425 has no remote deployment. If local stack changes fail, return the local workspace to the last passing stage and rerun `bash scripts/ops/ensure_runtime_baseline.sh` followed by `bash scripts/ops/check_runtime_baseline.sh`.
- Persistence tests must use test fixtures or local development data. If a local default store is mutated during verification, restore or reset the local development store and record the reset command in `runlog.md`.

## Stage 0: Registration And Baseline

Files:

- `docs/ITERATIONS.md`
- `docs/iterations/0425-principal-subtable-impl/plan.md`
- `docs/iterations/0425-principal-subtable-impl/resolution.md`
- `docs/iterations/0425-principal-subtable-impl/runlog.md`

Verification:

```bash
git status --short --branch
rg -n "0425-principal-subtable-impl|visibleModelRefs|ModelRef|table_id" docs/ITERATIONS.md docs/iterations/0425-principal-subtable-impl docs/ssot
```

Acceptance:

- Iteration exists before code changes.
- Existing uncommitted 0423/0424 changes are recorded as pre-existing boundary context.

## Stage 1: ModelRef Utilities And Current Table Context

Files:

- Create or modify: `packages/ui-model-demo-frontend/src/model_ref.js`
- Modify: `packages/ui-model-demo-frontend/src/snapshot_utils.js`
- Modify: `packages/ui-renderer/src/renderer.mjs`
- Modify: `packages/ui-renderer/src/renderer.js`
- Test: `scripts/tests/test_0425_model_ref_contract.mjs`

Verification:

```bash
node scripts/tests/test_0425_model_ref_contract.mjs
```

Acceptance:

- `normalizeModelRef` returns explicit `{ table_id: "host", model_id }` for host-table refs.
- `modelRefKey` distinguishes table-qualified refs.
- Snapshot label reads can resolve explicit app table refs and host refs.
- Renderer local `$label` resolution may omit `table_id` only when a current component/current ModelRef table context is already explicit.
- Omitted `table_id` never falls back to host/global bare `model_id` in App instance contexts.

## Stage 2: Runtime Table Namespace, Mounts, And PIN Route Graph

Files:

- Modify: `packages/worker-base/src/runtime.mjs`
- Modify: `packages/worker-base/src/runtime.js`
- Modify: `packages/worker-base/system-models/runtime_hierarchy_mounts.json` if existing bootstrap mount records need explicit table metadata.
- Test: `scripts/tests/test_0425_runtime_table_namespace_contract.mjs`

Verification:

```bash
node scripts/tests/test_0425_runtime_table_namespace_contract.mjs
node scripts/tests/test_cell_connect_parse.mjs
node scripts/tests/test_bus_in_out.mjs
```

Acceptance:

- Runtime model storage keys include `table_id` wherever user desktop or App instance tables can appear.
- Existing host-table models are normalized to `{ table_id: "host", model_id }` at runtime boundaries.
- `parentChildMap` keeps existing `model.submt` child-model semantics, while the new table mount map represents `model.subtable` as a child ModelTable namespace.
- `model.subtable` is rejected as a `model.submt` alias and cannot be resolved through the old child-model lookup path.
- PIN route graph endpoints include current table context.
- `pin.connect.cell` rejects cross-table endpoints and endpoints carrying `table_id`; cross-table routing can only use the host hosting Cell and child table root boundary pins.
- Negative host/system models remain host-table capabilities and cannot be directly overwritten by App instance tables.

## Stage 3: Persistence Keys For New User/App Tables

Files:

- Modify: `packages/worker-base/src/modeltable_persistence_sqlite.js`
- Modify: `packages/ui-model-demo-server/server.mjs` if server-side materialization writes need table-qualified persistence calls.
- Test: `scripts/tests/test_0425_persistence_table_key_contract.mjs`

Verification:

```bash
node scripts/tests/test_0425_persistence_table_key_contract.mjs
```

Acceptance:

- New 0425 durable writes for user desktop tables and App instance tables persist with `table_id` in the durable key.
- Two App instance tables can persist the same non-negative `model_id` without collision.
- Host-table persistence remains explicit as `table_id: "host"` at the persistence boundary.
- 0425 does not require full migration of historical records, but no new 0425 user/App table write may rely on a global positive `model_id` key.

## Stage 4: Snapshot/Profile/SSE Uses `visibleModelRefs`

Files:

- Modify: `packages/ui-model-demo-server/server.mjs`
- Modify: `packages/ui-model-demo-frontend/src/remote_store.js`
- Test: `scripts/tests/test_0425_visible_model_refs_contract.mjs`

Verification:

```bash
node scripts/tests/test_0425_visible_model_refs_contract.mjs
node scripts/tests/test_0423_snapshot_granularity_contract.mjs
```

Acceptance:

- Server accepts `visible_model_ref` / `model_ref` query records with `table_id` and `model_id`.
- Server response metadata includes `visible_model_refs`.
- Snapshot and SSE filtering rejects or removes `ModelRef` values the current principal/capability cannot access before diffing.
- Snapshot patch ops include table-qualified refs for new 0425 paths.
- Principal/capability changes invalidate the current profile baseline and emit a same-profile reset before further patches.
- Frontend builds stream/snapshot URLs with `visible_model_ref` for table-qualified refs.
- Negative tests cover User A requesting User B's desktop table and User A requesting User B's App instance table.

## Stage 5: Frontend Projection And Renderer Table-Qualified Keys

Files:

- Modify: `packages/ui-model-demo-frontend/src/remote_store.js`
- Modify: `packages/ui-model-demo-frontend/src/route_ui_projection.js`
- Modify: `packages/ui-renderer/src/renderer.mjs`
- Modify: `packages/ui-renderer/src/renderer.js`
- Test: `scripts/tests/test_0425_frontend_model_ref_projection_contract.mjs`

Verification:

```bash
node scripts/tests/test_0425_frontend_model_ref_projection_contract.mjs
node scripts/tests/test_0415_reactive_projection_store_contract.mjs
```

Acceptance:

- Projection cache keys include `table_id`, `model_id`, `p`, `r`, `c`, and `k`.
- Patch application updates only the matching table-qualified label atom.
- Same `model_id` in two App instance tables does not collide in renderer reads or route projection.
- Browser-local input/dialog state remains local unless an explicit sync label requests durable materialization.

## Stage 6: Payload And Reply Target Metadata

Files:

- Modify: `packages/ui-model-demo-server/server.mjs`
- Modify: `packages/ui-model-demo-frontend/src/remote_store.js` if needed for event payload construction.
- Test: `scripts/tests/test_0425_table_qualified_payload_reply_contract.mjs`

Verification:

```bash
node scripts/tests/test_0425_table_qualified_payload_reply_contract.mjs
node scripts/tests/test_0407_current_model_ref_contract.mjs
```

Acceptance:

- App instance traffic emits or preserves `origin_table_id` with `origin_model_id`.
- App instance response materialization requires `reply_target_table_id` with `reply_target_model_id`; bare reply model id is rejected for App instance traffic.
- Client-authored `principal_id`, `table_id`, and `owner_principal_id` are not treated as authority over the server-side session principal.
- Existing host-table traffic is normalized to explicit host table metadata at runtime boundaries.

## Stage 7: Principal-Scoped Desktop State

Files:

- Modify: `packages/ui-model-demo-server/server.mjs`
- Modify: `packages/ui-model-demo-frontend/src/desktop_app_state.js`
- Test: `scripts/tests/test_0425_principal_desktop_state_contract.mjs`

Verification:

```bash
node scripts/tests/test_0425_principal_desktop_state_contract.mjs
node scripts/tests/test_0403_principal_authorization.mjs
```

Acceptance:

- Two principals can have different foreground App and task stack without sharing mutable shell state.
- The default unauthenticated/development path is still explicit host principal context, not silent shared-user fallback.
- User desktop table selection is derived from the server-side authenticated session, not from client-authored payload.
- Tests verify different visible installed-App registries can be returned for two principals.

## Stage 8: Slide App Instance Table Materialization, Boundary, And Export

Files:

- Modify: `packages/ui-model-demo-server/server.mjs`
- Modify: `packages/ui-model-demo-frontend/src/model_ids.js` if needed for registry projection only.
- Test: `scripts/tests/test_0425_slide_app_subtable_install_contract.mjs`

Verification:

```bash
node scripts/tests/test_0425_slide_app_subtable_install_contract.mjs
node scripts/tests/test_0405_todo_slide_app_contract.mjs
node scripts/tests/test_0407_current_model_ref_contract.mjs
```

Acceptance:

- New imported App instance records include a host-owned `model.subtable` boundary descriptor.
- Package records are materialized into the assigned App instance table; the host table does not become the truth store for App-local mutable records.
- Package-local non-negative ids are preserved inside the App instance table and are not globally remapped in the new install contract path.
- Installing the same provider App twice creates two App instance tables with independent App-local mutable state.
- Installing the same provider App for two principals creates two App instance tables owned by different principals.
- Exporting an installed App instance emits package-local non-negative ids, not host-global remapped ids, and does not leak host-owned `table_id`, host negative models, or principal-only desktop state into the provider package.
- Host-created diagnostic export, if exposed separately, must be clearly marked as diagnostic and may include concrete `table_id`; it must not be the provider package export path.
- Existing ZIP import still fails visibly if required remote endpoint / target metadata is invalid.

## Stage 9: Living Docs And Developer Example Cleanup

Files:

- Review/modify as needed: `docs/ssot/runtime_semantics_modeltable_driven.md`
- Review/modify as needed: `docs/ssot/label_type_registry.md`
- Review/modify as needed: `docs/ssot/pin_connection_contract_v2.md`
- Review/modify as needed: `docs/ssot/temporary_modeltable_payload_v1.md`
- Modify: `docs/user-guide/modeltable_user_guide.md` if examples still teach installed App bare `model_id`.
- Modify: `docs/user-guide/**` files that mention installed slide App `origin_model_id`, `reply_target_model_id`, `visible_model_id`, or `get_current_model_id` without a table-qualified/current-table rule.
- Review/modify as needed: `docs/handover/dam-worker-guide.md`
- Test or verification script: `scripts/tests/test_0425_doc_examples_model_ref_contract.mjs` if the checks can be made deterministic.

Verification:

```bash
rg -n "principal_scoped_subtable_namespace_v1|model\\.subtable|visibleModelRefs|origin_table_id|reply_target_table_id|pin\\.connect\\.cell|pin\\.connect\\.model" docs/ssot/runtime_semantics_modeltable_driven.md docs/ssot/label_type_registry.md docs/ssot/pin_connection_contract_v2.md docs/ssot/temporary_modeltable_payload_v1.md docs/user-guide/modeltable_user_guide.md docs/handover/dam-worker-guide.md
rg -n "installed.*model_id|reply_target_model_id|origin_model_id|get_current_model_id|visible_model_id|visibleModelIds" docs/user-guide docs/ssot docs/iterations/0425-principal-subtable-impl docs/handover/dam-worker-guide.md
node scripts/tests/test_0425_doc_examples_model_ref_contract.mjs
```

Acceptance:

- Mandatory living docs review required by `CLAUDE.md` is completed for PIN routing, `pin.connect.*`, model type registry, runtime semantics, temporary payload, and developer guide surfaces.
- `runtime_semantics_modeltable_driven.md`, `label_type_registry.md`, `pin_connection_contract_v2.md`, and `temporary_modeltable_payload_v1.md` either reference the 0424 namespace contract accurately or record why no 0425 edit was needed.
- `modeltable_user_guide.md` and `dam-worker-guide.md` either explain table-qualified installed App identity accurately or record why no 0425 edit was needed.
- Developer-facing examples touched by installed slide App identity explain table-qualified `ModelRef` or current-table-local omission rules.
- No user-facing 0425 example asks a slide App provider to hard-code the UI Server-assigned installed `model_id`.
- If a broader historical or living document is not updated in 0425, the exact file and reason are recorded in `runlog.md` as follow-up debt, not left ambiguous.

## Stage 10: Final Local Verification

Commands:

```bash
npm -C packages/ui-model-demo-frontend run build
npm -C packages/ui-model-demo-frontend run test
node scripts/tests/test_0425_model_ref_contract.mjs
node scripts/tests/test_0425_runtime_table_namespace_contract.mjs
node scripts/tests/test_0425_persistence_table_key_contract.mjs
node scripts/tests/test_0425_visible_model_refs_contract.mjs
node scripts/tests/test_0425_frontend_model_ref_projection_contract.mjs
node scripts/tests/test_0425_table_qualified_payload_reply_contract.mjs
node scripts/tests/test_0425_principal_desktop_state_contract.mjs
node scripts/tests/test_0425_slide_app_subtable_install_contract.mjs
node scripts/tests/test_0425_doc_examples_model_ref_contract.mjs
bash scripts/ops/deploy_local.sh
bash scripts/ops/ensure_runtime_baseline.sh
bash scripts/ops/check_runtime_baseline.sh
```

Browser checks:

- Restart/redeploy the local UI stack.
- Open `http://127.0.0.1:30900/`.
- Confirm desktop loads after SSO/session state.
- Open at least one built-in App and one slid-in App.
- In two separate browser sessions, log in as two different principals and confirm foreground App, task stack, installed App registry, and same-provider App-local state are separated.
- Capture or log snapshot/SSE requests showing `visible_model_ref` / `visible_model_refs` and table-qualified patch metadata.
- Confirm no indefinite "正在加载滑动 APP..." state.

Acceptance:

- All deterministic commands pass.
- Local `deploy_local.sh` completes and rebuilds/restarts the local stack for this branch before browser verification; `ensure_runtime_baseline.sh` is not accepted as the only deploy evidence because it may exit early when the old stack is already healthy.
- Local stack health checks pass after the explicit local deploy/restart.
- Browser checks pass.
- Runlog declares test classification before running final verification: unit/contract, local stack deploy/health, browser e2e, and snapshot/SSE evidence capture.
- Runlog records the local deploy/restart command, health output, browser sessions used, and snapshot/SSE payload evidence.
- Final sub-agent review returns `APPROVED`.
