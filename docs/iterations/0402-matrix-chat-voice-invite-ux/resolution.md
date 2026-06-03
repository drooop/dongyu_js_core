---
title: "Iteration 0402-matrix-chat-voice-invite-ux Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-06-03
source: ai
iteration_id: 0402-matrix-chat-voice-invite-ux
id: 0402-matrix-chat-voice-invite-ux
phase: phase1
---

# Iteration 0402-matrix-chat-voice-invite-ux Resolution

## Execution Strategy

Use TDD in three implementation stages: voice recording mode, context-aware room actions, and invitation UX. Each stage gets a failing deterministic test first, minimal implementation second, verification third, and sub-agent `codex-code-review` before the next stage.

## Step 1 — Planning And Review Gate

- Scope: freeze the 0402 plan/resolution/runlog and obtain review approval before implementation.
- Files:
  - `docs/ITERATIONS.md`
  - `docs/iterations/0402-matrix-chat-voice-invite-ux/plan.md`
  - `docs/iterations/0402-matrix-chat-voice-invite-ux/resolution.md`
  - `docs/iterations/0402-matrix-chat-voice-invite-ux/runlog.md`
- Verification:
  - `git diff --check`
  - sub-agent `codex-code-review` over plan/resolution/runlog.
- Acceptance:
  - Review returns Approved with no blocking findings.
- Rollback:
  - Remove the 0402 row and iteration directory before any implementation starts.

## Step 2 — Voice Recording Mode

- Scope: replace immediate fixed-duration voice sending with a visible recording mode.
- Files:
  - `packages/ui-renderer/src/renderer.mjs`
  - `packages/ui-renderer/src/renderer.js`
  - `packages/worker-base/system-models/workspace_positive_models.json`
  - `scripts/tests/test_0402_matrix_chat_voice_ux_contract.mjs`
- Verification:
  - First run the new voice UX test and confirm it fails because no persistent recording mode exists.
  - After implementation, run the new test, 0401 voice/media tests, and renderer syntax checks.
- Acceptance:
  - `Voice` starts recording and shows an active recording panel.
  - `Finish` and Enter stop recording, upload audio, and dispatch the existing `start_voice` ModelTable event through the UI model's `bus_event_v2` write binding, worker root Model 0 ingress, and Matrix Chat host action path.
  - `Cancel` stops recording and dispatches no send event.
  - Recording auto-finishes at 60 seconds.
  - Tests explicitly prove the dispatched payload is complete ModelTable-like PRCKTV data and that the renderer does not call Matrix business APIs directly.
- Rollback:
  - Revert renderer/UI-model changes and keep the 0401 one-shot voice behavior while marking 0402 incomplete.

## Step 3 — Context-Aware Room Actions

- Scope: make room/member actions visible only when they apply to the selected conversation.
- Files:
  - `packages/ui-renderer/src/renderer.mjs`
  - `packages/ui-renderer/src/renderer.js`
  - `packages/worker-base/system-models/workspace_positive_models.json`
  - `scripts/tests/test_0402_matrix_chat_action_visibility_contract.mjs`
- Verification:
  - First run the new visibility test and confirm it fails because mutually exclusive controls are all present.
  - After implementation, run the new test plus 0401 membership tests and renderer syntax checks.
- Acceptance:
  - Normal room exposes allowed invite/remove/leave controls.
  - People/1v1 exposes leave 1v1 and hides normal room leave/remove controls unless explicitly allowed by that state.
  - Invite exposes invitation actions only.
  - No active room hides destructive room actions.
- Rollback:
  - Revert UI-model visibility props and renderer generic conditional support added in this step.

## Step 4 — Invitation UX

- Scope: separate invitation presentation and actions from normal chat room controls.
- Files:
  - `packages/ui-renderer/src/renderer.mjs`
  - `packages/ui-renderer/src/renderer.js`
  - `packages/worker-base/system-models/workspace_positive_models.json`
  - `packages/ui-model-demo-server/server.mjs`
  - `scripts/tests/test_0402_matrix_chat_action_visibility_contract.mjs`
- Verification:
  - First run the new invite UX test and confirm it fails on missing invite-specific state/actions.
  - After implementation, run the new test, 0401 membership tests, and server/renderer syntax checks.
- Acceptance:
  - Invites tab shows a pending invitation state with inviter, room name/topic, and accept/decline actions.
  - Accept joins then refreshes real Matrix projection.
  - Decline rejects/leaves the invite and removes it from active list without pretending to join.
  - Normal composer/member action UX is not used as the primary invite action area.
- Rollback:
  - Revert invite UI/action changes and preserve the 0401 accept-only behavior.

## Step 5 — Local Deploy, Browser Verification, Docs, Final Review

- Scope: deploy locally, verify in a real browser, update docs, and run final sub-agent review.
- Files:
  - `docs/user-guide/matrix_chat_feature_matrix.md`
  - `docs/iterations/0402-matrix-chat-voice-invite-ux/runlog.md`
  - `docs/iterations/0402-matrix-chat-voice-invite-ux/resolution.md`
  - `docs/ITERATIONS.md`
- Verification:
  - All 0401 Matrix Chat tests.
  - All new 0402 tests.
  - `node --check` for server/renderer files.
  - `python3 -m py_compile scripts/matrix_chat_real_flow_check.py`
  - `git diff --check`
  - local deploy and runtime baseline.
  - real browser walkthrough with fixed Playwright session cleanup, including voice finish, voice cancel, context-aware room/People/invite action visibility, accepting a real Matrix temporary invite, and declining a separate real Matrix temporary invite.
  - final sub-agent `codex-code-review`.
- Acceptance:
  - Docs match actual behavior.
  - Accept invitation and decline invitation both refresh the visible list correctly in a real browser.
  - No project Playwright session or project-managed browser process remains.
  - Final review approves with no findings.
- Rollback:
  - Mark 0402 as Change Requested, keep branch unmerged, and document blocker in runlog.

## Notes

- Generated at: 2026-06-02
- This iteration intentionally keeps video conferencing and screen sharing out of scope.
