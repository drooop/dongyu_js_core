---
title: "Iteration 0418-visible-snapshot-projection-latency Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-06-18
source: ai
iteration_id: 0418-visible-snapshot-projection-latency
id: 0418-visible-snapshot-projection-latency
phase: phase1
---

# Iteration 0418-visible-snapshot-projection-latency Resolution

## Execution Strategy

Use TDD and small reviewable stages. The implementation must preserve 0414 snapshot patch semantics, 0415 Projection Store behavior, 0416 scoped derived refresh, and 0417 principal runtime isolation.

Architecture:

1. Add server-side client snapshot profile helpers: `full`, `bootstrap`, and `visible`.
2. Keep existing `/snapshot` compatible only through explicit/full profile, while frontend startup opts into `bootstrap`.
3. Add a visible-model fetch path that returns allowed requested models as a small snapshot/patch payload.
4. Make `/stream` initial snapshot and later patches use the same profile baseline, including loaded visible model IDs.
5. Add frontend lazy hydration when a focused slide app model is absent and keep the stream subscription aligned with the loaded visible model set.
6. Measure and verify with scripts plus local browser.

## Step 1 — Contract Tests and Baseline Metrics

Scope:

- Add deterministic tests describing bootstrap profile and visible-model fetch behavior before implementation.
- Record current local baseline metrics in runlog.
- No production code changes in this step.

Files:

- Create or modify: `scripts/tests/test_0418_visible_snapshot_projection_latency_contract.mjs`
- Modify: `docs/iterations/0418-visible-snapshot-projection-latency/runlog.md`

Verification:

```bash
node scripts/tests/test_0418_visible_snapshot_projection_latency_contract.mjs
```

Expected before implementation:

- Fails because bootstrap/visible snapshot profile APIs are missing or still return full/heavy snapshots.

Acceptance:

- Tests assert bootstrap snapshot excludes at least one non-visible positive app model body.
- Tests assert bootstrap snapshot keeps app registry/shell labels needed for desktop.
- Tests assert visible model fetch returns a requested app model and does not include unrelated app models.
- Tests assert visible model fetch rejects invalid, missing, unauthorized, and capability-disallowed model IDs with explicit error codes.
- Tests assert `/stream?profile=bootstrap` initial event does not contain a full snapshot body or unrelated app model bodies.
- Tests assert startup bytes include both `/snapshot?profile=bootstrap` and first `/stream?profile=bootstrap` event.
- Tests assert full profile remains available.
- Tests include redaction checks for secrets/function-code labels.
- Runlog records current `/snapshot` bytes and largest labels.
- Runlog records exact reproducible baseline commands with cwd.
- Sub-agent review approves the test contract.

Rollback:

- Remove the new test and Step 1 runlog entries.

Review:

- Spawn sub-agent with `codex-code-review` focused on whether tests prove the desired path instead of an old full snapshot path.

## Step 2 — Server Snapshot Profiles

Scope:

- Implement server helpers for client-visible snapshot profiles.
- Add request parsing for profile and model IDs.
- Add request parsing for stream profile and visible model IDs.
- Preserve principal/capability filtering and secret redaction.
- Keep full snapshot recovery explicit.

Files:

- Modify: `packages/ui-model-demo-server/server.mjs`
- Modify: `scripts/tests/test_0418_visible_snapshot_projection_latency_contract.mjs`
- Modify: `docs/iterations/0418-visible-snapshot-projection-latency/runlog.md`

Verification:

```bash
node scripts/tests/test_0418_visible_snapshot_projection_latency_contract.mjs
node scripts/tests/test_0414_snapshot_delta_sse_contract.mjs
node scripts/tests/test_0416_post_load_projection_latency_contract.mjs
node scripts/tests/test_0417_user_isolated_ui_state_projection_contract.mjs
```

Acceptance:

- `bootstrap` response is smaller than `full` on test fixture and excludes non-visible app model bodies.
- `visible` response includes requested allowed model IDs and excludes unrelated app models.
- `visible` invalid/missing/unauthorized/disallowed requests fail closed and never return full snapshot.
- `/stream?profile=bootstrap` initial event uses bootstrap profile.
- `/stream?profile=bootstrap&visible_model_id=<id>` includes bootstrap plus the requested allowed visible model, and excludes unrelated app models.
- `full` response remains current filtered behavior.
- Redaction and capability filtering still apply.
- No change lets unauthenticated guest create mutable runtime state.
- Sub-agent review approves before Step 3.

Rollback:

- Revert server profile helper and request parsing changes.

Review:

- Spawn sub-agent with `codex-code-review` focused on security filtering order, principal isolation, model inclusion rules, and reset/recovery semantics.

## Step 3 — Frontend Lazy Hydration

Scope:

- Make remote frontend startup request bootstrap profile.
- Make remote frontend SSE connect using bootstrap profile instead of implicit full snapshot.
- Add model presence checks and visible-model loading when opening a workspace/slide app.
- Track loaded visible model IDs and reconnect or update the stream subscription so later patches cover loaded visible models without expanding to full snapshot.
- Apply visible-model payload through existing snapshot/projection store paths.
- Preserve overlay/pending/local UI state behavior.

Files:

- Modify: `packages/ui-model-demo-frontend/src/remote_store.js`
- Modify as needed: `packages/ui-model-demo-frontend/src/demo_app.js`
- Modify as needed: `packages/ui-model-demo-frontend/src/desktop_focused_app_content.js`
- Modify: `scripts/tests/test_0418_visible_snapshot_projection_latency_contract.mjs`
- Modify: `docs/iterations/0418-visible-snapshot-projection-latency/runlog.md`

Verification:

```bash
node scripts/tests/test_0418_visible_snapshot_projection_latency_contract.mjs
node scripts/tests/test_0415_reactive_projection_store_contract.mjs
node scripts/tests/test_0417_user_isolated_ui_state_projection_contract.mjs
npm -C packages/ui-model-demo-frontend run build
```

Acceptance:

- Initial `refreshSnapshot()` uses bootstrap profile.
- Opening a workspace app whose model is absent triggers one visible-model fetch.
- Initial SSE event uses bootstrap profile and does not replace the client with full snapshot.
- Loaded visible model IDs are included in subsequent stream profile subscriptions.
- Visible-model response hydrates Projection Store and snapshot without full reset.
- Local Input/Dialog/pending behavior from 0417 remains green.
- Sub-agent review approves before Step 4.

Rollback:

- Restore frontend `/snapshot` full fetch behavior and remove lazy hydration hooks.

Review:

- Spawn sub-agent with `codex-code-review` focused on stale app rendering, duplicate fetches, race conditions, overlay loss, and accidental full snapshot fallback.

## Step 4 — Patch/Profile Consistency and Metrics

Scope:

- Ensure SSE clients that start from bootstrap do not receive unrelated full app models through ordinary patches.
- Ensure SSE profile baselines are per-client and include only bootstrap plus that client's loaded visible model IDs.
- Add metrics/tests for full/bootstrap/visible bytes and representative patch bytes.
- Ensure profile mismatch recovery is explicit and observable.

Files:

- Modify: `packages/ui-model-demo-server/server.mjs`
- Modify: `packages/ui-model-demo-frontend/src/remote_store.js`
- Modify: `scripts/tests/test_0418_visible_snapshot_projection_latency_contract.mjs`
- Modify: `docs/iterations/0418-visible-snapshot-projection-latency/runlog.md`

Verification:

```bash
node scripts/tests/test_0418_visible_snapshot_projection_latency_contract.mjs
node scripts/tests/test_0414_snapshot_delta_sse_contract.mjs
node scripts/tests/test_0416_post_load_projection_latency_contract.mjs
node scripts/tests/test_0412_local_latency_trace_contract.mjs
```

Acceptance:

- Bootstrap clients do not receive unrelated app model bodies through ordinary patches.
- A client subscribed with `visible_model_id=A` receives patches for A but not unrelated app model B.
- Full reset is still possible only with observable recovery/reset reason.
- Patch stats remain present.
- Ordinary patch remains under the 32KB post-load limit unless explicit oversize reset occurs.
- Sub-agent review approves before Step 5.

Rollback:

- Revert profile-aware patch consistency changes.

Review:

- Spawn sub-agent with `codex-code-review` focused on patch baseline/profile mismatch correctness and no silent expansion to full snapshot.

## Step 5 — Docs, Local Deploy, Browser Verification, Final Review

Scope:

- Update developer/user docs only where behavior is developer-visible.
- Build and deploy local stack.
- Use real browser/Playwright to verify desktop, lazy app opening, To Do Board, E2E color generator, input responsiveness, and scroll constraints.
- Final full-diff sub-agent review.

Files:

- Modify as needed:
  - `docs/user-guide/modeltable_user_guide.md`
  - `docs/user-guide/slide-app-runtime/slide_app_runtime_developer_guide.md`
  - `docs/ssot/runtime_semantics_modeltable_driven.md`
  - `docs/ssot/ui_to_matrix_event_flow.md`
  - `docs/iterations/0418-visible-snapshot-projection-latency/runlog.md`
  - `docs/ITERATIONS.md`

Verification:

```bash
node scripts/tests/test_0418_visible_snapshot_projection_latency_contract.mjs
node scripts/tests/test_0414_snapshot_delta_sse_contract.mjs
node scripts/tests/test_0415_reactive_projection_store_contract.mjs
node scripts/tests/test_0416_post_load_projection_latency_contract.mjs
node scripts/tests/test_0417_user_isolated_ui_state_projection_contract.mjs
node scripts/validate_ui_ast_v0x.mjs --case all
node scripts/validate_builtins_v0.mjs
npm -C packages/ui-model-demo-frontend run build
SKIP_MATRIX_BOOTSTRAP=1 bash scripts/ops/deploy_local.sh
```

Browser verification:

- Open `http://localhost:30900/#/`.
- Confirm desktop app list renders from bootstrap.
- Open To Do Board and confirm lazy-loaded content renders.
- Create or edit a To Do task and confirm input remains responsive.
- Open E2E color generator and confirm color changes.
- Check no outer page scroll and verify relevant inner scroll containers are reachable.
- Close browser processes after tests.

Acceptance:

- All targeted tests pass.
- Local deployment is ready.
- Browser checks pass with measured metrics recorded.
- `docs/ITERATIONS.md` status is updated according to final state.
- Final sub-agent review is approved after fixes.

Rollback:

- Revert 0418 code/docs changes and redeploy previous local state.
