---
title: "Iteration 0402-matrix-chat-voice-invite-ux Plan"
doc_type: iteration-plan
status: planned
updated: 2026-06-03
source: ai
iteration_id: 0402-matrix-chat-voice-invite-ux
id: 0402-matrix-chat-voice-invite-ux
phase: phase1
---

# Iteration 0402-matrix-chat-voice-invite-ux Plan

## Goal

Make `Matrix Chat` feel like a usable chat app for voice and membership actions: voice recording must be a visible mode the user can finish deliberately, room actions must be context-aware, and invitations must use a purpose-built request flow instead of being mixed into ordinary room operations.

## Problem Statement

The 0401 implementation proved the Matrix path works, but three UX problems remain:

- `Voice` currently records a fixed short clip immediately after click. This technically sends `m.audio`, but it is not a usable voice-message interaction.
- The room details action area shows mutually exclusive actions together, such as `Remove`, `Leave room`, `Leave 1v1`, and `Accept invite`. This is visually noisy and can imply invalid operations.
- Invitations are represented as ordinary rooms plus an `Accept invite` button in the same details area. Users need a clearer "pending invitation" state with accept/decline style actions separated from normal room controls.

## Scope

In scope:

- Add a visible voice recording mode for Matrix Chat.
- Voice recording starts on `Voice`, shows a recording panel, and sends only when the user clicks `Finish` or presses Enter.
- Voice recording has a hard 60 second upper bound and stops/sends automatically at the limit.
- The recording panel exposes an explicit cancel path that stops without sending.
- Make room/member action controls visible only when they apply to the selected conversation:
  - normal room: invite/remove when allowed, leave room.
  - 1v1/People: leave 1v1.
  - invite: accept/decline invitation only.
  - no active room: no destructive room action.
- Redesign invitation UX as a distinct invitation state with clear inviter/room summary and accept/decline actions.
- Keep all UI as ModelTable-driven labels and generic renderer capabilities. No direct Matrix calls from frontend.
- Update the Matrix Chat feature guide and runlog with the new interaction model and verification evidence.

Out of scope:

- Video conferencing and screen sharing.
- Multi-file upload.
- Push notifications for invitations.
- Formal Matrix `m.direct` account-data management beyond the existing classification rules.
- A full contact/friend management redesign.

## Invariants / Constraints

- `Matrix Chat` remains a positive-model, ModelTable-defined built-in slide app.
- UI events must be declared by the UI model and enter through the worker root Model 0 system bus boundary as complete ModelTable-like `bus_event_v2` payloads; Model 0 then routes to the Matrix Chat model and server-side host actions.
- Renderer changes must be generic enough to serve UI-model needs; do not hard-code Matrix API behavior in frontend components.
- No fake success states. A voice message is sent only after a real browser recording and upload path succeeds.
- Failed media permission, canceled recording, invite accept/decline, and leave/remove errors must be visible in the model state.
- Tests must be written before implementation for each behavior slice.
- Real browser verification must use the fixed Playwright session guard and must clean up managed browser processes afterward.

## Success Criteria

- Clicking `Voice` enters a visible recording state instead of immediately sending a fixed one-second clip.
- The recording state shows that recording is active, supports `Finish`, supports Enter-to-finish, supports cancel, and enforces a 60 second maximum.
- `Finish`, Enter-to-finish, and the 60 second automatic finish must dispatch complete ModelTable-like `bus_event_v2` payloads through Model 0; frontend code must not directly call Matrix send APIs.
- A finished recording sends a real Matrix `m.audio` message and renders as an audio card.
- Room detail actions are context-aware. The UI no longer shows `Remove`, `Leave room`, `Leave 1v1`, and `Accept invite` all at once.
- Invitation rooms show invitation-specific copy and accept/decline controls; normal room controls are hidden while the selected item is an invite.
- Accept invitation and decline invitation are both verified with real Matrix temporary invite rooms in a real browser, including list refresh after the action.
- Deterministic tests prove the voice recording state contract, action visibility contract, and invitation UX contract.
- Real browser verification covers recording start/finish, audio send, invite accept flow, and action visibility for room/People/invite states.
- A sub-agent code review approves each implementation stage and the final state.

## Inputs

- Created at: 2026-06-02
- Iteration ID: 0402-matrix-chat-voice-invite-ux
- Work branch: `dropx/dev_0402-matrix-chat-voice-invite-ux`
- User request: improve Matrix Chat voice recording UX, context-aware room action visibility, and invitation accept/invite UX.
