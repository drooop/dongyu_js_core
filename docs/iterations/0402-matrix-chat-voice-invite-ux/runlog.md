---
title: "Iteration 0402-matrix-chat-voice-invite-ux Runlog"
doc_type: iteration-runlog
status: active
updated: 2026-06-03
source: ai
iteration_id: 0402-matrix-chat-voice-invite-ux
id: 0402-matrix-chat-voice-invite-ux
phase: phase3
---

# Iteration 0402-matrix-chat-voice-invite-ux Runlog

## Environment

- Date: 2026-06-02
- Branch: `dropx/dev_0402-matrix-chat-voice-invite-ux`
- Runtime: local Orbstack/Kubernetes stack; Matrix tests use remote homeserver `https://matrix.dongyudigital.com`
- Pre-existing worktree note: 0400/0401 Matrix Chat changes are still uncommitted; 0402 continues on top of that active worktree to avoid losing current Matrix Chat context.

## Review Records

- Planning review 1, voice path: Change Requested.
  - Required fixes: explicitly route voice Finish / Enter / max-duration completion through UI model `bus_event_v2`, worker root Model 0, and Matrix Chat host action; tests must prove complete ModelTable-like PRCKTV payload and no frontend direct Matrix send.
- Planning review 1, room action visibility: Approved.
- Planning review 1, invitation UX: Change Requested.
  - Required fixes: real browser acceptance must include both accept invitation and decline invitation with list refresh verification.
- Planning review 2, voice path: Approved.
- Planning review 2, invitation UX: Approved.
- Planning gate result: Approved.

## Execution Records

### Step 1 — Planning And Review Gate

- Command: `python3 /Users/drop/.codex/skills/it/scripts/init_iteration_scaffold.py 0402-matrix-chat-voice-invite-ux --repo-root /Users/drop/codebase/cowork/dongyuapp_elysia_based`
- Key output: generated `plan.md`, `resolution.md`, `runlog.md`
- Result: PASS
- Command: `git switch -c dropx/dev_0402-matrix-chat-voice-invite-ux`
- Key output: switched to new branch
- Result: PASS
- Command: `git diff --check`
- Key output: no whitespace errors
- Result: PASS

### Step 2 — Voice Recording Mode

- Status: started.
- RED command: `node scripts/tests/test_0402_matrix_chat_voice_ux_contract.mjs`
- RED key output: `Voice must use a manual AudioRecorder UI component`, actual `Button`
- RED result: PASS, failure exposed the old one-click fixed-duration voice behavior.
- GREEN command: `node scripts/tests/test_0402_matrix_chat_voice_ux_contract.mjs`
- GREEN key output: `matrix_chat_voice_uses_manual_recorder_component: PASS`; `renderer_manual_recorder_contract: PASS`
- GREEN result: PASS
- Regression command: `node scripts/tests/test_0401_matrix_chat_voice_contract.mjs`
- Key output: `matrix_chat_voice_button_is_model_driven_recorder: PASS`; `matrix_chat_start_voice_reaches_share_file_host_action: PASS`
- Result: PASS
- Regression command: `node scripts/tests/test_0401_matrix_chat_media_cards_contract.mjs`
- Key output: 4 media card checks PASS
- Result: PASS
- Syntax/JSON commands:
  - `node --check packages/ui-renderer/src/renderer.mjs`
  - `node --check packages/ui-renderer/src/renderer.js`
  - `node --check packages/ui-model-demo-frontend/src/ui_cellwise_projection.js`
  - `node --check scripts/tests/test_0402_matrix_chat_voice_ux_contract.mjs`
  - `node -e "JSON.parse(require('node:fs').readFileSync('packages/worker-base/system-models/workspace_positive_models.json','utf8')); JSON.parse(require('node:fs').readFileSync('packages/ui-renderer/src/component_registry_v1.json','utf8'));"`
- Result: PASS
- Command: `git diff --check`
- Result: PASS
- Sub-agent Step 2 review 1: Change Requested.
  - Required fix: prevent fast repeated `Voice` clicks while `getUserMedia()` is still pending; previous implementation could open multiple microphone streams and lose cleanup ownership for one stream.
