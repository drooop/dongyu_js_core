---
title: "Iteration 0423 Snapshot Granularity Implementation Resolution"
doc_type: iteration-resolution
status: approved
updated: 2026-06-23
source: ai
iteration_id: 0423-snapshot-granularity-impl
id: 0423-snapshot-granularity-impl
phase: execution
---

# Iteration 0423-snapshot-granularity-impl Resolution

## Execution Strategy

Use TDD and small stages. Each stage first adds or extends deterministic tests, verifies the expected failure when behavior is not yet implemented, then implements the smallest production change needed to pass. Each stage ends with sub-agent code review and runlog evidence.

## Phase 1: Snapshot Size Instrumentation And Baseline

Scope:

- Add client-visible snapshot size statistics for profiled snapshots.
- Add a deterministic size report test/script that prints total bytes, bytes by model, bytes by cell, and top label contributors for `bootstrap`, `visible`, and `full`.
- Record the local pre-change baseline in `runlog.md`.

Likely files:

- `packages/ui-model-demo-server/server.mjs`
- `scripts/tests/test_0423_snapshot_granularity_contract.mjs`
- `docs/iterations/0423-snapshot-granularity-impl/runlog.md`

Verification:

- `node scripts/tests/test_0423_snapshot_granularity_contract.mjs`

Acceptance:

- Test prints deterministic size contributors.
- Metrics are computed after principal/capability filtering and profile filtering.
- No product behavior changes beyond safe diagnostic metadata.

Rollback:

- Remove the helper/test additions from the files above.

Sub-agent review focus:

- Metrics must describe the client-visible payload, not raw truth.
- Metrics must not expose secrets.

## Phase 2: Strict Bootstrap Contract And Compact App Index

Scope:

- Make `bootstrap` stricter.
- Ensure compact app index contains only first-paint card/list metadata.
- Exclude positive app model bodies and heavy labels from `bootstrap`.
- Keep Workspace Manager install/remove app index updates observable as `bootstrap` patches.

Likely files:

- `packages/ui-model-demo-server/server.mjs`
- `packages/ui-model-demo-frontend/src/remote_store.js`
- `packages/ui-model-demo-frontend/src/route_ui_projection.js`
- `packages/ui-model-demo-frontend/src/desktop_app_state.js`
- `scripts/tests/test_0423_snapshot_granularity_contract.mjs`

Verification:

- `node scripts/tests/test_0423_snapshot_granularity_contract.mjs`
- `node scripts/tests/test_0418_visible_snapshot_projection_latency_contract.mjs`

Acceptance:

- `bootstrap` excludes all positive app model bodies.
- `bootstrap` excludes known heavy labels such as model editor row dumps, full docs/html bodies, Matrix room lists, and app-internal state.
- `bootstrap` serialized body is `<= 90KB`, or the runlog lists top contributors and remaining follow-ups above `10KB`.
- App launcher still renders from compact index.
- Install/remove changes update compact index without embedding app body.

Rollback:

- Revert bootstrap allowlist and compact index changes.

Sub-agent review focus:

- No first-paint requirement is lost.
- No hidden model/secret leaks.
- No compatibility fallback to old full bootstrap.

## Phase 3: App/Model Lazy Load Boundary

Scope:

- Ensure every app open path calls `ensureVisibleModelLoaded(model_id)`.
- Keep visible model ids in the stream subscription.
- Add/verify loading and typed error states for app opening.
- Keep loaded models warm for the browser session.

Likely files:

- `packages/ui-model-demo-frontend/src/demo_app.js`
- `packages/ui-model-demo-frontend/src/remote_store.js`
- `scripts/tests/test_0423_snapshot_granularity_contract.mjs`
- `scripts/tests/test_0418_visible_snapshot_projection_latency_contract.mjs`

Verification:

- `node scripts/tests/test_0423_snapshot_granularity_contract.mjs`
- `node scripts/tests/test_0418_visible_snapshot_projection_latency_contract.mjs`

Acceptance:

- First open of an installed app fetches `profile=visible&model_id=<id>`.
- Startup and app open never request `profile=full`.
- Missing/stale/unauthorized models fail closed with a visible app-window error.

Rollback:

- Revert app open lazy-load path changes.

Sub-agent review focus:

- Route/app opening must not fall back to `full`.
- Stale visible ids recover without losing valid visible ids.

## Phase 4: Projection-Driven Rendering

Scope:

