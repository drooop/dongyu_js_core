---
title: "Iteration 0436 Runtime Snapshot Build Latency Plan"
doc_type: iteration-plan
status: completed
updated: 2026-07-04
source: ai
iteration_id: 0436-runtime-snapshot-build-latency
id: 0436-runtime-snapshot-build-latency
phase: completed
---

# Iteration 0436-runtime-snapshot-build-latency Plan

## Goal

Reduce local ready-state App-open refresh latency by removing unnecessary full runtime/client snapshot construction from explicit visible App/model snapshot requests.

Iteration 0435 made the response body smaller (`profile=visible` for the E2E App table is now about `15.3KB`) but browser fetch time stayed around `717-763ms`. This iteration focuses on the remaining build cost: `profile=visible&visible_model_ref={table_id,model_id}` should build directly from the requested runtime model/table ref after authorization, not by first constructing and filtering a full client snapshot.

## Scope

- In scope:
- Measure the current ready-state `/snapshot` path and record per-node timing: request handling, profile validation, runtime/client snapshot build, profile projection, serialization, and browser-observed fetch time.
- Add deterministic tests that fail when explicit ready-state `profile=visible` still depends on full `runtime.snapshot()` / `state.clientSnap()` graph construction for App table targets.
- Implement a scoped visible snapshot builder for ready-state explicit visible requests.
- Keep bootstrap/initial projection behavior intact: first screen still gets the small shell bootstrap snapshot, and SSE bootstrap subscriptions still include bootstrap + requested visible model refs.
- Preserve principal isolation and subtable ownership checks.
- Record before/after metrics in `runlog.md`, including snapshot bytes, server timing, browser fetch timing, and E2E color button latency.
- Out of scope:
- Changing ModelTable semantics, `model.subtable`, `model.subtableconnection`, or PIN routing rules.
- Reworking persistence format or App table migration beyond what is necessary for snapshot build access.
- Remote deployment; this iteration is local Orbstack only unless a later explicit request promotes it.
- Changing business bus behavior, Matrix/MBR/MQTT topics, or color generation logic.

## Invariants / Constraints

- ModelTable remains the truth source. UI only renders projection and must not become state truth.
- User/App table isolation must remain table-qualified: `{ table_id, model_id }` is the unit for visible App snapshots.
- Explicit visible requests must fail closed for unauthorized, invisible, or missing targets.
- `profile=bootstrap` and stream initial snapshots must not regress first-screen shape.
- No compatibility fallback that silently switches to broader/full snapshots when the scoped path fails. A scoped-path failure must be visible and testable.
- Any local deployment/browser claim must be verified against the deployed local stack.

## Success Criteria

- Branch `dropx/dev_0436-runtime-snapshot-build-latency` has an Approved iteration plan before runtime code changes.
- Deterministic tests prove explicit ready-state App-table `profile=visible` does not call the full runtime/client snapshot path for response construction.
- Existing snapshot security/shape tests remain green:
  - `node scripts/tests/test_0418_visible_snapshot_projection_latency_contract.mjs`
  - `node scripts/tests/test_0423_snapshot_granularity_contract.mjs`
  - `node scripts/tests/test_0425_visible_model_refs_contract.mjs`
  - `node scripts/tests/test_0425_principal_desktop_state_contract.mjs`
  - `node scripts/tests/test_0425_slide_app_subtable_install_contract.mjs`
  - `node scripts/tests/test_0435_visible_snapshot_app_slimming_contract.mjs`
- Explicit scoped-build security cases are covered either in `test_0436_runtime_snapshot_build_latency_contract.mjs` or the existing test suite:
  - cross-principal App table ref fails closed;
  - invisible/missing refs fail closed;
  - same `model_id` in host and App table does not collide;
  - subtable owner checks are not bypassed by the direct visible builder.
- SSE and recovery behavior remain table-qualified:
  - `/stream?profile=bootstrap&visible_model_ref=...` includes bootstrap shell plus the requested App table model;
  - snapshot patch/recovery keeps `visible_model_ref={table_id,model_id}` and does not fall back to implicit full snapshots.
- Frontend production build remains green:
  - `npm -C packages/ui-model-demo-frontend run build`
- Local browser verification records before/after metrics. Target result: ready-state explicit visible App snapshot browser fetch time improves by at least 50% versus the 0435 local baseline (`717-763ms`) or the runlog identifies the remaining dominant node with measured evidence.
- E2E 颜色生成器 remains functional after local deploy: clicking `Generate Color` changes the displayed color through the existing bus path.

## Inputs

- Created at: 2026-07-04
- Iteration ID: 0436-runtime-snapshot-build-latency
- Baseline from 0435 local browser run:
  - `/snapshot?profile=visible&visible_model_ref={"table_id":"app:drop:e2e:2-0-20:1","model_id":0}`: about `762.9ms / 717.5ms / 717.1ms`, `15285` bytes.
  - `/bus_event` response timing: `server_total_ms` about `596.648ms`.
  - E2E color button latency: about `3740.7ms`.