- Reentry RED command: `node scripts/tests/test_0402_matrix_chat_voice_ux_contract.mjs`
- Reentry RED key output: `ESM must issue only one getUserMedia request while startup is pending`, actual `2`
- Reentry RED result: PASS, failure reproduced the startup reentry leak risk.
- Reentry fix: `AudioRecorder` now reserves a `pending_start` session before `getUserMedia()`, returns the same startup promise for repeated clicks, and displays a starting state while waiting for microphone permission.
- Reentry GREEN command: `node scripts/tests/test_0402_matrix_chat_voice_ux_contract.mjs`
- Reentry GREEN key output: `renderer_manual_recorder_contract: PASS`
- Reentry GREEN result: PASS
- Regression command after reentry fix: `node scripts/tests/test_0401_matrix_chat_voice_contract.mjs`
- Key output: `matrix_chat_start_voice_reaches_share_file_host_action: PASS`
- Result: PASS
- Syntax/hygiene after reentry fix: `node --check packages/ui-renderer/src/renderer.mjs && node --check packages/ui-renderer/src/renderer.js && git diff --check`
- Result: PASS
- Sub-agent Step 2 review 2: Change Requested.
  - Required fix: canceling while microphone permission is still pending must not let the pending `getUserMedia()` result create a recorder later; the returned stream must be closed and no voice dispatch/upload may happen.
- Startup cancel RED command: `node scripts/tests/test_0402_matrix_chat_voice_ux_contract.mjs`
- Startup cancel RED key output: `ESM must show startup state while microphone permission is pending`, actual `Voice`
- Startup cancel RED result: PASS, failure exposed that `pending_start` was still rendered as idle and could not be safely canceled.
- Startup cancel fix: `AudioRecorder` now renders `pending_start` as the startup panel, ignores Enter while startup is pending, marks pending sessions as canceled on Cancel, and closes late-arriving microphone streams without creating a recorder.
- Startup cancel GREEN command: `node scripts/tests/test_0402_matrix_chat_voice_ux_contract.mjs`
- Startup cancel GREEN key output: `matrix_chat_voice_uses_manual_recorder_component: PASS`; `renderer_manual_recorder_contract: PASS`
- Startup cancel GREEN result: PASS
- Regression commands after startup cancel fix:
  - `node scripts/tests/test_0401_matrix_chat_voice_contract.mjs`
  - `node scripts/tests/test_0401_matrix_chat_media_cards_contract.mjs`
  - `node --check packages/ui-renderer/src/renderer.mjs`
  - `node --check packages/ui-renderer/src/renderer.js`
  - `git diff --check`
- Result: PASS
- Sub-agent Step 2 review 3: Approved.
  - Findings: none.
  - Verification gaps: none.

### Step 3 — Room Action Visibility

- Status: started.
- RED command: `node scripts/tests/test_0402_matrix_chat_action_visibility_contract.mjs`
- RED key output: `matrix_chat_invite_user_input must use a model-driven visibleRef`
- RED result: PASS, failure exposed that Matrix Chat detail actions were still always rendered.
- Test-path correction: projection checks now select rooms through real Model 0 `bus_event_v2` instead of calling internal helpers directly.
- GREEN command: `node scripts/tests/test_0402_matrix_chat_action_visibility_contract.mjs`
- GREEN key output: `matrix_chat_action_controls_declare_visibility_refs: PASS`; `matrix_chat_projection_writes_action_visibility_state: PASS`; `renderer_supports_model_driven_visibility_refs: PASS`
- GREEN result: PASS
- Implementation evidence:
  - Renderer supports model-driven `visibleRef` / `hiddenRef` and strips those internal props before component/DOM rendering.
  - Matrix Chat projection writes `active_can_invite_members`, `active_can_remove_members`, `active_can_leave_room`, `active_can_leave_people`, and `active_can_accept_invite`.
  - Detail actions read those labels through UI model `ui_props_json.visibleRef`.
- Regression commands:
  - `node scripts/tests/test_0401_matrix_chat_membership_contract.mjs`
  - `node scripts/tests/test_0399_matrix_chat_app_ux_contract.mjs`
  - `node --check packages/ui-renderer/src/renderer.mjs`
  - `node --check packages/ui-renderer/src/renderer.js`
  - `node --check packages/ui-model-demo-server/server.mjs`
  - `node --check scripts/tests/test_0402_matrix_chat_action_visibility_contract.mjs`
  - `node -e "JSON.parse(require('node:fs').readFileSync('packages/worker-base/system-models/workspace_positive_models.json','utf8'));"`
