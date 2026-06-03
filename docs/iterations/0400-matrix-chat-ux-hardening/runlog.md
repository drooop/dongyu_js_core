---
title: "Iteration 0400-matrix-chat-ux-hardening Runlog"
doc_type: iteration-runlog
status: active
updated: 2026-06-03
source: ai
iteration_id: 0400-matrix-chat-ux-hardening
id: 0400-matrix-chat-ux-hardening
phase: phase3
---

# Iteration 0400-matrix-chat-ux-hardening Runlog

## 2026-05-29 Planning

- Created branch `dropx/dev_0400-matrix-chat-ux-hardening`.
- Cleaned stale Playwright-managed browser sessions before starting this iteration:
  - Result: `playwright list` reported no browsers.
  - Result: no `playwright_chromiumdev_profile` / Playwright CLI daemon process remained.
- Live Matrix evidence gathered through the existing check script:
  - Homeserver: `https://matrix.dongyudigital.com`
  - `drop`: `@drop:synapse.dongyudigital.com`
  - `mbr`: `@mbr:synapse.dongyudigital.com`
  - `drop` joined rooms: 7
  - `Dongyu Local Test` (`!OOuhOIkNosIGMCescc:synapse.dongyudigital.com`) contains `drop` and `mbr`
  - `drop -> mbr` message receive check: PASS
- Observed issue to handle in implementation:
  - Some older `Remote Matrix Check` rooms return server errors for member/history APIs. Matrix Chat must show per-room error state instead of failing the full room refresh.

## Review Records

- Plan review 1 by sub-agent: findings recorded and addressed.
  - Required fixes: complete `resolution.md` step plan, clarify status semantics, define browser cleanup boundary, fill environment.
- Plan review 2 by sub-agent: No findings.
- Step 2 review 1 by sub-agent: findings recorded and addressed.
  - Required fixes: replace global Playwright `close-all` cleanup with fixed-session cleanup; avoid tests that bless global cleanup; browser viewport measurement remains assigned to Step 5 live verification.
- Step 2 review 2 by sub-agent: one documentation-boundary finding addressed.
- Step 2 review 3 by sub-agent: No findings.
- Step 3 review 1 by sub-agent: finding recorded and addressed.
  - Required fix: add regression assertion that room refresh preserves existing local timeline entries and de-duplicates confirmed Matrix events by event id.
- Step 3 review 2 by sub-agent: No findings.
- Step 4 review by sub-agent: No findings.
- Created-room permission projection review by sub-agent: No findings.
- Pending invite cleanup review by sub-agent: No findings.
- Final review 1 by sub-agent: finding recorded and addressed.
  - Required fix: `renderer.js` CJS path also needed `AppWindow.contentOverflow`; deterministic tests now cover both `renderer.mjs` and `renderer.js`.
- Final review 2 by sub-agent: No findings; no verification gaps.
- DM `mbr` follow-up review 1 by sub-agent: findings recorded and addressed.
  - Required fixes: synchronize `ConversationList` filter/title behavior into `renderer.js`; make 0400 docs reflect the review state accurately.
- People/1v1 and Rooms display follow-up review by sub-agent: No findings.

## Environment

- Date: 2026-05-29
- Branch: `dropx/dev_0400-matrix-chat-ux-hardening`
- Runtime: local Orbstack/Kubernetes stack, `ui-server` rebuilt as `dy-ui-server:v1`

## Execution Records

### Step 1: Planning and Review

- Command: sub-agent `codex-code-review` over 0400 plan docs
- Key output: initial review found incomplete resolution step table, premature `In Progress` status, unclear Chrome cleanup boundary, and missing environment.
- Result: PASS after second review.
- Commit: pending

### Step 2: Viewport and Browser Lifecycle

- Command: `node scripts/tests/test_0400_viewport_playwright_guard_contract.mjs`
- Key output: `5 passed, 0 failed out of 5`
- Result: PASS
- Command: `bash -n scripts/ops/playwright_session_guard.sh`
- Key output: shell syntax check passed
- Result: PASS
- Command: `node scripts/tests/test_0399_matrix_chat_app_ux_contract.mjs`
- Key output: `7 passed, 0 failed out of 7`
- Result: PASS
- Command: `scripts/ops/playwright_session_guard.sh cleanup`
- Key output: `PASS: no project Playwright session or project Playwright-managed browser process remains for dy-0400`
- Result: PASS
- Commit:

### Step 3: Matrix Room Projection and History

- Command: `node scripts/tests/test_0400_matrix_chat_room_projection_contract.mjs`
- Key output: `2 passed, 0 failed out of 2`; includes timeline merge preservation/de-dup regression.
- Result: PASS
- Command: `node scripts/tests/test_0399_matrix_chat_app_ux_contract.mjs`
- Key output: `7 passed, 0 failed out of 7`
- Result: PASS
- Command: `node scripts/tests/test_0400_viewport_playwright_guard_contract.mjs`
- Key output: `5 passed, 0 failed out of 5`
- Result: PASS
- Commit:

