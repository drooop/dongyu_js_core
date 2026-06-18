---
title: "Iteration 0414 Run Log"
doc_type: iteration_runlog
status: active
updated: 2026-06-10
source: codex
---

# Iteration 0414 Run Log

规则：只记事实（FACTS）。不要写计划、不要写愿景。每个 Step 只有 PASS 才算完成。

## Environment
- OS: macOS / local k8s workspace
- Branch: `dropx/dev_0414-snapshot-delta-sse`
- Key env flags:
  - Local deploy uses remote ZITADEL SSO config from 0412.
- Notes:
  - Started from a dirty worktree that already contained 0412 latency/debug changes. Do not revert unrelated dirty files.

### Review Gate Records (FACTS)

```text
Review Gate Record
- Iteration ID: 0414-snapshot-delta-sse
- Review Date: 2026-06-10
- Review Type: sub-agent
- Reviewer: Carver
- Review Index: 1
- Decision: Change Requested
- Notes: Required stricter fallback cancellation based on visible `bus_event_last_op_id`, principal/capability baseline reset, patch redaction tests, and explicit living docs evaluation.
```

```text
Review Gate Record
- Iteration ID: 0414-snapshot-delta-sse
- Review Date: 2026-06-10
- Review Type: sub-agent
- Reviewer: Carver
- Review Index: 2
- Decision: Approved
- Notes: No findings, no open questions, no verification gaps. Plan gate approved for Step 1 RED tests.
```

```text
Review Gate Record
- Iteration ID: 0414-snapshot-delta-sse
- Review Date: 2026-06-10
- Review Type: sub-agent
- Reviewer: Carver
- Review Index: 3
- Decision: Change Requested
- Notes: Step 1 test needed a same-principal `snapshot_patch` redaction scan, not only redaction through principal reset.
```

```text
Review Gate Record
- Iteration ID: 0414-snapshot-delta-sse
- Review Date: 2026-06-10
- Review Type: sub-agent
- Reviewer: pending
- Review Index: 4
- Decision: Change Requested
- Notes: Same-principal redaction fixture had no visible guest diff after filtering; required visible allowed label change plus restricted raw content.
```

```text
Review Gate Record
- Iteration ID: 0414-snapshot-delta-sse
- Review Date: 2026-06-10
- Review Type: sub-agent
- Reviewer: pending
- Review Index: 5
- Decision: Change Requested
- Notes: Same-principal patch redaction scan only covered guest/null principal; required viewer/admin-like variants.
```

```text
Review Gate Record
- Iteration ID: 0414-snapshot-delta-sse
- Review Date: 2026-06-10
- Review Type: sub-agent
- Reviewer: Carver
- Review Index: 6
- Decision: Approved
- Notes: Step 1 RED contract approved; no findings, no open questions, no verification gaps.
```

---

## Step 1 — Patch Contract Tests
- Start time: 2026-06-10
- End time: 2026-06-10
- Branch: `dropx/dev_0414-snapshot-delta-sse`
- Commits:
- Commands executed:
- `node scripts/tests/test_0414_snapshot_delta_sse_contract.mjs`
- Key outputs:
- RED output:
  - `test_server_stream_emits_patch_after_initial_snapshot`: full snapshot event does not carry `snapshot_seq`.
  - `test_snapshot_patch_helpers_diff_apply_and_principal_reset`: server does not expose filtered snapshot / patch helpers yet.
  - `test_remote_store_patch_op_id_alone_does_not_cancel_fallback`: remote store does not register `snapshot_patch` listener yet.
  - `test_remote_store_matching_patch_cancels_fallback`: remote store does not register `snapshot_patch` listener yet.
- Review fix:
  - Added same-principal filtered `snapshot_patch` redaction scan so a normal patch cannot expose restricted model ids, restricted label keys/types, token-like values, or function code labels.
  - Revised the same-principal fixture so filtered next snapshot also changes allowed model `100` from `Before` to `After`, forcing a real non-empty patch path.
  - Extended same-principal redaction scan to guest, viewer-like, and admin-like principal cases.
- Result: PASS (RED contract established)

---

## Step 2 — Server Patch Stream
- Start time: 2026-06-10
- End time: 2026-06-10
- Branch: `dropx/dev_0414-snapshot-delta-sse`
- Commits:
- Commands executed:
- `node scripts/tests/test_0414_snapshot_delta_sse_contract.mjs --server-only`
- `node scripts/tests/test_0403_principal_authorization.mjs`
- `node scripts/tests/test_0412_local_latency_trace_contract.mjs`
- Key outputs:
- `PASS test_0414_snapshot_delta_sse_contract: 2 passed`
- `test_0403_principal_authorization.mjs`: `6 passed, 0 failed out of 6`
- `PASS test_0412_local_latency_trace_contract: 9 passed`
- Server stream behavior now:
  - initial `/stream` event remains full `snapshot` and carries `snapshot_seq`;
  - subsequent small `bus_event` emits `snapshot_patch`;
  - same-principal server helper redaction scans pass for guest, viewer-like, and admin-like cases;
  - principal/capability key change returns full `snapshot` reset instead of cross-principal patch.
