---
title: "Iteration 0437 Bootstrap SSE First Packet Latency Plan"
doc_type: iteration-plan
status: planned
updated: 2026-07-04
source: ai
iteration_id: 0437-bootstrap-sse-first-packet-latency
id: 0437-bootstrap-sse-first-packet-latency
phase: phase1
---

# Iteration 0437-bootstrap-sse-first-packet-latency Plan

## Goal

Reduce local first-screen and App-open first-packet latency by removing unnecessary full runtime/client snapshot construction from `profile=bootstrap` and `/stream` initial snapshot paths.

Iteration 0436 made ready-state explicit `profile=visible` fast by building only the requested `{ table_id, model_id }` model. The remaining browser measurements show bootstrap and SSE first snapshot still cost about `724-833ms` / `730ms`, even when the response only needs the bootstrap shell plus one requested App table. This iteration applies the same direct-build principle to bootstrap paths.

## Scope

- In scope:
- Add deterministic tests proving ready `/snapshot?profile=bootstrap` does not call the full `runtime.snapshot()` / `state.clientSnap()` path.
- Add deterministic tests proving `/snapshot?profile=bootstrap&visible_model_ref=...` and `/stream?profile=bootstrap&visible_model_ref=...` build bootstrap shell plus requested visible refs without first constructing a full client snapshot.
- Implement a scoped bootstrap snapshot builder that reads only:
  - bootstrap host models: `0`, editor mailbox/state, desktop catalog/shell, gallery state;
  - requested visible host/App-table refs after the same authorization rules used by 0436;
  - sanitized `v1nConfig`.
- Preserve 0436 direct visible snapshot behavior and all table-qualified principal/subtable checks.
- Record local browser metrics after current-HEAD local deployment.
- Out of scope:
- Changing ModelTable semantics, label contracts, PIN routing, bus topics, persistence format, or app installation behavior.
- Optimizing business round-trip latency for `Generate Color`; this iteration only targets snapshot/bootstrap/SSE first-packet construction.
- Remote deployment.

## Invariants / Constraints

- ModelTable remains the truth source; UI remains projection only.
- Snapshot optimization must not make invisible, unauthorized, deleted, internal, or cross-principal models visible.
- No silent fallback from the scoped bootstrap path to full snapshot construction when a scoped path fails.
- `profile=visible` behavior from 0436 must remain target-only.
- `/stream?profile=bootstrap&visible_model_ref=...` must still deliver bootstrap shell plus requested visible ref and preserve table-qualified `visible_model_refs` metadata.
- Any local runtime/browser claim must be verified against a redeployed local stack.

## Success Criteria

- Branch `dropx/dev_0437-bootstrap-sse-first-packet-latency` has an Approved iteration plan before runtime code changes.
- Deterministic tests prove:
  - `/snapshot?profile=bootstrap` does not call `runtime.snapshot()` or `state.clientSnap()` for response construction in ready state;
  - `/snapshot?profile=bootstrap&visible_model_ref=...` includes bootstrap shell plus requested App table model without full snapshot construction;
  - `/stream?profile=bootstrap&visible_model_ref=...` sends its first `snapshot` event without full snapshot construction;
  - polluted `ws_apps_registry`, restricted host IDs, cross-principal App tables, and host/App model-id collisions still fail closed or stay isolated.
- Existing regression tests remain green:
  - `node scripts/tests/test_0418_visible_snapshot_projection_latency_contract.mjs`
  - `node scripts/tests/test_0423_snapshot_granularity_contract.mjs`
  - `node scripts/tests/test_0425_visible_model_refs_contract.mjs`
  - `node scripts/tests/test_0425_principal_desktop_state_contract.mjs`
  - `node scripts/tests/test_0425_slide_app_subtable_install_contract.mjs`
  - `node scripts/tests/test_0426_snapshot_patch_recovery_contract.mjs`
  - `node scripts/tests/test_0435_visible_snapshot_app_slimming_contract.mjs`
  - `node scripts/tests/test_0436_runtime_snapshot_build_latency_contract.mjs`
  - `node scripts/tests/test_0414_snapshot_delta_sse_contract.mjs`
- Frontend build remains green:
  - `npm -C packages/ui-model-demo-frontend run build`
- Local browser verification records before/after metrics. Target: bootstrap and SSE first snapshot improve by at least 50% versus the 0436 local baseline (`724-833ms` bootstrap, `730ms` SSE first snapshot), or the runlog identifies the remaining dominant node with measured evidence.
- E2E 颜色生成器 still opens and changes color after local deploy.

## Inputs

- Created at: 2026-07-04
- Iteration ID: 0437-bootstrap-sse-first-packet-latency
- Baseline from 0436 current-HEAD runlog:
  - Logged-in `/snapshot?profile=bootstrap&initial_projection=1`: `832.7ms`, `724.4ms`, `779.3ms`, `792.5ms`, `29102` bytes.
  - Logged-in `/stream?profile=bootstrap&visible_model_ref=...`: first `snapshot` event `730.2ms`, `43421` bytes.
  - Logged-in explicit App-table visible snapshot after 0436: `14ms`.
  - Host-table visible snapshot after 0436: `15.6ms`.
