---
title: "Iteration 0400-matrix-chat-ux-hardening Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-06-03
source: ai
iteration_id: 0400-matrix-chat-ux-hardening
id: 0400-matrix-chat-ux-hardening
phase: phase1
---

# Iteration 0400-matrix-chat-ux-hardening Resolution

## Status

Complete. Local deterministic checks, local deployment, real browser verification, browser cleanup verification, and sub-agent reviews passed. The follow-up corrects the `mbr` display from formal DM wording to real Matrix `People/1v1` wording because `drop` currently has empty `m.direct` account data, and fixes the `Rooms` tab value so it persists the accepted `rooms` filter.

## Planned Deliverables

- Matrix Chat 100% viewport fit and internal-only scrolling.
- Playwright/Chrome test session cleanup helper and usage record.
- Real Matrix room/channel refresh for `drop`, including the `mbr` DM-like room.
- People/Rooms tabs that filter by model-backed state and display the 1v1 peer (`mbr`) as the primary visible title without claiming formal Matrix DM when `m.direct` is empty.
- Text message, file message, invite/remove/leave flows implemented through UI model events and server-side host actions.
- Real browser verification evidence and sub-agent review records.

## Verification Log

- `node scripts/tests/test_0400_matrix_chat_room_projection_contract.mjs` -> `4 passed, 0 failed out of 4`
- `node scripts/tests/test_0399_matrix_chat_app_ux_contract.mjs` -> `7 passed, 0 failed out of 7`
- `node scripts/tests/test_0400_viewport_playwright_guard_contract.mjs` -> `5 passed, 0 failed out of 5`
- `bash scripts/ops/check_runtime_baseline.sh` -> `baseline ready`
- Real browser `http://127.0.0.1:30900/#/workspace`, fixed Playwright session `dy-0400`:
  - 1365x768 viewport had no outer document/body scroll.
  - Matrix Chat refreshed real `drop` joined rooms and showed the `mbr` DM-like room.
  - Text send produced Matrix event `$SPQXyn5F12HP2cHA4dJbOjw3TtgHVwnwixaYMkpQJo4`; `mbr` sync confirmed it.
  - File send produced Matrix event `$HM8SCAMMY2PutoiMQ22bftNBHGudOhmdv5ZNXxAnfks`; `mbr` sync confirmed `m.file` and `mxc://` URL.
  - Temporary room invite/remove/leave passed.
  - DM create/delete passed through visible `dm` selector and `Delete DM`.
  - Browser cleanup left no project Playwright session or managed browser process.
- Final deploy/browser recheck after the `renderer.js` parity fix:
  - Local `ui-server` image rebuilt and deployment rolled out.
  - Runtime baseline returned `baseline ready`.
  - 1365x768 viewport still had no outer document/body scroll.
  - Matrix Chat refreshed real rooms from `https://matrix.dongyudigital.com`.
  - Text send to `Dongyu Local Test` showed `0400 final browser text 1780044200` in the timeline.
  - File send showed `dy-0400-matrix-chat-final-file.txt` as a file card in the timeline.
  - Temporary room `0400 Final Member Ops 1780044500` passed invite/remove/leave and archived after leave.
- Follow-up `mbr` People/1v1 display/filter verification:
  - `node scripts/tests/test_0399_matrix_chat_app_ux_contract.mjs` -> `7 passed, 0 failed out of 7`
  - `node scripts/tests/test_0400_matrix_chat_room_projection_contract.mjs` -> `4 passed, 0 failed out of 4`
  - `node --check packages/ui-model-demo-server/server.mjs && node --check packages/ui-renderer/src/renderer.mjs && node --check packages/ui-renderer/src/renderer.js` -> PASS
  - `npm -C packages/ui-model-demo-frontend run build` -> PASS
  - `node scripts/tests/test_0400_viewport_playwright_guard_contract.mjs` -> `5 passed, 0 failed out of 5`
  - Real Matrix check showed `drop` joined rooms count = 11 and `m.direct = {}`.
  - Local deploy/browser recheck passed: `Rooms` became the selected tab and showed only room-group rows; `People` showed `mbr` with summary `1v1 room with mbr`, without claiming formal DM.
- Final sub-agent `codex-code-review`: approved with no findings and no verification gaps before the `mbr` DM follow-up.
- Follow-up sub-agent `codex-code-review` round 1: found CJS renderer parity drift and docs status drift; both were addressed.
- People/1v1 and Rooms follow-up sub-agent `codex-code-review`: approved with no findings and no verification gaps.

