---
title: "Iteration 0417-user-isolated-ui-state-projection Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-06-18
source: ai
iteration_id: 0417-user-isolated-ui-state-projection
id: 0417-user-isolated-ui-state-projection
phase: phase1
---

# Iteration 0417-user-isolated-ui-state-projection Resolution

## Execution Strategy

Implement this iteration as a staged, test-first change.

The core architecture is:

1. Keep a shared global/system projection for built-in app definitions, provider catalog, public docs, and transport/bootstrap configuration.
2. Add a principal-selected mutable user workspace runtime for installed slide apps, app-local data, drafts, view state, and materialized response labels.
3. Add renderer/remote-store local state slots so common UI controls can remain local until submit.
4. Add scoped pending/loading state for submit-like actions.
5. Keep existing SSE and `snapshot_patch` transport, but ensure post-load local UI interactions use small projection-local events or no server event unless explicitly persisted.

No production code may be changed before Step 1 failing tests are in place.

## Step 1 — Contract Tests and Baseline Inventory

Scope:

- Add deterministic tests that describe the required behavior before implementation.
- Record current baseline failures without changing production code.
- Inventory current code paths that must change.

Files:

- Create `scripts/tests/test_0417_user_isolated_ui_state_projection_contract.mjs`.
- Modify `docs/iterations/0417-user-isolated-ui-state-projection/runlog.md`.
- No production code edits in this step.

Test cases:

- `test_principal_workspace_runtime_isolation`
  - Build or import a minimal server/runtime harness.
  - Simulate two principals: `alice` and `bob`.
  - Mutate representative `alice` user-owned state:
    - installed app registry entry;
    - app-local business label;
    - input draft/local overlay;
    - Dialog visibility;
    - selected view/tab;
    - materialized remote response label.
  - Assert `bob` does not see any of those mutations and `bob` can hold different values for the same logical app without overwriting `alice`.
- `test_guest_is_read_only`
  - Simulate unauthenticated principal.
  - Assert write/event endpoint selection rejects mutable runtime creation.
- `test_default_input_submit_policy_is_local_only`
  - Simulate typing into an Input that has no explicit realtime/debounce policy.
  - Assert no ModelTable write envelope is emitted per keystroke.
- `test_submit_reads_visible_local_overlay`
  - Type a value into local overlay.
  - Submit immediately before any delayed sync.
  - Assert exactly one formal `bus_event_v2` is emitted.
  - Assert the emitted Temporary ModelTable payload contains the visible value.
  - Assert the event enters the existing Model 0 / pin / bus path and does not direct-write the final business label from UI/server code.
  - Assert the latest value comes from the local overlay when debounce persistence has not run.
- `test_dialog_and_view_state_can_be_local_only`
  - Toggle Dialog and local page/tab state.
  - Assert business ModelTable labels are unchanged.
- `test_pending_lock_blocks_duplicate_submit`
  - Trigger submit.
  - Assert pending is visible and duplicate submit is skipped for the declared scope.
  - Resolve success/error/timeout and assert the lock clears.
- `test_local_state_does_not_force_large_snapshot_patch`
  - Apply local-only state changes after bootstrap.
  - Assert no full snapshot is required and emitted data stays under the 32KB post-load patch limit.

Conformance checks required in this step:

- Tier placement: tests must distinguish renderer/local UI state, server runtime selection, and ModelTable business truth.
- Model placement: user-owned labels and materialized responses must target the selected user runtime, not shared global runtime.
- Data ownership: global/system data and user workspace data must be asserted separately.
- Data flow: submit tests must assert UI -> `bus_event_v2` -> Model 0/pin/bus, not direct UI/server truth write.
- Data chain: tests must assert response materialization uses `reply_target_*` into the correct user runtime.

Verification:

```bash
node scripts/tests/test_0417_user_isolated_ui_state_projection_contract.mjs
```

Expected before implementation:

