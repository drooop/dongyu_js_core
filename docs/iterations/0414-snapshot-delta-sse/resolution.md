---
title: "Iteration 0414 Resolution"
doc_type: iteration_resolution
status: planned
updated: 2026-06-10
source: codex
---

# Iteration 0414 Resolution

## 0. Execution Rules
- Work branch: `dropx/dev_0414-snapshot-delta-sse`
- Steps must be executed in order.
- No step skipping.
- Each step must have executable validation.
- After each step, request sub-agent `codex-code-review`; fix all blocking findings before continuing.
- Any real execution evidence must go to `runlog.md`, not this file.

## 1. Steps Overview

| Step | Title | Scope (Short) | Files (Key) | Validation (Executable) | Acceptance Criteria | Rollback |
|------|-------|---------------|-------------|--------------------------|--------------------|----------|
| 1 | Patch Contract Tests | Add failing deterministic tests for snapshot metadata, diff/apply, stream event shape, redaction, principal reset, stale patch behavior | `scripts/tests/test_0414_snapshot_delta_sse_contract.mjs` | `node scripts/tests/test_0414_snapshot_delta_sse_contract.mjs` | RED before implementation; tests express exact patch behavior, redaction, principal reset, and safety fallback | Delete test file |
| 2 | Server Patch Stream | Implement server-side snapshot seq, principal-scoped last snapshot cache, patch generation, stream `snapshot_patch` events, fallback to full snapshot | `packages/ui-model-demo-server/server.mjs` | `node scripts/tests/test_0414_snapshot_delta_sse_contract.mjs --server-only`; selected auth/snapshot regressions | Stream initial full snapshot remains; later small update emits patch; no unfiltered data leak | Revert server changes |
| 3 | Client Patch Apply | Implement remote_store patch event handling, seq validation, local merge, and full snapshot recovery on mismatch/failure | `packages/ui-model-demo-frontend/src/remote_store.js`; `scripts/tests/test_0412_local_latency_trace_contract.mjs` | `node scripts/tests/test_0412_local_latency_trace_contract.mjs`; `node scripts/tests/test_0414_snapshot_delta_sse_contract.mjs` | Client patch state equals full snapshot; 0412 fallback remains correct | Revert client changes |
| 4 | Local Deploy And Browser Verification | Deploy local build, measure snapshot vs patch frame, verify page and no outer scroll | deploy/runtime scripts only by command; `runlog.md` | `SKIP_MATRIX_BOOTSTRAP=1 bash scripts/ops/deploy_local.sh`; browser/Playwright; curl stream measurement | Local services 1/1; browser loads; patch frame evidence recorded | Redeploy previous image/commit |
| 5 | Final Docs And Review | Record results, review living docs need, final sub-agent review | `docs/iterations/0414-snapshot-delta-sse/runlog.md`; maybe docs SSOT if contract becomes normative | targeted tests + `git diff --check` | All step records PASS; final review APPROVED | Revert docs-only final edits |

## 2. Step Details

### Step 1 — Patch Contract Tests
**Goal**
- Freeze what `snapshot_patch` means before changing runtime code.

**Scope**
- Create `scripts/tests/test_0414_snapshot_delta_sse_contract.mjs`.
- Tests should cover:
  - exported/available helper behavior for diff/apply, or server-observable behavior if helpers stay private;
  - initial stream event remains `snapshot`;
  - subsequent small label update can emit `snapshot_patch`;
  - patch envelope has `snapshot_seq`, `base_snapshot_seq`, `op_id`;
  - patch payload for guest/viewer/admin-like principals is scanned for restricted model ids, restricted label keys/types, and token-like values;
  - an open SSE connection whose principal/capability key changes must receive a full `snapshot` reset rather than a cross-principal `snapshot_patch`;
  - patch envelope `op_id` alone never cancels deferred fallback; fallback can only be cancelled after the applied visible snapshot state carries matching `bus_event_last_op_id`.

**Files**
- Create/Update:
  - `scripts/tests/test_0414_snapshot_delta_sse_contract.mjs`
- Must NOT touch:
  - production source files in this step.

**Validation (Executable)**
- Commands:
  - `node scripts/tests/test_0414_snapshot_delta_sse_contract.mjs --server-only`
- Expected signals:
  - RED: fails because `snapshot_patch` support is not implemented yet.

**Acceptance Criteria**
- The failure is caused by missing patch stream behavior, not syntax/test setup errors.

**Rollback Strategy**
- Remove the test file.

---

### Step 2 — Server Patch Stream
**Goal**
- Make `/stream` patch-first after the initial full snapshot.

**Scope**
- Add server-side client-visible diff generation.
- Track per-SSE-client `lastSnapshot`, `lastSnapshotSeq`, and principal/capability key.
- If current principal/capability key differs from the stored baseline key, send a full filtered `snapshot` reset and replace the baseline; do not generate patch across the boundary.
- Send full `snapshot` on connect or when diff is too large/unsafe.
- Send `snapshot_patch` for normal small changes.

**Files**
- Create/Update:
  - `packages/ui-model-demo-server/server.mjs`
  - `scripts/tests/test_0414_snapshot_delta_sse_contract.mjs` only if test needs small adjustment without weakening requirements.