- `git diff --check`
- Result: PASS
- Sub-agent Step 3 review 1: Approved.
  - Findings: none.
  - Verification gaps: none.

### Step 4 — Invitation UX And Decline Path

- Status: started.
- RED command: `node scripts/tests/test_0402_matrix_chat_action_visibility_contract.mjs`
- RED key output: `Matrix Chat must render invite handling in a dedicated panel`, actual `undefined`
- RED result: PASS, failure exposed that invitation accept/reject did not have a dedicated UI surface and no decline path existed.
- GREEN command: `node scripts/tests/test_0402_matrix_chat_action_visibility_contract.mjs`
- GREEN key output: `matrix_chat_declares_dedicated_invite_panel: PASS`; `decline_invite_rejects_matrix_invite_and_refreshes_projection: PASS`
- GREEN result: PASS
- Implementation evidence:
  - Added dedicated `matrix_chat_invite_panel` visible only for active invite rows.
  - Added `matrix_chat_decline_invite_button` and moved `matrix_chat_accept_invite_button` into the invite panel action group.
  - Composer now reads `active_can_send_messages` and hides for invite rows.
  - `decline_invite` enters through Matrix Chat Model 0 bus event, triggers Matrix leave/reject, refreshes rooms, and removes the invite row from projection.
  - `docs/user-guide/matrix_chat_feature_matrix.md` now records manual voice UX, dynamic action visibility, dedicated invite panel, and decline invite.
- Regression commands:
  - `node scripts/tests/test_0401_matrix_chat_membership_contract.mjs`
  - `node scripts/tests/test_0399_matrix_chat_app_ux_contract.mjs`
  - `node scripts/tests/test_0401_matrix_chat_voice_contract.mjs`
  - `node scripts/tests/test_0401_matrix_chat_media_cards_contract.mjs`
  - `node scripts/tests/test_0400_matrix_chat_room_projection_contract.mjs`
  - `node scripts/tests/test_0400_viewport_playwright_guard_contract.mjs`
  - `python3 -m py_compile scripts/matrix_chat_real_flow_check.py`
  - `node --check packages/ui-renderer/src/renderer.mjs`
  - `node --check packages/ui-renderer/src/renderer.js`
  - `node --check packages/ui-model-demo-server/server.mjs`
  - `npm -C packages/ui-model-demo-frontend run build`
  - `node -e "JSON.parse(require('node:fs').readFileSync('packages/worker-base/system-models/workspace_positive_models.json','utf8')); JSON.parse(require('node:fs').readFileSync('packages/ui-renderer/src/component_registry_v1.json','utf8'));"`
  - `git diff --check`
- Result: PASS
- Sub-agent Step 4 review 1: Change Requested.
  - Required fix: after successful Matrix leave/reject, `decline_invite` must not allow a stale `/sync` refresh response to reinsert the declined invite row.
- Stale refresh RED command: `node scripts/tests/test_0402_matrix_chat_action_visibility_contract.mjs`
- Stale refresh RED key output: `declined invite must not reappear even if refresh still returns it`, actual `true`
- Stale refresh RED result: PASS, failure reproduced Matrix invite projection delay risk.
- Stale refresh fix: `decline_invite` now filters the declined room id from successful refresh projections before writing `rooms_json`.
- Stale refresh GREEN commands:
  - `node scripts/tests/test_0402_matrix_chat_action_visibility_contract.mjs`
  - `node scripts/tests/test_0401_matrix_chat_membership_contract.mjs`
  - `node --check packages/ui-model-demo-server/server.mjs`
  - `git diff --check`
- Result: PASS
- Sub-agent Step 4 review 2: Approved.
  - Findings: none.
  - Verification gaps: none.

### Step 5 — Local Deploy And Real Browser Verification

- Status: completed.
- Local deploy command: `bash scripts/ops/deploy_local.sh`
- Key output:
  - `deployment "ui-server" successfully rolled out`
  - `deployment "mbr-worker" successfully rolled out`
  - `deployment "remote-worker" successfully rolled out`
  - `deployment "workspace-manager" successfully rolled out`
  - `UI Server: http://localhost:30900`
