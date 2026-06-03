---
title: "Iteration 0401-matrix-chat-real-media-membership Plan"
doc_type: iteration-plan
status: planned
updated: 2026-06-03
source: ai
iteration_id: 0401-matrix-chat-real-media-membership
id: 0401-matrix-chat-real-media-membership
phase: phase1
---

# Iteration 0401-matrix-chat-real-media-membership Plan

## Goal

Make `Matrix Chat` a real minimum usable chat client for media messages and membership operations, instead of a UI shell that only proves part of the path.

## Problem Statement

Current Matrix Chat still has gaps that can mislead users:

- Message cards are too coarse. Text, file, image, and audio messages need distinct compact cards, and file/image cards need practical download/open affordances.
- `Voice` only reports that the feature is not connected. It must either record and send a real Matrix audio message, or fail clearly with a testable browser/media reason.
- Leaving a room may call Matrix successfully, but the visible list can still contain the room in a disabled or stale state. The user cannot tell whether Matrix state or local projection is wrong.
- Member workflows need end-to-end verification, not just mocked host actions: invite, accept/join, remove/kick, leave, People/1v1 delete/leave, and multiplayer room behavior must be tested with scripts and with a real browser.

## Scope

In scope:

- Improve `MessageTimeline` and related model data so text, file, image, and audio events render as distinct message cards.
- Add file/image download or open links that are generated from Matrix `mxc://` media and stay model-driven.
- Add real browser-side audio recording for one voice message at a time, upload it, and send it as a Matrix `m.audio` message.
- Fix room list projection after leave/delete so left rooms disappear from selectable lists after refresh, or are visibly archived only when Matrix still reports them.
- Complete invite/join/remove/leave/delete friend test coverage with real Matrix API checks and browser flows.
- Update `docs/user-guide/matrix_chat_feature_matrix.md` with implemented status and a regression checklist.

Out of scope:

- Video conferencing and screen sharing.
- Multi-file upload.
- Full encrypted media support.
- Full Matrix account/device/session management beyond the test identities required for this iteration.
- Rewriting Matrix Suite; this iteration targets `Matrix Chat`.

## Invariants / Constraints

- `Matrix Chat` UI remains ModelTable-defined. Renderer additions must be generic UI components or generic props, not Matrix-specific frontend shortcuts.
- Frontend must not call Matrix business APIs directly. UI events must go through ModelTable labels, Model 0 route, and server-side host actions.
- Transport uses the remote Matrix homeserver configured for local testing, currently `https://matrix.dongyudigital.com`.
- Membership E2E requires two real Matrix identities. Baseline identities are `drop` as the UI actor and `mbr` as the second participant. If either usable identity is unavailable, Step 5 is blocked rather than partially accepted.
- Real browser verification must use the fixed Playwright session helper and must clean up that session after tests.
- No fake success states. If a media or membership operation is not actually completed, the UI must show a failure or pending state.
- Existing Matrix Chat tests must stay green and be expanded before behavior changes.

## Success Criteria

- Text messages render as text bubbles.
- File messages render as file cards with filename, short metadata when available, and a visible download/open action.
- Image messages render as image cards with a thumbnail/preview area and download/open action.
- Audio messages render as audio cards with playback/download affordance.
- Browser voice flow records a short audio clip, uploads it, sends `m.audio`, and shows it in the timeline as an audio card.
- Leaving a room or People/1v1 conversation causes it to disappear from selectable active lists after local projection and after Matrix refresh, unless Matrix still reports it as joined.
- Invite, accept/join, remove/kick, leave, and People/1v1 delete/leave are covered by deterministic tests and real browser verification.
- Runlog records commands, key outputs, browser evidence, cleanup result, and sub-agent review decisions.

## Inputs

- Created at: 2026-06-01
- Iteration ID: 0401-matrix-chat-real-media-membership
- Work branch: `dropx/dev_0400-matrix-chat-ux-hardening`
- User request: make Matrix Chat media cards, real voice send, room leave projection, and membership workflows actually work and be tested in a real browser.