### Step 4: Chat Actions and UI/UX

- Command: `node scripts/tests/test_0400_matrix_chat_room_projection_contract.mjs`
- Key output: `3 passed, 0 failed out of 3`; includes invite/remove/delete DM/leave action host calls and room-detail controls.
- Result: PASS
- Command: `node scripts/tests/test_0399_matrix_chat_app_ux_contract.mjs`
- Key output: `7 passed, 0 failed out of 7`
- Result: PASS
- Command: `node scripts/tests/test_0400_viewport_playwright_guard_contract.mjs`
- Key output: `5 passed, 0 failed out of 5`
- Result: PASS
- Commit:

### Step 5: Live Local Verification

- Command: `LOCAL_PERSISTED_ASSET_ROOT=/Users/drop/dongyu/volume/persist/assets bash scripts/ops/sync_local_persisted_assets.sh`
- Key output: persisted assets synced to `/Users/drop/dongyu/volume/persist/assets`
- Result: PASS
- Command: `docker build -t dy-ui-server:v1 -f k8s/Dockerfile.ui-server .`
- Key output: frontend build completed inside image; output chunk warning only
- Result: PASS
- Command: `kubectl -n dongyu rollout restart deployment/ui-server && kubectl -n dongyu rollout status deployment/ui-server --timeout=180s`
- Key output: `deployment "ui-server" successfully rolled out`
- Result: PASS
- Command: `bash scripts/ops/check_runtime_baseline.sh`
- Key output: `baseline ready`
- Result: PASS
- Browser: fixed session `dy-0400`, URL `http://127.0.0.1:30900/#/workspace`, viewport `1365x768`
- Browser viewport result:
  - `document.documentElement.scrollWidth=1365`
  - `document.documentElement.scrollHeight=768`
  - `document.body.scrollWidth=1365`
  - `document.body.scrollHeight=768`
  - `overflowX=hidden`
  - `overflowY=hidden`
  - Result: PASS
- Browser Matrix room refresh:
  - Matrix Chat refresh showed real `drop` joined rooms.
  - `Dongyu Local Test` was visible with `DM with mbr · 2 member(s) · invite=yes, remove=yes, leave=yes`.
  - Result: PASS
- Browser text send:
  - Sent `0400 Matrix Chat retest text 1780042300` to `Dongyu Local Test`.
  - UI event id: `$SPQXyn5F12HP2cHA4dJbOjw3TtgHVwnwixaYMkpQJo4`
  - `mbr` Matrix sync confirmed sender `@drop:synapse.dongyudigital.com`, `msgtype=m.text`, matching body.
  - Result: PASS
- Browser file send:
  - Uploaded `/tmp/dy-0400-matrix-chat-retest-file.txt`.
  - UI event id: `$HM8SCAMMY2PutoiMQ22bftNBHGudOhmdv5ZNXxAnfks`
  - UI media URI: `mxc://synapse.dongyudigital.com/KDJORwihgzZkcbYWeaiPzHFV`
  - `mbr` Matrix sync confirmed `msgtype=m.file`, matching body and `mxc://` URL.
  - Result: PASS
- Browser member management:
  - Created temporary room `0400 Matrix Chat Temp Room 1780042350`.
  - Invited `@mbr:synapse.dongyudigital.com` from room detail dialog.
  - `mbr` joined the room through Matrix API.
  - Removed `@mbr:synapse.dongyudigital.com` from UI; `pending_invites=[]`, members returned to `You`, status `online`.
  - Left the temporary room from UI; room archived and active room moved to a non-archived room.
  - Result: PASS
- Browser add/delete DM:
  - Discovered `Radio` labels were visible but input-only Playwright `check` still targeted the inner input; user-facing label click works.
  - Created a DM by clicking visible `dm`, filling `@mbr:synapse.dongyudigital.com`, and creating.
  - Active projection: `kind=dm`, summary `DM · 1 member(s) · invite=yes, remove=yes, leave=yes`.
  - `Delete DM` left and archived the DM: status `Deleted DM by leaving @mbr:synapse.dongyudigital.com`.
  - Result: PASS
- Cleanup:
  - Accidental test rooms named `@mbr:synapse.dongyudigital.com` were left through Matrix API.
  - Command: `scripts/ops/playwright_session_guard.sh cleanup && scripts/ops/playwright_session_guard.sh check-clean`
  - Key output: no project Playwright session or project Playwright-managed browser process remains for `dy-0400`
  - Result: PASS

### Step 6: Final Deterministic Verification