- FAIL for missing user runtime boundary and/or missing local state policy APIs.

Acceptance:

- Test file exists and fails for the expected missing behavior.
- Runlog records the command and expected failure.
- Runlog records the five conformance checks above as PASS/FAIL or expected-fail baseline.
- Sub-agent review approves the contract shape or all requested changes are applied.

Rollback:

- Delete the new test file and remove Step 1 runlog records.

Review gate:

- Use a sub-agent with `codex-code-review` after the test is written and baseline failure is recorded.

## Step 2 — Principal Runtime Boundary

Scope:

- Route mutable UI Server operations through a per-principal workspace runtime.
- Keep global/system definitions shared.
- Ensure snapshots and SSE clients bind to the correct runtime by principal key.
- Ensure guest/no-login access remains read-only.

Files:

- Modify `packages/ui-model-demo-server/server.mjs`.
- Add helper module only if the extracted boundary would otherwise make `server.mjs` less auditable.
- Modify `scripts/tests/test_0417_user_isolated_ui_state_projection_contract.mjs`.
- Update `docs/iterations/0417-user-isolated-ui-state-projection/runlog.md`.

Implementation notes:

- Add a deterministic principal key helper:
  - `subject` first;
  - then `userId`;
  - then `email`;
  - then `username`;
  - auth-disabled local mode maps to `local-dev`;
  - guest maps to read-only guest projection and must not get mutable runtime.
- Add a runtime registry keyed by principal key.
- Store user runtimes in stable per-principal locations when persistence is enabled.
- Keep shared global labels read-only from user runtimes unless a specific system operation is allowed.
- Broadcast only to clients whose principal/runtime changed.
- Ensure remote response materialization resolves by `reply_target_*` into the correct user runtime.

Verification:

```bash
node scripts/tests/test_0417_user_isolated_ui_state_projection_contract.mjs
node scripts/tests/test_0403_principal_authorization.mjs
node scripts/tests/test_0376_control_first_mbr_routing_contract.mjs
node scripts/tests/test_0384_provider_owned_slide_app_install_flow.mjs
```

Acceptance:

- User isolation tests pass.
- Existing auth, routing, and provider install tests still pass.
- No user-owned write goes to shared runtime by default.
- Runlog records conformance evidence for tier placement, model placement, data ownership, data flow, and data chain.
- Sub-agent review approves before Step 3.

Rollback:

- Revert the server runtime registry changes and return endpoint selection to the previous single-runtime path.

Review gate:

- Use sub-agent code review focused on data ownership, snapshot visibility, response materialization, no shared mutable fallback, and the five mandatory conformance checks.

## Step 3 — UI Local State and Submit Overlay

Scope:

- Add UI local state declarations and renderer/remote-store behavior.
- Make Input default local-only until submit.
- Ensure submit reads current visible local overlay, not stale ModelTable labels.
- Support explicit `persist_policy: "debounce"` and `persist_policy: "realtime"` for components that need persistence.

Files:

- Modify `packages/ui-renderer/src/renderer.mjs`.
- Modify `packages/ui-renderer/src/renderer.js`.
- Modify `packages/ui-model-demo-frontend/src/remote_store.js`.
- Modify `packages/ui-model-demo-frontend/src/projection_store.js` if local overlay access belongs there.
- Modify or add examples in `packages/ui-model-demo-frontend/src/demo_modeltable.js`.
- Modify `scripts/tests/test_0417_user_isolated_ui_state_projection_contract.mjs`.
- Update UI model docs:
  - `docs/user-guide/modeltable_user_guide.md`
  - `docs/user-guide/slide-app-runtime/slide_app_runtime_developer_guide.md`
  - any dedicated UI component guide that already covers Input/Dialog/Tabs.

Implementation notes:

- Add a state declaration shape for:
  - `state_id`;
  - `state_kind`;
  - `scope`;
  - `persist_policy`;
  - `default`;
  - optional `reset_on`.
