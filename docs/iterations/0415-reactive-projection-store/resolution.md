---
title: "Iteration 0415 — Reactive Projection Store Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-06-18
source: ai
iteration_id: 0415-reactive-projection-store
id: 0415-reactive-projection-store
phase: phase1
---

# Iteration 0415 — Reactive Projection Store Resolution

## Step 1 — Register And Contract Tests

Scope:
- Register iteration and freeze the local prototype contract.
- Add failing deterministic tests for a frontend `ProjectionStore`.

Files:
- `docs/ITERATIONS.md`
- `docs/iterations/0415-reactive-projection-store/*`
- `packages/ui-model-demo-frontend/src/projection_store.js`
- `scripts/tests/test_0415_reactive_projection_store_contract.mjs`

Validation:
- `node scripts/tests/test_0415_reactive_projection_store_contract.mjs`

Acceptance:
- Test fails before implementation because `ProjectionStore` does not exist or does not expose required behavior.

Rollback:
- Remove the new test and iteration files.

## Step 2 — Projection Store Implementation

Scope:
- Implement full snapshot hydration and patch application in a frontend projection store.
- Keep current `snapshot` API unchanged.

Files:
- `packages/ui-model-demo-frontend/src/projection_store.js`
- `packages/ui-model-demo-frontend/src/remote_store.js`
- `packages/ui-model-demo-server/server.mjs`
- `scripts/tests/test_0415_reactive_projection_store_contract.mjs`

Validation:
- `node scripts/tests/test_0415_reactive_projection_store_contract.mjs`
- `node scripts/tests/test_0414_snapshot_delta_sse_contract.mjs`

Acceptance:
- Label atom identity remains stable for unrelated label changes.
- Projection state matches snapshot/patch results for tested ops.
- Local pending UI shell state cannot be overwritten by an unrelated full snapshot fallback.
- `DY_AUTH=0` local test mode still grants the internal dev capability set required by `/bus_event`.
- `/api/runtime/mode` does not wait for optional Matrix live sync before returning; control bus activation is not blocked by slow Matrix.
- 0414 patch behavior remains green.

Rollback:
- Revert projection store integration and test.

## Step 3 — Renderer Read Path

Scope:
- Let `getEffectiveLabelValue()` read Projection Store values when available.
- Preserve overlay precedence.

Files:
- `packages/ui-model-demo-frontend/src/remote_store.js`
- `packages/ui-renderer/src/renderer.mjs`
- `packages/ui-renderer/src/renderer.js`
- Tests as needed.

Validation:
- `node scripts/tests/test_0415_reactive_projection_store_contract.mjs`
- `node scripts/tests/test_0412_local_latency_trace_contract.mjs`
- `node scripts/tests/test_0414_snapshot_delta_sse_contract.mjs`

Acceptance:
- Renderer-bound label reads can be served by projection atoms.
- Existing overlay and fallback behavior remains green.

Rollback:
- Revert renderer read path changes.

## Step 4 — Local Deploy And Browser Regression

Scope:
- Rebuild/redeploy local stack.
- Verify existing shell and representative apps still render.

Commands:
- `SKIP_MATRIX_BOOTSTRAP=1 bash scripts/ops/deploy_local.sh`
- `kubectl -n dongyu get deploy ui-server mbr-worker remote-worker workspace-manager -o jsonpath='...'`
- Browser/Playwright against `http://localhost:30900/#/`

Acceptance:
- All local deployments are ready.
- Browser opens the shell.
- No outer scroll regression at `1440x1000`.
- Existing app launch path works.

Rollback:
- Revert 0415 changes and redeploy previous local state.

## Step 5 — Final Review And Docs

Scope:
- Review whether SSOT/user guide needs updates.
- Run final targeted tests and record PASS evidence.

Validation:
- `git diff --check`
- Targeted tests from Steps 2-3.

Acceptance:
- Runlog records all PASS evidence.
- `docs/ITERATIONS.md` status is `Completed`.