- Final review fix:
  - `packages/ui-renderer/src/renderer.js` now mirrors `renderer.mjs` for `AppWindow.contentOverflow`.
  - `scripts/tests/test_0400_viewport_playwright_guard_contract.mjs` asserts both renderer builds.
- Command: `node scripts/tests/test_0400_matrix_chat_room_projection_contract.mjs`
- Key output: `4 passed, 0 failed out of 4`
- Result: PASS
- Command: `node scripts/tests/test_0399_matrix_chat_app_ux_contract.mjs`
- Key output: `7 passed, 0 failed out of 7`
- Result: PASS
- Command: `node scripts/tests/test_0400_viewport_playwright_guard_contract.mjs`
- Key output: `5 passed, 0 failed out of 5`
- Result: PASS
- Command: `bash scripts/ops/check_runtime_baseline.sh`
- Key output: `baseline ready`
- Result: PASS
- Command: `scripts/ops/playwright_session_guard.sh cleanup && scripts/ops/playwright_session_guard.sh check-clean`
- Key output: no project Playwright session or project Playwright-managed browser process remains for `dy-0400`
- Result: PASS

### Step 7: Final Local Deploy and Browser Recheck

- Command: `LOCAL_PERSISTED_ASSET_ROOT=/Users/drop/dongyu/volume/persist/assets bash scripts/ops/sync_local_persisted_assets.sh`
- Result: PASS
- Command: `docker build -t dy-ui-server:v1 -f k8s/Dockerfile.ui-server .`
- Result: PASS
- Command: `kubectl -n dongyu rollout restart deployment/ui-server && kubectl -n dongyu rollout status deployment/ui-server --timeout=180s`
- Key output: `deployment "ui-server" successfully rolled out`
- Result: PASS
- Command: `bash scripts/ops/check_runtime_baseline.sh`
- Key output: `baseline ready`
- Result: PASS
- Browser: fixed session `dy-0400`, URL `http://127.0.0.1:30900/#/workspace`, viewport `1365x768`
- Browser viewport result:
  - `document.documentElement.scrollWidth=1365`
  - `document.documentElement.scrollHeight=768`
  - `document.body.scrollWidth=1365`
  - `document.body.scrollHeight=768`
  - `html/body overflow=hidden`
  - Result: PASS
- Browser Matrix room refresh:
  - Refresh showed real `drop` joined rooms from `https://matrix.dongyudigital.com`.
  - `Dongyu Local Test` was visible with `DM with mbr · 2 member(s) · invite=yes, remove=yes, leave=yes`.
  - Result: PASS
- Browser text send:
  - Sent `0400 final browser text 1780044200` to `Dongyu Local Test`.
  - Message appeared in Matrix Chat timeline as `You · 08:43`.
  - Result: PASS
- Browser file send:
  - Uploaded `/tmp/dy-0400-matrix-chat-final-file.txt`.
  - File appeared in Matrix Chat timeline as a file card named `dy-0400-matrix-chat-final-file.txt`.
  - Result: PASS
- Browser member management:
  - Created temporary room `0400 Final Member Ops 1780044500`.
  - Room id: `!fmadgEwswWgKgLrpPb:synapse.dongyudigital.com`.
  - Invited `@mbr:synapse.dongyudigital.com`; root status became `Invited @mbr:synapse.dongyudigital.com via Matrix`, `connection_status=online`, and `pending_invites` contained `@mbr:synapse.dongyudigital.com`.
  - Removed `@mbr:synapse.dongyudigital.com`; root status became `Removed @mbr:synapse.dongyudigital.com via Matrix`, `connection_status=online`, and `pending_invites=[]`.
  - Left the temporary room; root status became `Left 0400 Final Member Ops 1780044500`, the room was archived, and active room moved to `Remote Matrix Check`.
  - Result: PASS
- Cleanup:
  - Command: `scripts/ops/playwright_session_guard.sh cleanup`
  - Command: `scripts/ops/playwright_session_guard.sh check-clean`
  - Key output: no project Playwright session or project Playwright-managed browser process remains for `dy-0400`
  - Result: PASS

### Step 8: Real Matrix Display Follow-up

- Root cause found during real browser verification:
  - `People` switched correctly, but `Rooms` only received focus and did not persist selection.
  - The `Rooms` tab label was correct, but its model-backed tab `name` was still the old `room` value.
  - The Matrix Chat program model only accepts `all`, `people`, or `rooms`, so `room` fell back to `all`.
- Fix:
  - Changed the `Rooms` tab model value to `rooms`.
  - Added a deterministic assertion that the `Rooms` tab sends the accepted `rooms` filter value.
  - Updated the renderer parity test to use `conversation_group=people` instead of old DM filtering language.
- Command: `node scripts/tests/test_0399_matrix_chat_app_ux_contract.mjs`
  - Key output: `7 passed, 0 failed out of 7`
  - Result: PASS
