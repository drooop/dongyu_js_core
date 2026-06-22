---
title: "Iteration 0420 UI Local State Latency Runlog"
doc_type: iteration-runlog
status: completed
updated: 2026-06-22
source: ai
iteration_id: 0420-ui-local-state-latency
id: 0420-ui-local-state-latency
phase: completed
---

# Iteration 0420-ui-local-state-latency Runlog

## Environment

- Date: 2026-06-22
- Branch: `dropx/dev_0420-ui-local-state-latency`
- Runtime: local `dongyu` namespace through `http://localhost:30900/#/`

## Phase 1 Planning

Review Gate Record
- Iteration ID: `0420-ui-local-state-latency`
- Review Date: 2026-06-22
- Review Type: User
- Review Index: 0
- Decision: Approved to prepare plan and request sub-agent review
- Notes: User asked to write the plan, use sub-agent review, then implement in small reviewed stages with explicit latency metrics.

Review Gate Record
- Iteration ID: `0420-ui-local-state-latency`
- Review Date: 2026-06-22
- Review Type: AI-assisted sub-agent
- Review Index: 1
- Decision: Change Requested
- Notes: Plan review requested explicit Task 1 sub-agent review gate and browser outer/inner scroll/overflow check in the executable plan.

Review Gate Record
- Iteration ID: `0420-ui-local-state-latency`
- Review Date: 2026-06-22
- Review Type: AI-assisted sub-agent
- Review Index: 2
- Decision: Approved
- Notes: Plan was updated with Task 1 review gate and browser scroll/overflow checks; sub-agent review returned no findings.

## Baseline Measurements Before Implementation

- Browser context: authenticated Chrome session at `http://localhost:30900/#/`.
- Fresh authenticated tab to selected app content visible: about 3920ms.
- Startup sequence observed:
  - about 321ms: `访客只读 / 登录 / 页面暂不可用`
  - about 876ms: authenticated user appears but selected app body says `正在加载滑动 APP...`
  - about 3920ms: selected app content visible
- To Do Board Dialog open: about 1881ms.
- To Do Board Dialog close: about 1949ms.
- To Do Board Tab switch: about 316ms.
- To Do Board Input fill visible feedback: about 38ms.
- Dialog network trace:
  - local-only `/ui_event` requests appeared before the formal event and were serialized;
  - observed `/ui_event` spans included about 1.5s to 4.0s;
  - formal `/bus_event` response was about 1.44s;
  - fallback `/snapshot` response was about 0.54s and 199517 bytes.
- E2E Color Generator was not a valid latency metric in this baseline:
  - visible `MBR READY=false`;
  - `Generate Color` button had disabled/loading state;
  - remote-worker logs showed no matching MQTT request after the click attempt.

## Execution Records

### Step 1 — RED Contract Tests And Baseline Evidence

- Command: `node scripts/tests/test_0420_ui_local_state_latency_contract.mjs`
- Key output:
  - `PASS default_input_submit_policy_is_local_only`
  - `PASS submit_reads_visible_overlay_and_keeps_model0_bus_path`
  - `PASS dialog_tabs_and_view_state_are_local_only`
  - `PASS on_submit_overlay_flush_stays_before_formal_bus_event`
  - `FAIL test_local_ui_sync_does_not_block_formal_bus_event_dispatch: formal /bus_event must dispatch immediately even while local-only /ui_event is still pending`
  - `false !== true`
  - `FAIL test_0420_ui_local_state_latency_contract: 1 failed, 4 passed`
- Result: RED PASS — the new contract test fails for the expected reason before implementation.
- Commit: pending

### Step 2 — Separate Local UI Sync From Formal Business Queue

- Command:
  - `node scripts/tests/test_0420_ui_local_state_latency_contract.mjs`
  - `node scripts/tests/test_0417_user_isolated_ui_state_projection_contract.mjs`
  - `node scripts/tests/test_0412_local_latency_trace_contract.mjs`
- Key output:
  - `PASS test_0420_ui_local_state_latency_contract: 6 passed`
  - `PASS 10/10`
  - `PASS test_0412_local_latency_trace_contract: 11 passed`
- Result: PASS — local-only `/ui_event` now uses a separate background queue, formal `/bus_event` dispatch is no longer blocked by pending local UI sync, and formal `/bus_event` calls remain serialized and ordered.
- Commit:

Review Gate Record
- Iteration ID: `0420-ui-local-state-latency`
- Review Date: 2026-06-22
- Review Type: AI-assisted sub-agent
- Review Index: 3
- Decision: Change Requested, then Approved after adding formal `/bus_event` ordering coverage
- Notes: Sub-agent review required proof that formal `/bus_event` calls remain serialized and ordered after moving `/ui_event` to its own background queue.

### Step 3 — Auth Startup And First Usable App Display

- Command:
  - RED: `node scripts/tests/test_0420_ui_local_state_latency_contract.mjs`
  - GREEN: `node scripts/tests/test_0420_ui_local_state_latency_contract.mjs`
  - `node scripts/tests/test_0403_oidc_session_gateway.mjs`
  - `node scripts/tests/test_0403_frontend_auth_ux_contract.mjs`
