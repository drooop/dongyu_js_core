---
title: "Iteration 0401-matrix-chat-real-media-membership Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-06-03
source: ai
iteration_id: 0401-matrix-chat-real-media-membership
id: 0401-matrix-chat-real-media-membership
phase: phase1
---

# Iteration 0401-matrix-chat-real-media-membership Resolution

## Execution Strategy

Use TDD for each behavior gap. First add or extend deterministic contracts, then implement the smallest ModelTable / renderer / host-action changes, then deploy locally and verify with a real browser against the remote Matrix server.

Each implementation stage ends with sub-agent `codex-code-review`. Change Requested findings are fixed before the next stage.

## Final Status

Completed on 2026-06-01.

- Matrix Chat now renders text, file, image, and audio cards with media actions.
- `Voice` records in the browser, uploads media, and sends a real Matrix `m.audio` message.
- Leave/delete removes rooms from the active list after Matrix success instead of keeping stale disabled rows.
- Invite, accept invite, remove member, leave room, and leave 1v1 paths are covered by deterministic tests, real Matrix API checks, and real browser walkthroughs.
- Final sub-agent review approved with no findings.

## Step 1 — Planning And Review Gate

- Scope: register 0401, freeze this plan and execution strategy, and get sub-agent review approval.
- Files:
  - `docs/ITERATIONS.md`
  - `docs/iterations/0401-matrix-chat-real-media-membership/plan.md`
  - `docs/iterations/0401-matrix-chat-real-media-membership/resolution.md`
  - `docs/iterations/0401-matrix-chat-real-media-membership/runlog.md`
- Verification:
  - sub-agent `codex-code-review` over plan/resolution/runlog.
- Acceptance:
  - review returns `APPROVED` with no blocking findings.
- Rollback:
  - remove 0401 row and iteration directory if the plan is abandoned before implementation.

## Step 2 — Message Card Contracts

- Scope: define expected render and data contracts for text, file, image, and audio timeline events.
- Files:
  - `scripts/tests/test_0401_matrix_chat_media_cards_contract.mjs`
  - `packages/ui-renderer/src/renderer.mjs`
  - `packages/ui-renderer/src/renderer.js`
  - `packages/ui-model-demo-server/server.mjs`
- Verification:
  - First run the new test and verify it fails on missing download/open/image/audio details.
  - After implementation, run the new test plus 0399/0400 Matrix Chat tests.
- Acceptance:
  - renderer tree and vnode paths classify `m.text`, `m.file`, `m.image`, and `m.audio`.
  - file/image/audio cards expose `download_url` or equivalent safe media URL derived by the server.
  - CJS and ESM renderer behavior stays aligned.
- Rollback:
  - revert the new test and message card changes.

## Step 3 — Voice Message Send

- Scope: add one-shot voice recording flow: record in browser, upload media, send `m.audio`, then render as an audio card.
- Files:
  - `packages/ui-renderer/src/renderer.mjs`
  - `packages/ui-renderer/src/renderer.js`
  - `packages/worker-base/system-models/workspace_positive_models.json`
  - `packages/ui-model-demo-server/server.mjs`
  - `scripts/tests/test_0401_matrix_chat_voice_contract.mjs`
- Verification:
  - deterministic test fails first for missing real voice event path.
  - after implementation, browser test records a short clip and confirms a Matrix `m.audio` event appears.
- Acceptance:
  - `Voice` no longer reports fake success.
  - unsupported browser/media permission failures are explicit.
  - successful voice send clears pending voice state and appends an audio card.
- Rollback:
  - disable voice recording UI and revert to explicit not-connected status.

## Step 4 — Leave/Delete Projection Correctness

- Scope: fix room and People/1v1 list projection after `leave_room` and `delete_friend`.
- Files:
  - `packages/ui-model-demo-server/server.mjs`
  - `packages/worker-base/system-models/workspace_positive_models.json`
  - `scripts/tests/test_0401_matrix_chat_membership_contract.mjs`
- Verification:
  - deterministic tests prove left rooms are not selectable after host success and do not reappear unless Matrix refresh still reports joined membership.
  - real browser test leaves a temporary room and confirms it disappears from active list after refresh.
- Acceptance:
  - user can distinguish Matrix leave failure, local projection pending, and successful leave.
  - successful leave/delete moves active selection to a valid room only.
- Rollback:
  - revert membership projection changes.

## Step 5 — Membership Workflow E2E

- Scope: test and repair invite, accept/join, remove/kick, leave, and People/1v1 delete/leave for both 1v1 and multi-member rooms.
- Files:
  - `packages/ui-model-demo-server/server.mjs`
  - `packages/worker-base/system-models/workspace_positive_models.json`
  - `scripts/tests/test_0401_matrix_chat_membership_contract.mjs`
  - optional helper under `scripts/ops/` if real Matrix cleanup needs repeatable automation.
- Verification:
  - deterministic tests cover host adapter calls and projection updates.
  - real Matrix script verifies room membership from both `drop` and `mbr` perspectives.
  - real browser test executes the visible UI flow.
- Acceptance:
  - usable `drop` and `mbr` Matrix identities are available; otherwise this step is blocked.
  - invite/join/remove/leave/delete paths produce unambiguous visible status and correct room list.
  - failed permission or API responses are shown as errors, not silent stale UI.
- Rollback:
  - revert helper/tests and membership UI model changes.

## Step 6 — Docs, Deploy, Browser Matrix

- Scope: update user-facing feature checklist, deploy locally, run browser verification, and archive evidence.
- Files:
  - `docs/user-guide/matrix_chat_feature_matrix.md`
  - `docs/iterations/0401-matrix-chat-real-media-membership/runlog.md`
  - `docs/iterations/0401-matrix-chat-real-media-membership/resolution.md`
- Verification:
  - `node scripts/tests/test_0399_matrix_chat_app_ux_contract.mjs`
  - `node scripts/tests/test_0400_matrix_chat_room_projection_contract.mjs`
  - all `test_0401_*` scripts
  - `node --check` on touched JS/MJS files
  - local deploy and `bash scripts/ops/check_runtime_baseline.sh`
  - real browser walkthrough with fixed session cleanup
  - final sub-agent `codex-code-review`
- Acceptance:
  - docs match actual implemented behavior.
  - no Playwright-managed project browser process remains.
  - final review approves with no findings.
- Rollback:
  - keep branch unmerged, restore 0401 status to `Change Requested`, and document blockers in runlog.

## Notes

- Generated at: 2026-06-01
- This iteration intentionally keeps video conferencing and screen sharing out of scope. They require a separate media/session design.