- Command: `node scripts/tests/test_0400_viewport_playwright_guard_contract.mjs`
  - Key output: `5 passed, 0 failed out of 5`
  - Result: PASS
- Command: `node scripts/tests/test_0400_matrix_chat_room_projection_contract.mjs`
  - Key output: `4 passed, 0 failed out of 4`
  - Result: PASS
- Local deployment:
  - Synced persisted assets to `/Users/drop/dongyu/volume/persist/assets`.
  - Rebuilt `dy-ui-server:v1`.
  - Restarted `ui-server` and waited for rollout.
  - `bash scripts/ops/check_runtime_baseline.sh` returned `baseline ready` after the old pod finished terminating.
- Browser: fixed session `dy-0400`, URL `http://127.0.0.1:30900/#/`, viewport `1365x768`
  - Opened `Matrix Chat`.
  - Clicked `Refresh`, showing real `drop` joined rooms from the remote Matrix server.
  - Clicked `Rooms`; tab became selected and the list showed only `conversation_group=rooms` entries.
  - Clicked `People`; tab became selected and the list showed `mbr` one-to-one rooms without temp room rows.
  - Selected `Dongyu Local Test`; header showed `mbr` and `1v1 room with mbr · 2 member(s) · invite=yes, remove=yes, leave=yes`.
  - Result: PASS

### Step 9: People `mbr` Display Follow-up

- Issue: real Matrix refresh had `drop + mbr` two-person rooms, but the UI called them `DMs` even though the real Matrix `m.direct` account data for `drop` was empty.
- Root cause:
  - Matrix Chat filter tabs did not write a model-backed `conversation_filter`.
  - `ConversationList` had no generic model-backed filtering support.
  - Two-person room rows used room `name` as the primary field, so peer identity was hidden behind names such as `Remote Matrix Check`.
  - The UI conflated formal Matrix direct rooms with ordinary two-person rooms.
- Fix:
  - Added model-backed `conversation_filter` and tab `ui_bind_json` events for `All` / `People` / `Rooms`.
  - Added generic `ConversationList` filtering support in the renderer.
  - Fetched Matrix `m.direct` account data; when it is empty, `drop + mbr` two-person rooms are classified as `kind=person`, `conversation_group=people`, not formal DM.
  - Projected People rooms with `list_title=mbr` and room/message context in `list_subtitle`.
  - Added `docs/user-guide/matrix_chat_feature_matrix.md` as the current feature/interaction/regression checklist.
- Command: `node scripts/tests/test_0399_matrix_chat_app_ux_contract.mjs`
- Key output: `7 passed, 0 failed out of 7`
- Result: PASS
- Command: `node scripts/tests/test_0400_matrix_chat_room_projection_contract.mjs`
- Key output: `4 passed, 0 failed out of 4`
- Result: PASS
- Command: `node --check packages/ui-model-demo-server/server.mjs && node --check packages/ui-renderer/src/renderer.mjs && node --check packages/ui-renderer/src/renderer.js`
- Result: PASS
- Command: `npm -C packages/ui-model-demo-frontend run build`
- Result: PASS
- Command: `node scripts/tests/test_0400_viewport_playwright_guard_contract.mjs`
- Key output: `5 passed, 0 failed out of 5`
- Result: PASS
- Command: `LOCAL_PERSISTED_ASSET_ROOT=/Users/drop/dongyu/volume/persist/assets bash scripts/ops/sync_local_persisted_assets.sh`
- Result: PASS
- Command: `docker build -t dy-ui-server:v1 -f k8s/Dockerfile.ui-server .`
- Result: PASS
- Command: `kubectl -n dongyu rollout restart deployment/ui-server && kubectl -n dongyu rollout status deployment/ui-server --timeout=180s`
- Key output: `deployment "ui-server" successfully rolled out`
- Result: PASS
- Command: `bash scripts/ops/check_runtime_baseline.sh`
- Key output: `baseline ready`
- Result: PASS
- Browser: fixed session `dy-0400`, URL `http://127.0.0.1:30900/#/workspace`, viewport `1365x768`
- Browser Matrix People filter result:
  - Opened Matrix Chat.
  - Clicked `Refresh`; real `drop` joined rooms were loaded from `https://matrix.dongyudigital.com`.
  - `drop` Matrix `m.direct` account data was `{}`, so `mbr` rooms are 1v1 People rooms, not formal DM.
  - Clicked `People`; `mbr` rows were shown as People/1v1 rows.
  - Selected `Dongyu Local Test`; header showed `mbr` and `1v1 room with mbr · 2 member(s) · invite=yes, remove=yes, leave=yes`.
  - Result: PASS

## Docs Updated

- [x] Iteration runlog updated with deterministic and browser verification evidence