- Full 0414 test still intentionally has client-side failures; Step 3 owns `applyClientSnapshotPatch` and `snapshot_patch` EventSource handling.
- Sub-agent review:
  - First Step 2 review requested aligning `resolution.md` Step 2 detail validation with `--server-only`.
  - After correction, Step 2 review decision: Approved; no findings, no open questions, no verification gaps.
- Result: PASS

---

## Step 3 — Client Patch Apply
- Start time: 2026-06-10
- End time: 2026-06-10
- Branch: `dropx/dev_0414-snapshot-delta-sse`
- Commits:
- Commands executed:
- `node scripts/tests/test_0414_snapshot_delta_sse_contract.mjs`
- `node scripts/tests/test_0412_local_latency_trace_contract.mjs`
- `node scripts/tests/test_0329_bus_event_last_op_id_snapshot_contract.mjs`
- `node scripts/tests/test_0403_principal_authorization.mjs`
- Key outputs:
- `PASS test_0414_snapshot_delta_sse_contract: 7 passed`
- `PASS test_0412_local_latency_trace_contract: 9 passed`
- `PASS test_0329_bus_event_last_op_id_snapshot_contract`
- `test_0403_principal_authorization.mjs`: `6 passed, 0 failed out of 6`
- Client behavior now:
  - exports `applyClientSnapshotPatch` for deterministic patch apply tests;
  - validates `base_snapshot_seq` before patch apply;
  - listens to `snapshot_patch` SSE events;
  - applies patch through the same `applySnapshot()` path, so 0412 fallback is cancelled only when the visible snapshot carries matching `bus_event_last_op_id`;
  - patch apply failure triggers full `/snapshot` recovery.
- Sub-agent review fix:
  - `snapshot_patch` now respects `pauseSse`; paused patches update only pending snapshot and do not update visible state or cancel fallback.
  - Added tests for base seq mismatch full recovery, delete model/cell/label, `replace_v1n_config`, no base mutation, and paused patch behavior.
- Sub-agent review:
  - Step 3 review decision: Approved; no findings, no open questions, no verification gaps.
- Result: PASS

---

## Step 4 — Local Deploy And Browser Verification
- Start time: 2026-06-10
- End time: 2026-06-10
- Branch: `dropx/dev_0414-snapshot-delta-sse`
- Commits:
- Commands executed:
- `SKIP_MATRIX_BOOTSTRAP=1 bash scripts/ops/deploy_local.sh`
- `kubectl -n dongyu get deploy ui-server mbr-worker remote-worker workspace-manager -o jsonpath=...`
- `python3` deployed `/snapshot` probe against `http://localhost:30900/snapshot`
- `python3` deployed `/stream` first snapshot frame probe against `http://localhost:30900/stream`
- `node --input-type=module` patch-size probe using deployed `/snapshot` content and `buildClientSnapshotPatchMessage`
- bundled Playwright/Chromium browser script against `http://localhost:30900/#/`
- `git diff --check -- ...`
- Key outputs:
- Local deploy completed; final UI asset from build: `assets/index-TzXsF7M1.js`.
- Deployment readiness:
  - `ui-server 1/1`
  - `mbr-worker 1/1`
  - `remote-worker 1/1`
  - `workspace-manager 1/1`
- Deployed `/snapshot`: `status=200`, `bytes=576548`, `has_seq=True`.
- Deployed `/stream` first full snapshot frame: `snapshot_frame_bytes=576570`, `has_snapshot_seq=True`.
- Representative patch-size probe using the deployed snapshot content:
  - `message_event=snapshot_patch`
  - `patch_payload_bytes=364`
  - `patch_ops=1`
  - `ratio=0.000631` compared with full snapshot response.
- Browser verification:
  - URL: `http://localhost:30900/#/`
  - page title: `UI Model Demo`
  - loaded JS: `http://localhost:30900/assets/index-TzXsF7M1.js`
  - network: `/snapshot` 200, `/stream` 200, `/auth/me` 401 expected for unauthenticated browser.
  - viewport check at 1440x1000: `docScrollWidth=1440`, `docClientWidth=1440`, `docScrollHeight=1000`, `docClientHeight=1000`; no outer horizontal or vertical scroll.
  - Browser process closed in `finally`; no new temporary Playwright Chrome process remained.
- Note:
  - The deployed instance uses remote SSO, so the automated deployed probe could not POST a write without a real login cookie. Actual authenticated SSE patch emission is covered by `test_0414_snapshot_delta_sse_contract.mjs`; deployed service was verified for full snapshot/stream metadata, build asset, page rendering, and no outer scroll.