## Execution Strategy

- Use ModelTable-first implementation: Matrix Chat UI remains model-defined; renderer only gains generic display/action capability when needed.
- Keep Matrix API calls on the server/runtime side. Frontend components dispatch UI events only.
- Use deterministic mocked tests for contracts, then local stack + real browser for final Matrix verification.
- Treat Matrix API partial failures as room-level state, not whole-app failure.
- Use a fixed Playwright session helper with explicit cleanup; do not kill unrelated user Chrome processes.

## Step 1: Planning and Review

- Scope: Register 0400, freeze goals, define stage plan, run sub-agent review.
- Files: `docs/ITERATIONS.md`, `docs/iterations/0400-matrix-chat-ux-hardening/{plan.md,resolution.md,runlog.md}`.
- Verification: sub-agent `codex-code-review` returns no blocking findings for the plan.
- Acceptance: completion criteria cover viewport, browser cleanup, live Matrix rooms/messages/files/members, UX references, and per-stage review.
- Rollback: remove 0400 row and iteration directory if the plan is abandoned before implementation.

## Step 2: Viewport and Browser Lifecycle

- Scope: Make Matrix Chat and focused-app shell fit within the viewport at 100% zoom; add a safe Playwright cleanup/session helper.
- Files: `packages/worker-base/system-models/workspace_positive_models.json`, `packages/worker-base/system-models/desktop_catalog_ui.json`, `packages/ui-renderer/src/renderer.mjs`, `scripts/ops/*`, `scripts/tests/*`.
- Verification: deterministic contract test for sizing/helper; static process-cleanup guard check.
- Acceptance: model and renderer contracts make the app root shrinkable and internal-scroll only; cleanup helper leaves no project Playwright sessions/profiles and does not target normal Chrome.
- Rollback: revert sizing labels/helper/test files for this step.

## Step 3: Matrix Room Projection and History

- Scope: Enrich room refresh with members, DM detection, permission state, latest/history status, and room-level Matrix API error state.
- Files: `packages/ui-model-demo-server/server.mjs`, `packages/worker-base/system-models/workspace_positive_models.json`, `scripts/tests/*`.
- Verification: mocked Matrix API tests for successful rooms, `mbr` DM-like room, and partial member/history failures.
- Acceptance: Matrix Chat can show true `drop` joined rooms and identify the `mbr` DM-like room without crashing on partial Matrix server errors.
- Rollback: revert server enrichment and related model labels/tests.

## Step 4: Chat Actions and UI/UX

- Scope: Add model-defined controls for invite/remove/leave, DM add/delete semantics, settings/member dialogs, file preview/send, and standard chat layout refinements.
- Files: `packages/worker-base/system-models/workspace_positive_models.json`, `packages/ui-renderer/src/renderer.mjs`, `packages/ui-model-demo-server/server.mjs`, `scripts/tests/*`, docs/runlog.
- Verification: deterministic tests for UI event bindings and host actions; renderer tests for file card/composer/dialog state where available.
- Acceptance: main interface follows normal chat app structure; advanced/settings/member management is not flat on the main page; all actions dispatch through model-defined events.
- Rollback: revert Matrix Chat model/action additions from this step.

## Step 5: Live Local Verification

- Scope: Redeploy/restart local service and verify in a real browser with the remote Matrix server.
- Files: runlog and any fixes discovered by live testing.
- Verification: browser test covers 100% viewport measurement, room refresh, `mbr` DM visibility, text send, file send, temporary room invite/remove/leave, and cleanup checks.
- Acceptance: live browser results are recorded as PASS with event IDs or visible evidence; any safe cleanup room state is handled.
- Rollback: revert any last-minute fixes that fail deterministic or browser verification.

## Step 6: Final Review and Closeout

- Scope: Run relevant checks, final sub-agent review, and update resolution/runlog with evidence.
- Files: iteration docs plus changed implementation/test files.
- Verification: final sub-agent review returns no blocking findings; deterministic checks and browser tests pass.
- Acceptance: 0400 resolution contains enough evidence to judge completion without relying on user spot-checking.
- Rollback: keep branch unmerged and document blockers if final review cannot pass.

## Notes

- Remaining explicit limitation: real voice/video/screen-sharing media negotiation is still outside this iteration; the current Matrix Chat keeps those controls from masquerading as completed media capability.
- Generated at: 2026-05-29