- Input without explicit persistence uses `persist_policy: "submit"`.
- Submit payload resolution must check local overlay first, then current projection, then snapshot label fallback.
- Debounce writes may continue, but submit must not depend on the debounce completing.
- Realtime persistence remains opt-in.

Verification:

```bash
node scripts/tests/test_0417_user_isolated_ui_state_projection_contract.mjs
node scripts/tests/test_0415_reactive_projection_store_contract.mjs
node scripts/tests/test_0407_current_model_ref_contract.mjs
node scripts/tests/test_0409_todo_mqtt_egress_docs_contract.mjs
npm -C packages/ui-model-demo-frontend run build
```

Acceptance:

- Input default local-only behavior passes.
- Immediate submit emits latest visible value.
- Submit still uses the canonical Model 0 / pin / bus event path exactly once and does not direct-write final business truth.
- Existing current-model-ref and To Do egress docs contracts remain valid or are updated to the new documented API.
- Runlog records conformance evidence for tier placement, model placement, data ownership, data flow, and data chain.
- Sub-agent review approves before Step 4.

Rollback:

- Remove new state declaration handling and restore previous label-update debounce/flush behavior.

Review gate:

- Use sub-agent code review focused on stale submit value risk, unintended model writes, docs/code mismatch, and compatibility fallbacks.

## Step 4 — Dialog/View State and Pending/Loading Locking

Scope:

- Add first-class local state behavior for Dialog visibility, tabs/local page switch, drawer/dropdown state, and selected item state.
- Add scoped pending/loading declarations for submit-like actions.
- Ensure pending blocks duplicate action and the declared scope, then clears on success/error/timeout.

Files:

- Modify `packages/ui-renderer/src/renderer.mjs`.
- Modify `packages/ui-renderer/src/renderer.js`.
- Modify `packages/ui-model-demo-frontend/src/remote_store.js`.
- Modify `packages/ui-model-demo-frontend/src/demo_modeltable.js`.
- Modify `scripts/tests/test_0417_user_isolated_ui_state_projection_contract.mjs`.
- Update developer docs listed in Step 3.

Implementation notes:

- Dialog/tab/local page state defaults to local/session.
- Business persistence for these controls requires explicit declaration.
- Pending declarations support:
  - `pending_state_id`;
  - `pending_text`;
  - `lock_scope`;
  - `disable_while_pending`;
  - `pending_until`;
  - `timeout_ms`;
  - `on_timeout`.
- Renderer must visually expose loading and disabled state.
- Remote store must release pending on submit success/error/timeout even if no business label changes.

Verification:

```bash
node scripts/tests/test_0417_user_isolated_ui_state_projection_contract.mjs
node scripts/tests/test_0329_bus_event_last_op_id_snapshot_contract.mjs
node scripts/tests/test_0388_shell_route_state_stability_contract.mjs
npm -C packages/ui-model-demo-frontend run build
```

Acceptance:

- Dialog/view local state tests pass.
- Pending lock tests pass.
- Existing route stability and button single-flight behavior do not regress.
- Runlog records conformance evidence for tier placement, model placement, data ownership, data flow, and data chain.
- Sub-agent review approves before Step 5.

Rollback:

- Remove pending state handling and return Button/Dialog/Tabs to previous behavior.

Review gate:

- Use sub-agent code review focused on double-submit, stuck-loading, and global lock overreach.

## Step 5 — Projection Delta Tightening

Scope:

- Reduce post-load payloads for local UI interactions and user-runtime scoped updates.
- Prefer atom/projection-local updates where possible.
- Keep full snapshot only for bootstrap, recovery, principal change, or oversized/unrepresentable patch.

Files:

- Modify `packages/ui-model-demo-server/server.mjs`.
- Modify `packages/ui-model-demo-frontend/src/remote_store.js`.
- Modify `packages/ui-model-demo-frontend/src/projection_store.js`.
- Modify `scripts/tests/test_0417_user_isolated_ui_state_projection_contract.mjs`.
- Modify `scripts/tests/test_0416_post_load_projection_latency_contract.mjs` only if its expectations need tightening.

Implementation notes:

- Retain the 32KB default snapshot patch ceiling from 0416.
- Add explicit measurements for local UI state events and app-local business updates.
- Do not send full snapshots for local-only UI state.
- Do not push large derived fields such as app registry/editor options in ordinary interaction patches unless the active view depends on them.
- If dependency tracking is incomplete, fail closed to snapshot recovery rather than silently showing stale data.

Verification:

```bash
node scripts/tests/test_0417_user_isolated_ui_state_projection_contract.mjs
node scripts/tests/test_0416_post_load_projection_latency_contract.mjs
node scripts/tests/test_0414_snapshot_delta_sse_contract.mjs
node scripts/tests/test_0415_reactive_projection_store_contract.mjs
```

Acceptance:

- Local UI state changes do not emit full snapshot.
- Ordinary submit/update patch sizes stay under the documented post-load ceiling unless forced recovery is explicitly asserted.
- Existing delta/SSE/projection tests pass.
- Runlog records conformance evidence for tier placement, model placement, data ownership, data flow, and data chain.
- Sub-agent review approves before Step 6.

Rollback:

- Restore previous snapshot patch generation path and remove new projection-local event handling.

Review gate:

- Use sub-agent code review focused on stale projection risk, recovery path correctness, and packet-size evidence.

## Step 6 — Existing App Adaptation and Local Browser Verification

Scope:

- Update existing UI-model app definitions that need the new state declarations.
- Verify representative apps in the local deployed UI.

Files:

- Modify `packages/ui-model-demo-frontend/src/demo_modeltable.js`.
- Modify any slide app payload fixture or doc example that still requires explicit model ids or old input persistence behavior.
- Update docs in `docs/user-guide/**` as needed.
- Update `docs/iterations/0417-user-isolated-ui-state-projection/runlog.md`.

Verification:

```bash
npm -C packages/ui-model-demo-frontend run build
bash scripts/ops/check_runtime_baseline.sh
# restart/redeploy local UI Server according to the repo's current local deployment script
node scripts/tests/test_0417_user_isolated_ui_state_projection_contract.mjs
node scripts/tests/test_0416_post_load_projection_latency_contract.mjs
```

Browser checks:

- Open local UI Server in a real browser.
- Verify Home loads without outer page scroll.
- Verify To Do Board:
  - open app;
  - type quickly in create/edit dialog;
  - confirm typing does not stutter;
  - submit immediately after typing;
  - confirm created/edited task uses visible text;
  - confirm loading/pending blocks duplicate submit and clears.
- Verify E2E color generator still changes color after clicking Generate.
- Verify Dialog/local page switch behavior is smooth and does not reset unexpectedly.
- If auth is enabled, verify two separate browser contexts or scripted principals do not share user-owned app state.

Acceptance:

- All deterministic checks pass.
- Browser verification is recorded with exact URL and key observed results.
- Browser verification explicitly checks that app-local user-owned data from one browser principal does not appear in another principal's app runtime.
- Runlog records final conformance evidence for tier placement, model placement, data ownership, data flow, and data chain.
- Sub-agent review approves the full change set.

Rollback:

- Revert app definition/doc updates and restore previous local deployment artifact.

Review gate:

- Use final sub-agent review focused on whole-iteration correctness, user isolation, UI responsiveness, docs alignment, and verification completeness.

## Completion

When all steps pass:

- update `docs/ITERATIONS.md` status for 0417;
- ensure `runlog.md` has factual PASS records and review outcomes;
- report verification results and remaining risks.

## Notes

- Generated at: 2026-06-11
- Branch: `dropx/dev_0417-user-isolated-ui-state-projection`