- Key output:
  - RED: `FAIL test_auth_session_checking_is_distinct_from_confirmed_guest: new auth store must start before guest/authenticated is known`
  - RED: `FAIL test_0420_ui_local_state_latency_contract: 1 failed, 6 passed`
  - GREEN: `PASS test_0420_ui_local_state_latency_contract: 7 passed`
  - `15 passed, 0 failed out of 15`
  - `6 passed, 0 failed out of 6`
- Result: PASS — startup auth state now distinguishes session-checking from confirmed guest, so the header no longer presents a stable guest/read-only state while `/auth/me` is still pending.
- Commit:

Review Gate Record
- Iteration ID: `0420-ui-local-state-latency`
- Review Date: 2026-06-22
- Review Type: AI-assisted sub-agent
- Review Index: 4
- Decision: Approved
- Notes: Auth startup change was reviewed with no findings.

Review Gate Record
- Iteration ID: `0420-ui-local-state-latency`
- Review Date: 2026-06-22
- Review Type: AI-assisted sub-agent
- Review Index: 5
- Decision: Change Requested, then Approved after adding `app:write` positive coverage
- Notes: Review requested proof that authenticated sessions with `app:write` still sync local UI state while Matrix-only read sessions keep local UI state browser-local.

Review Gate Record
- Iteration ID: `0420-ui-local-state-latency`
- Review Date: 2026-06-22
- Review Type: AI-assisted sub-agent
- Review Index: 6
- Decision: Approved
- Notes: EventSource lifecycle cleanup was reviewed with no findings.

### Step 4 — Local Deploy And Real Browser Latency Verification

- Command:
- `npm -C packages/ui-model-demo-frontend run build`
- `SKIP_MATRIX_BOOTSTRAP=1 bash scripts/ops/deploy_local.sh`
- `bash scripts/ops/check_runtime_baseline.sh`
- Real Chrome Playwright script using `http://127.0.0.1:30900/#/` and remote Matrix homeserver login.
- Key output:
  - Build emitted `assets/index-DCk54Hnc.js` and `assets/index-Cxdet_aj.css`.
  - Local pods after rollout: `ui-server`, `mbr-worker`, `remote-worker`, `workspace-manager`, `mosquitto`, `synapse` all `Running`.
  - `check_runtime_baseline.sh`: baseline ready.
  - After recreating `ui-server-nodeport`, `http://127.0.0.1:30900/` returned `status=200`, asset `index-DCk54Hnc.js`.
  - Browser login user: `@drop:synapse.dongyudigital.com`.
  - Browser capabilities: `app:read`, `workspace:read`, `matrix:connect`.
  - Page metrics:
    - DOM content loaded: `124ms`.
    - Desktop visible: `574ms`.
    - Auth session settled: `1214ms`.
    - Open To Do Board: `766ms`, including visible model snapshot.
    - To Do view tab switch: `139ms`, no network request.
    - Detail Drawer open: `147ms`, no network request.
    - Restricted `新增任务` click: `981ms`, correctly rejected by `app:write` gate.
  - Network metrics:
    - `/auth/me`: `263ms`, `687B` transfer.
    - Bootstrap `/snapshot?profile=bootstrap`: `264ms`, `157453B` transfer.
    - Visible `/snapshot?profile=visible&model_id=1086`: `323ms`, `182140B` transfer.
    - Restricted `/bus_event`: `3ms`, `403 permission_denied`, `397B` transfer.
  - Local UI state metrics:
    - To Do tab switch and Detail Drawer open produced no `/ui_event` and no `/bus_event`.
    - Matrix password login is read-only for app writes, so `新增任务` Dialog cannot be used as a local-only Dialog sample under this account; it is a formal write/edit operation and correctly hits `app:write` permission gate.
  - Scroll / overflow metrics:
    - Desktop, To Do Board, To Do after tab, Detail Drawer, restricted add state, and Gallery all reported no document horizontal or vertical outer overflow.
    - Gallery uses internal `app-content-slot` scrolling: `overflowY=auto`, `scrollHeight=5917`, `clientHeight=786`, `after scrollTop=5131`, document `scrollTop=0`.
  - Test-process cleanup:
    - `bash scripts/ops/playwright_session_guard.sh check-clean`: PASS.
- Result: PASS — local deploy runs the updated frontend, real browser metrics are recorded, local UI-only interactions no longer wait for `/ui_event`, and outer document scrolling is prevented while ordinary pages retain internal scrolling.
- Commit:

Review Gate Record
- Iteration ID: `0420-ui-local-state-latency`
- Review Date: 2026-06-22
- Review Type: AI-assisted sub-agent
- Review Index: 7
- Decision: Change Requested, then Approved after fixes
- Notes: Review found that the first viewport fix could clip ordinary pages and left `100dvh` in the foreground model template. Fixed by making ordinary pages use internal `overflow:auto`, keeping foreground clipped, and changing desktop/foreground model roots to `height=100%`.

### Step 5 — Final Review, Docs Assessment, And Completion

