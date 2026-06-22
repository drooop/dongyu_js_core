---
title: "Iteration 0420 UI Local State Latency Plan"
doc_type: iteration-plan
status: completed
updated: 2026-06-22
source: ai
iteration_id: 0420-ui-local-state-latency
id: 0420-ui-local-state-latency
phase: completed
---

# Iteration 0420-ui-local-state-latency Plan

## Goal

Reduce post-login and post-load UI interaction latency without changing the formal ModelTable business path.

The specific problem observed on 2026-06-22 is that local UI state synchronization (`/ui_event`) can be queued ahead of formal business events (`/bus_event`). This makes local-looking interactions such as opening a Dialog feel slow and can delay the formal event path even when the target action itself is not slow.

## Scope

- In scope:
  - Keep Input typing local-first by default.
  - Ensure local-only UI state synchronization does not block formal business events.
  - Keep submit correctness: a submit must read the currently visible local overlay value even if delayed persistence has not completed.
  - Improve post-login first usable app display where startup currently shows guest/read-only state before the authenticated snapshot completes.
  - Add deterministic tests for the queueing and local-state contracts.
  - Add browser-visible latency measurement evidence before and after changes.
  - Record concrete latency deltas in `runlog.md`.
- Out of scope:
  - Changing MQTT, MBR, Matrix, or remote-worker routing semantics.
  - Replacing SSE with another protocol.
  - Removing full `/snapshot` recovery.
  - Fixing unrelated MBR readiness or remote-worker model defects unless the latency changes directly caused them.

## Invariants / Constraints

- ModelTable remains the source of truth for formal business state.
- UI remains a projection; UI must not directly write final business labels.
- Formal business events still enter through Model 0 bus event handling and required pin paths.
- `bus_event_v2` payloads remain ModelTable-like record arrays.
- Local-only UI state may be browser-local and may be background-synchronized, but it must not become a required predecessor for unrelated formal business events.
- If a formal submit needs staged input values, those values must be flushed or read from overlay before dispatch.
- Snapshot and SSE patch behavior must keep principal filtering and recovery semantics.
- Verification must include deterministic tests and real browser measurements.

## Success Criteria

- Deterministic tests prove local-only `/ui_event` background synchronization does not block a later `/bus_event`.
- Deterministic tests prove `Input` default typing remains local-only and submit still reads the latest visible input value.
- Deterministic tests prove Dialog/Tabs local-only state can be updated without formal business writes.
- Browser measurement records baseline and final values for:
  - login-to-app-content time;
  - To Do Board Dialog open/close latency;
  - Tab switch latency;
  - Input typing latency;
  - `/ui_event`, `/bus_event`, and fallback `/snapshot` timing/bytes where visible in browser network events.
- Post-change target:
  - To Do Board local-only Dialog open/close should be below 500ms in the real browser when no formal business action is needed.
  - Formal `/bus_event` must no longer wait behind queued local-only `/ui_event` requests.
  - Input visible feedback must remain below 100ms in the real browser.
- If a metric does not improve, `runlog.md` must record the reason and the remaining bottleneck.

## Baseline Observed Before 0420

- Fresh authenticated tab to selected app content visible: about 3920ms.
- To Do Board Dialog open: about 1881ms.
- To Do Board Dialog close: about 1949ms.
- To Do Board Tab switch: about 316ms.
- To Do Board Input fill visible feedback: about 38ms.
- Network trace around Dialog interaction:
  - several `/ui_event` requests were queued before the formal event;
  - observed `/ui_event` response spans included about 1.5s to 4.0s each;
  - formal `/bus_event` response was about 1.44s;
  - fallback `/snapshot` was about 0.54s and about 199517 bytes.
- E2E Color Generator is not a valid latency metric in this baseline because the button was disabled/loading and `MBR READY=false`; no MQTT request reached remote-worker in that test.

## Inputs

- Created at: 2026-06-22
- Iteration ID: 0420-ui-local-state-latency
- Branch: `dropx/dev_0420-ui-local-state-latency`