- Must NOT touch:
  - runtime persistence semantics.
  - program model execution contracts.

**Validation (Executable)**
- Commands:
  - `node scripts/tests/test_0414_snapshot_delta_sse_contract.mjs --server-only`
  - `node scripts/tests/test_0403_principal_authorization.mjs`
  - `node scripts/tests/test_0412_local_latency_trace_contract.mjs`
- Expected signals:
  - 0414 contract tests pass.
  - auth/snapshot filtering regressions remain green.

**Acceptance Criteria**
- Initial SSE event remains full snapshot.
- Subsequent small change emits `snapshot_patch`.
- Guest/admin filtered snapshots remain capability-safe.
- Principal/capability key changes never produce cross-principal patch payloads.

**Rollback Strategy**
- Revert server-side helper and stream changes.

---

### Step 3 — Client Patch Apply
**Goal**
- Let browser consume `snapshot_patch` without replacing the whole snapshot.

**Scope**
- Add patch application in `remote_store`.
- Validate `base_snapshot_seq` before applying.
- If patch validation fails, call `/snapshot` and apply full state.
- Preserve 0412 deferred fallback cancellation only after the applied visible snapshot state contains `bus_event_last_op_id` equal to expected op id. The patch envelope `op_id` is metadata only and must not release fallback by itself.

**Files**
- Create/Update:
  - `packages/ui-model-demo-frontend/src/remote_store.js`
  - `scripts/tests/test_0412_local_latency_trace_contract.mjs`
  - `scripts/tests/test_0414_snapshot_delta_sse_contract.mjs`
- Must NOT touch:
  - UI component definitions unless a test proves they must adapt.

**Validation (Executable)**
- Commands:
  - `node scripts/tests/test_0412_local_latency_trace_contract.mjs`
  - `node scripts/tests/test_0414_snapshot_delta_sse_contract.mjs`
  - `node scripts/tests/test_0329_bus_event_last_op_id_snapshot_contract.mjs`
- Expected signals:
  - 0412 remains 9/9 or grows with new patch tests.
  - 0414 client patch tests pass.

**Acceptance Criteria**
- Applying patch produces same state as full snapshot for tested operations.
- Out-of-order patch triggers full snapshot recovery.
- stale/unrelated patch cannot release bus-event fallback.
- patch envelope `op_id` without a matching visible `bus_event_last_op_id` cannot release bus-event fallback.

**Rollback Strategy**
- Revert remote_store patch handling and related tests.

---

### Step 4 — Local Deploy And Browser Verification
**Goal**
- Prove the optimization works in the actual local service and browser.

**Scope**
- Build/deploy local cluster.
- Verify service readiness.
- Measure `/snapshot` size and a representative `snapshot_patch` SSE event size.
- Use browser/Playwright to open workspace, check loaded asset, page render, no outer scroll.

**Files**
- Create/Update:
  - `docs/iterations/0414-snapshot-delta-sse/runlog.md`
- Must NOT touch:
  - remote/cloud deployment files unless local deployment requires a deterministic config correction.

**Validation (Executable)**
- Commands:
  - `SKIP_MATRIX_BOOTSTRAP=1 bash scripts/ops/deploy_local.sh`
  - `kubectl -n dongyu get deploy ui-server mbr-worker remote-worker workspace-manager -o jsonpath='...'`
  - curl or node SSE probe against `http://localhost:30900/stream`
  - Browser/Playwright against `http://localhost:30900/#/`
- Expected signals:
  - all deploys 1/1.
  - browser loads current JS asset.
  - no outer horizontal/vertical scroll at 1440x1000.
  - patch frame smaller than full snapshot frame for a small update.

**Acceptance Criteria**
- Real local browser flow is verified, not just script tests.

**Rollback Strategy**
- Redeploy previous local image or revert iteration changes.

---

### Step 5 — Final Docs And Review
**Goal**
- Close the iteration with evidence and final review.

**Scope**
- Update runlog with all PASS evidence.
- Assess whether SSOT/user guide needs updates for `/stream snapshot_patch`; at minimum review `docs/user-guide/modeltable_user_guide.md`, `docs/ssot/runtime_semantics_modeltable_driven.md`, `docs/ssot/ui_to_matrix_event_flow.md`, and `docs/ssot/tier_boundary_and_conformance_testing.md`, then record update or no-update rationale.
- Final sub-agent review.

**Files**
- Create/Update:
  - `docs/iterations/0414-snapshot-delta-sse/runlog.md`
  - `docs/ITERATIONS.md`
  - `docs/user-guide/modeltable_user_guide.md` if the final implementation changes developer-visible behavior.
  - `docs/ssot/runtime_semantics_modeltable_driven.md` / `docs/ssot/ui_to_matrix_event_flow.md` if the final implementation changes normative stream semantics.

**Validation (Executable)**
- Commands:
  - `git diff --check`
  - targeted tests from Steps 2-3
- Expected signals:
  - no whitespace errors.
  - final sub-agent review `APPROVED`.

**Acceptance Criteria**
- All review findings addressed.
- User can see the final optimization evidence in runlog.

**Rollback Strategy**
- Revert docs-only completion updates.