- Command:
- `node scripts/tests/test_0420_ui_local_state_latency_contract.mjs`
- `node scripts/tests/test_0400_viewport_playwright_guard_contract.mjs`
- `node scripts/tests/test_0390_focused_app_shell_settings_contract.mjs`
- `node scripts/tests/test_0417_user_isolated_ui_state_projection_contract.mjs`
- `node scripts/tests/test_0412_local_latency_trace_contract.mjs`
- `node scripts/tests/test_0418_visible_snapshot_projection_latency_contract.mjs`
- `node scripts/tests/test_0403_frontend_auth_ux_contract.mjs`
- `npm -C packages/ui-model-demo-frontend run build`
- `git diff --check`
- `bash scripts/ops/playwright_session_guard.sh cleanup`
- `bash scripts/ops/playwright_session_guard.sh check-clean`
- Key output:
  - `PASS test_0420_ui_local_state_latency_contract: 12 passed`
  - `test_0400_viewport_playwright_guard_contract.mjs`: `6 passed, 0 failed out of 6`
  - `test_0390_focused_app_shell_settings_contract.mjs`: `15 passed, 0 failed out of 15`
  - `test_0417_user_isolated_ui_state_projection_contract.mjs`: `PASS 10/10`
  - `test_0412_local_latency_trace_contract.mjs`: `PASS test_0412_local_latency_trace_contract: 11 passed`
  - `test_0418_visible_snapshot_projection_latency_contract.mjs`: `PASS 7/7`
  - `test_0403_frontend_auth_ux_contract.mjs`: `6 passed, 0 failed out of 6`
  - Frontend build succeeded with asset `index-DCk54Hnc.js`.
  - `git diff --check`: no output.
  - Playwright guard cleanup/check-clean: PASS.
- Result: PASS — deterministic tests, real browser evidence, local deployment, scroll/overflow checks, and final cleanup all passed.
- Commit:

Review Gate Record
- Iteration ID: `0420-ui-local-state-latency`
- Review Date: 2026-06-22
- Review Type: AI-assisted sub-agent
- Review Index: 8
- Decision: Change Requested, then Approved after metric comparison was split by endpoint
- Notes: Final review requested same-metric comparison in the latency table. The runlog now separates first usable desktop/auth state from opening To Do Board app content. Re-review returned no findings and no verification gaps.

## Docs Updated

- [x] `docs/ssot/runtime_semantics_modeltable_driven.md` reviewed
- [x] `docs/user-guide/modeltable_user_guide.md` reviewed
- [x] `docs/ssot/execution_governance_ultrawork_doit.md` reviewed

## Final Latency Comparison

| Metric | Baseline before 0420 | Final local browser result | Change |
|---|---:|---:|---|
| Fresh authenticated tab to first usable desktop/auth state | guest/read-only flash at about `321ms`; authenticated user visible at about `876ms` while selected app still loading | desktop visible `574ms`; auth settled `1214ms` | comparable startup/auth-state metric; no longer treats unknown session as confirmed guest/read-only |
| Open To Do Board app content | selected app content visible at about `3920ms` in baseline trace | To Do Board content visible `766ms` after click; visible model snapshot `323ms` / `182140B` | app-content opening is separately recorded from first desktop/auth state |
| To Do local Dialog open | about `1881ms` | not applicable for Matrix password login; `新增任务` is gated by `app:write` | cannot compare under read-only account |
| To Do tab switch | about `316ms` | `139ms` | improved; no network request |
| Detail Drawer open | not recorded | `147ms` | local UI-only interaction; no network request |
| Input visible feedback | about `38ms` | deterministic contract remains local-first; browser input sample blocked by read-only app-write gate | unchanged contract; needs app-write session for browser sample |
| `/ui_event` local state sync | about `1.5s` to `4.0s` and serialized before formal event | no `/ui_event` on tested local-only tab/drawer actions for read-only session | removed from critical local interaction path |
| Formal `/bus_event` | about `1.44s` | read-only permission gate returns `403` in `3ms`; queueing tests prove formal events no longer wait behind `/ui_event` | scheduling bottleneck removed; business-path latency depends on authorized operation |
| Bootstrap snapshot | about `199517B` / `540ms` in baseline trace | `157453B` / `264ms` | smaller and faster in this run |
| Visible app snapshot | not separately recorded | `182140B` / `323ms` | remaining cost when opening To Do Board |
| Outer document scroll | previously at risk after 100vh shell under auth header | no horizontal/vertical outer overflow on desktop, To Do, Gallery | fixed; Gallery scrolls internally |

## Notes

- Matrix password login intentionally grants only read capabilities. It is suitable for measuring read-only UI projection and local UI state responsiveness, but it cannot measure app-write Dialog creation or submit success.
- `新增任务` is currently a formal edit/write operation under ModelTable authorization, not a read-only local Dialog open. Under this account it correctly returns `permission_denied`.
- `ui-server-nodeport` showed repeated host-side `Connection reset by peer` after rollout while the Pod itself returned 200 internally. Recreating the NodePort service restored `http://127.0.0.1:30900/` on the next retry. This was recorded as a local deployment entrypoint issue, not UI page latency.