- `git diff --check` on touched 0414 files: PASS.
- Sub-agent review:
  - Step 4 review decision: Approved.
  - Reviewer accepted the boundary: deployed instance was verified for readiness, full snapshot/stream metadata, browser loading, and no outer scroll; authenticated patch emission is covered by deterministic 0414 contract tests because deployed remote SSO requires a real login cookie.
- Result: PASS

---

## Step 5 — Final Docs And Review
- Start time: 2026-06-10
- End time: 2026-06-10 20:46:58 +0800
- Branch: `dropx/dev_0414-snapshot-delta-sse`
- Commits:
- Commands executed:
- `rg -n "SSE|/stream|snapshot_patch|snapshot_seq|EventSource|broadcast snapshot|广播 snapshot|bus_event_last_op_id" docs/ssot docs/user-guide docs/iterations/0414-snapshot-delta-sse`
- `sed -n '68,92p' docs/ssot/ui_to_matrix_event_flow.md`
- `sed -n '980,1105p' docs/ssot/runtime_semantics_modeltable_driven.md`
- `node scripts/tests/test_0414_snapshot_delta_sse_contract.mjs`
- `node scripts/tests/test_0412_local_latency_trace_contract.mjs`
- `node scripts/tests/test_0329_bus_event_last_op_id_snapshot_contract.mjs`
- `node scripts/tests/test_0403_principal_authorization.mjs`
- `git diff --check -- packages/ui-model-demo-server/server.mjs packages/ui-model-demo-frontend/src/remote_store.js scripts/tests/test_0414_snapshot_delta_sse_contract.mjs docs/iterations/0414-snapshot-delta-sse/plan.md docs/iterations/0414-snapshot-delta-sse/resolution.md docs/iterations/0414-snapshot-delta-sse/runlog.md docs/ITERATIONS.md docs/ssot/runtime_semantics_modeltable_driven.md docs/ssot/ui_to_matrix_event_flow.md`
- Key outputs:
- `docs/ssot/ui_to_matrix_event_flow.md` still described successful UI events as "broadcast snapshot". Updated it to the current contract: initial full `snapshot`, later same-principal/capability `snapshot_patch`, full snapshot recovery on auth baseline change, oversize patch, or sequence mismatch.
- `docs/ssot/runtime_semantics_modeltable_driven.md` did not yet freeze client-visible snapshot transport. Added `7.5g Client Snapshot 传输规则`:
  - `/snapshot` remains the full recovery surface.
  - `/stream` initial event remains full snapshot.
  - Later same-session changes prefer `snapshot_patch`.
  - Patch diff must be generated only from already-filtered client snapshots.
  - Principal/capability change must reset with full snapshot, not cross-permission patch.
  - `base_snapshot_seq` mismatch must recover with `/snapshot`.
  - `snapshot_patch` envelope `op_id` is metadata only and cannot release `bus_event_v2` waiting state without matching visible `bus_event_last_op_id`.
- `docs/user-guide/modeltable_user_guide.md` was evaluated but not changed in this iteration: no developer fill-table syntax changed, and the patch stream is a UI Server transport optimization.
- `docs/ssot/tier_boundary_and_conformance_testing.md` was evaluated but not changed: no Tier 2 authoring boundary changed.
- Validation:
  - `PASS test_0414_snapshot_delta_sse_contract: 7 passed`
  - `PASS test_0412_local_latency_trace_contract: 9 passed`
  - `PASS test_0329_bus_event_last_op_id_snapshot_contract`
  - `test_0403_principal_authorization.mjs`: 6 passed, 0 failed
  - `git diff --check`: PASS
- Cleanup:
  - Removed the now-unused per-client snapshot JSON string cache after `sendSnapshot` moved to structured full-snapshot and patch messages.
- Final sub-agent review:
  - First final review decision: CHANGE_REQUESTED.
  - Finding: client-side `snapshot_patch` accepted missing/non-integer `snapshot_seq` or `base_snapshot_seq`, so a malformed patch could mutate visible state instead of forcing full `/snapshot` recovery.
  - Fix: `remote_store` now requires integer `snapshot_seq` and `base_snapshot_seq`; missing, non-integer, or mismatched base sequence throws and uses the existing `/snapshot` recovery path.
  - Test update: `test_remote_store_invalid_patch_seq_recovers_full_snapshot` now covers missing `snapshot_seq`, missing `base_snapshot_seq`, non-integer `base_snapshot_seq`, and mismatched `base_snapshot_seq`.
  - Re-validation:
    - `PASS test_0414_snapshot_delta_sse_contract: 7 passed`
    - `PASS test_0412_local_latency_trace_contract: 9 passed`
    - `PASS test_0329_bus_event_last_op_id_snapshot_contract`
    - `test_0403_principal_authorization.mjs`: 6 passed, 0 failed
    - `git diff --check`: PASS
  - Final re-review decision: APPROVED.
- Result: PASS
