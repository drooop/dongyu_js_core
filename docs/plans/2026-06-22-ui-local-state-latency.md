---
title: "UI Local State Latency Implementation Plan"
doc_type: implementation-plan
status: completed
updated: 2026-06-22
source: ai
iteration_id: 0420-ui-local-state-latency
---

# UI Local State Latency Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** reduce login-after and post-load UI latency by ensuring local-only UI state does not block formal business events.

**Architecture:** keep ModelTable and `bus_event_v2` formal business paths unchanged. Move local-only `/ui_event` synchronization to a low-priority background path, while submit-critical overlays remain resolved before `/bus_event` dispatch.

**Tech Stack:** Vue frontend, `remote_store.js`, ModelTable snapshot/SSE, Node deterministic test scripts, Chrome/Playwright browser verification.

---

## Done Criteria

- Deterministic test proves queued local-only `/ui_event` work cannot block a later `/bus_event`.
- Deterministic tests preserve Input local overlay and submit-current-visible-value behavior.
- Browser evidence records baseline and final latency for first app content, Dialog open/close, Tab switch, Input fill, and network timing.
- Browser evidence includes outer page scroll, inner app scroll, overflow, and clipped-content checks for the tested screens.
- Final `runlog.md` includes a before/after latency table.
- Every task, including RED-only Task 1 and final closeout, has a sub-agent `codex-code-review` gate before the next task starts.

## Task 1: RED Contract Tests

**Files:**
- Create or modify: `scripts/tests/test_0420_ui_local_state_latency_contract.mjs`
- Modify: `docs/iterations/0420-ui-local-state-latency/runlog.md`

**Steps:**
1. Write tests that simulate slow local-only `/ui_event` background sync followed by a formal `/bus_event`.
2. Run `node scripts/tests/test_0420_ui_local_state_latency_contract.mjs`.
3. Confirm RED for the current queueing behavior.
4. Record the RED output and baseline browser metrics in `runlog.md`.
5. Request sub-agent review with `codex-code-review`.
6. Do not start Task 2 until the RED tests and baseline record are reviewed and approved, or all review findings are fixed and re-reviewed.

## Task 2: Non-Blocking Local UI Sync

**Files:**
- Modify: `packages/ui-model-demo-frontend/src/remote_store.js`
- Modify: `scripts/tests/test_0420_ui_local_state_latency_contract.mjs`
- Modify: `docs/iterations/0420-ui-local-state-latency/runlog.md`

**Steps:**
1. Add a separate background queue for local-only `/ui_event`.
2. Keep formal `/bus_event` on the existing business queue.
3. Preserve submit overlay flushing before formal submit dispatch.
4. Run:
   - `node scripts/tests/test_0420_ui_local_state_latency_contract.mjs`
   - `node scripts/tests/test_0417_user_isolated_ui_state_projection_contract.mjs`
   - `node scripts/tests/test_0412_local_latency_trace_contract.mjs`
5. Request sub-agent review with `codex-code-review`.

## Task 3: Auth Startup Display

**Files:**
- Modify: `packages/ui-model-demo-frontend/src/auth_store.js`
- Modify: `packages/ui-model-demo-frontend/src/main.js` or `packages/ui-model-demo-frontend/src/demo_app.js`
- Modify: `scripts/tests/test_0420_ui_local_state_latency_contract.mjs`
- Modify: `docs/iterations/0420-ui-local-state-latency/runlog.md`

**Steps:**
1. Prevent authenticated startup from briefly presenting a stable guest/read-only unavailable state while auth is still checking.
2. Keep true guest behavior unchanged.
3. Run:
   - `node scripts/tests/test_0420_ui_local_state_latency_contract.mjs`
   - `node scripts/tests/test_0403_oidc_session_gateway.mjs`
4. Request sub-agent review with `codex-code-review`.

## Task 4: Deploy And Browser Metrics

**Files:**
- Modify: `docs/iterations/0420-ui-local-state-latency/runlog.md`
- Optional assets under: `docs/iterations/0420-ui-local-state-latency/assets/`

**Steps:**
1. Build the frontend.
2. Deploy or restart the affected local stack according to the current local runtime path.
3. Use a real authenticated browser.
4. Measure and record:
   - login-to-app-content;
   - To Do Dialog open/close;
   - Tab switch;
   - Input feedback;
   - `/ui_event`, `/bus_event`, `/snapshot` timing and bytes.
5. Check and record outer page scroll, inner app scroll, overflow, and clipped-content state for the tested screens.
6. Request sub-agent review with `codex-code-review`.

## Task 5: Final Review And Closeout

**Files:**
- Modify: `docs/iterations/0420-ui-local-state-latency/runlog.md`
- Modify: `docs/ITERATIONS.md`

**Steps:**
1. Run regression tests listed in `resolution.md`.
2. Request final sub-agent review over the full 0420 diff.
3. Fix findings until approved.
4. Record final metrics table and docs assessment.