- Move shell/app-card reads toward projection atoms or compact index selectors where they currently depend on large reactive snapshot reads.
- Keep raw `snapshot.models` as cache/recovery data, not the default render dependency for unrelated labels.
- Preserve overlay precedence and formal submit correctness.

Likely files:

- `packages/ui-model-demo-frontend/src/projection_store.js`
- `packages/ui-model-demo-frontend/src/route_ui_projection.js`
- `packages/ui-model-demo-frontend/src/desktop_app_state.js`
- `packages/ui-model-demo-frontend/src/demo_app.js`
- `scripts/tests/test_0415_reactive_projection_store_contract.mjs`
- `scripts/tests/test_0423_snapshot_granularity_contract.mjs`

Verification:

- `node scripts/tests/test_0415_reactive_projection_store_contract.mjs`
- `node scripts/tests/test_0420_ui_local_state_latency_contract.mjs`
- `node scripts/tests/test_0423_snapshot_granularity_contract.mjs`

Acceptance:

- Patch for one label updates only the relevant atom.
- App cards do not depend on hidden app bodies.
- Overlay values continue to win over committed server echo.

Rollback:

- Revert selector/rendering changes.

Sub-agent review focus:

- No UI truth bypass.
- Projection cache remains a read cache only.

## Phase 5: Profile-Scoped Patch And Recovery Hardening

Scope:

- Enforce profile-specific patch budgets.
- Ensure oversize fallback is a profile-scoped reset, not `full`.
- Ensure patch mismatch recovery re-fetches the exact same profile key including sorted visible model ids.
- Ensure permission changes emit explicit profile reset.

Likely files:

- `packages/ui-model-demo-server/server.mjs`
- `packages/ui-model-demo-frontend/src/remote_store.js`
- `scripts/tests/test_0414_snapshot_delta_sse_contract.mjs`
- `scripts/tests/test_0416_post_load_projection_latency_contract.mjs`
- `scripts/tests/test_0423_snapshot_granularity_contract.mjs`

Verification:

- `node scripts/tests/test_0414_snapshot_delta_sse_contract.mjs`
- `node scripts/tests/test_0416_post_load_projection_latency_contract.mjs`
- `node scripts/tests/test_0423_snapshot_granularity_contract.mjs`

Acceptance:

- Patch mismatch preserves active visible model id set.
- Oversize patch sends same-profile reset.
- Automatic recovery never requests `full`.
- Principal/capability changes do not reuse stale patch baseline.

Rollback:

- Revert patch/recovery changes.

Sub-agent review focus:

- Patch sequencing.
- Principal isolation.
- Recovery semantics.

## Phase 6: Local OrbStack Deployment And Browser Measurement

Scope:

- Run deterministic regression tests.
- Build frontend/server as needed.
- Deploy locally to OrbStack stack.
- Use real browser automation against local deployed URL.
- Record metrics in runlog:
  - desktop shell visible time;
  - app list visible time;
  - bootstrap bytes/duration;
  - first app visible bytes/duration;
  - representative post-load patch bytes;
  - whether any `full` request occurred;
  - outer scroll state.

Likely files:

- `docs/iterations/0423-snapshot-granularity-impl/runlog.md`
- Any local deployment scripts touched only if required by current baseline.

Verification:

- `node scripts/tests/test_0423_snapshot_granularity_contract.mjs`
- `node scripts/tests/test_0418_visible_snapshot_projection_latency_contract.mjs`
- `node scripts/tests/test_0414_snapshot_delta_sse_contract.mjs`
- `node scripts/tests/test_0415_reactive_projection_store_contract.mjs`
- `node scripts/tests/test_0416_post_load_projection_latency_contract.mjs`
- `node scripts/tests/test_0420_ui_local_state_latency_contract.mjs`
- `npm -C packages/ui-model-demo-frontend run build`
- `bash scripts/ops/check_runtime_baseline.sh`
- Local browser check against the deployed OrbStack UI URL.

Acceptance:

- Deterministic checks pass.
- Browser shows desktop/app list without outer page scroll.
- Browser trace shows no automatic `full`.
- Local metrics are recorded with before/after comparison.

Rollback:

- Revert code changes and redeploy previous local stack if needed.

Sub-agent review focus:

- Metrics must match the actually tested local revision.
- Browser evidence must be from local deployed stack, not dev server only.

## Final Overall Review

After Phase 6:

- Run an overall sub-agent review over the full diff and runlog.
- Fix every `CHANGE_REQUESTED` finding.
- Update `docs/ITERATIONS.md` status and final commit only after all verification passes.