- Result: PASS
- Baseline command: `bash scripts/ops/check_runtime_baseline.sh`
- Key output: all dongyu deployments ready; no terminating app pods; ui-server/mbr-worker secrets ready.
- Result: PASS
- Browser setup command: `bash scripts/ops/playwright_session_guard.sh session open 'http://127.0.0.1:30900/#/workspace'`
- Result: PASS after retrying one transient post-rollout `ERR_CONNECTION_RESET`; `/snapshot` and ui-server logs confirmed the service was ready before continuing.
- Real Matrix refresh evidence:
  - Opened `Matrix Chat`.
  - Clicked `Refresh`.
  - Confirmed `drop` rooms were loaded from remote homeserver `https://matrix.dongyudigital.com`.
- Real browser action-visibility evidence:
  - People/1v1 `mbr` details dialog showed only `Leave 1v1` for destructive membership action.
  - Normal room details dialog showed `Invite`, `Remove`, and `Leave room`, without `Leave 1v1` or invitation actions.
- Real browser invite evidence:
  - `Invites` tab showed real pending Matrix invites.
  - Selecting an invite showed the dedicated `Invitation pending` panel with `Accept` / `Decline`; normal message composer was hidden.
  - Clicking `Accept` joined the room, removed the invite row, restored the normal composer, and made voice/message send controls visible.
  - Clicking `Decline` on a separate invite removed that invite row and did not reinsert it after refresh.
- Browser-discovered issue:
  - Remote Matrix `/sync` can temporarily return the same room in both joined and invite sets after accept.
  - Fix: Matrix room projection now deduplicates by treating joined rooms as authoritative over stale invite shadow rows; `decline_invite` continues to filter the declined room id from refresh projections.
- Deduplication regression command: `node scripts/tests/test_0402_matrix_chat_action_visibility_contract.mjs`
- Key output: `accept_invite_prefers_joined_room_over_stale_invite_projection: PASS`
- Result: PASS
- Real browser voice evidence:
  - Injected a browser-level fake microphone/MediaRecorder for deterministic verification.
  - Clicking `Voice` showed `Recording voice message`, `Finish`, `Cancel`, and `1s / 60s max`; after waiting, it was still recording and had not sent automatically.
  - Clicking `Finish` uploaded and sent a Matrix `m.audio` message rendered as an audio card with `Download audio`.
  - Starting a second recording and pressing Enter uploaded and sent a second Matrix `m.audio` message.
- Browser cleanup command: `bash scripts/ops/playwright_session_guard.sh cleanup && bash scripts/ops/playwright_session_guard.sh check-clean`
- Key output: `PASS: no project Playwright session or project Playwright-managed browser process remains for dy-0400`
- Result: PASS
- Final deterministic verification commands:
  - `node scripts/tests/test_0402_matrix_chat_action_visibility_contract.mjs`
  - `node scripts/tests/test_0402_matrix_chat_voice_ux_contract.mjs`
  - `node scripts/tests/test_0401_matrix_chat_voice_contract.mjs`
  - `node scripts/tests/test_0401_matrix_chat_media_cards_contract.mjs`
  - `node scripts/tests/test_0401_matrix_chat_membership_contract.mjs`
  - `node scripts/tests/test_0399_matrix_chat_app_ux_contract.mjs`
  - `node scripts/tests/test_0400_matrix_chat_room_projection_contract.mjs`
  - `node scripts/tests/test_0400_viewport_playwright_guard_contract.mjs`
  - `python3 -m py_compile scripts/matrix_chat_real_flow_check.py`
  - `node --check packages/ui-model-demo-server/server.mjs`
  - `node --check packages/ui-renderer/src/renderer.mjs`
  - `node --check packages/ui-renderer/src/renderer.js`
  - `npm -C packages/ui-model-demo-frontend run build`
  - `git diff --check`
- Result: PASS
- Final sub-agent review: Approved.
  - Findings: none.
  - Open questions: none.
  - Verification gaps: none.

## Docs Updated

- [x] `docs/ITERATIONS.md` registered 0402
- [x] `docs/iterations/0402-matrix-chat-voice-invite-ux/plan.md` created
- [x] `docs/iterations/0402-matrix-chat-voice-invite-ux/resolution.md` created
- [x] `docs/iterations/0402-matrix-chat-voice-invite-ux/runlog.md` created
- [x] `docs/user-guide/matrix_chat_feature_matrix.md` updated after implementation evidence
- [ ] `docs/ssot/runtime_semantics_modeltable_driven.md` reviewed
- [ ] `docs/user-guide/modeltable_user_guide.md` reviewed
- [ ] `docs/ssot/execution_governance_ultrawork_doit.md` reviewed
