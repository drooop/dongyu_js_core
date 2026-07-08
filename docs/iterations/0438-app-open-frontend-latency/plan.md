---
title: "Iteration 0438 App Open Frontend Latency Plan"
doc_type: iteration-plan
status: planned
updated: 2026-07-04
source: ai
iteration_id: 0438-app-open-frontend-latency
id: 0438-app-open-frontend-latency
phase: planning
---

# Iteration 0438-app-open-frontend-latency Plan

## Goal

After 0435-0437, the server-side bootstrap and SSE first snapshot are already near `100ms` in the local Orbstack deployment. The remaining user-visible issue is that opening a foreground slide App can still stay on `正在加载滑动 APP...` for too long.

This iteration measures and improves the foreground App open path from the browser click to first rendered App content. The work must produce clear latency numbers before and after the change.

## Scope

In scope:
- Add or refine frontend/browser timing instrumentation for the App open path:
  - click / route state update
  - visible snapshot request start and response
  - JSON parse
  - `remote_store` snapshot apply
  - projection store update
  - UI AST build
  - Vue/browser render and loading placeholder removal
- Identify whether the remaining delay is network fetch, client parsing, snapshot application, projection, render, stale visible refs, or a loading-state transition bug.
- Implement bounded frontend/server adjustments only after the dominant latency node is measured.
- Verify with local Orbstack deployment and real browser tests.
- Record baseline and final metrics in `runlog.md`.

Out of scope:
- Cloud deployment and cloud latency tuning.
- Matrix / MQTT / management bus business roundtrip latency.
- New UI model components or visual redesign.
- Changing ModelTable semantics, PIN semantics, user isolation semantics, or subtable contracts.
- Reintroducing full snapshot fallback as a hidden compatibility path.

## Invariants / Constraints

- ModelTable remains the source of truth; UI remains a projection plus local ephemeral interaction state.
- Foreground App content must be loaded by table-qualified visible model refs.
- App/model granularity must not regress to full snapshot behavior.
- User-scoped desktop state and App table isolation from 0425 must remain intact.
- If the visible App model cannot be loaded, the UI must show an explicit failure state instead of staying indefinitely on the loading placeholder.
- Any optimization must keep existing snapshot patch recovery behavior correct.
- Verification must include deterministic tests and real browser evidence.

## Success Criteria

- A reproducible metric set exists for foreground App open latency, with named timing points and recorded values.
- Local browser test opens at least:
  - `E2E 颜色生成器`
  - `To Do Board` or another installed App table
- The loading placeholder either disappears within the recorded target window or reports a concrete load error.
- No regression in existing snapshot granularity, visible model ref, patch recovery, and 0437 bootstrap/SSE contracts.
- Final `runlog.md` records:
  - pre-change baseline
  - post-change metrics
  - exact commands
  - browser scenario
  - sub-agent review decisions

Target guidance for the local Orbstack environment:
- Snapshot response after App click should stay close to the 0437 local baseline (`~100ms`) unless the target App is materially larger.
- User-visible click-to-content for already installed local Apps should target sub-second behavior.
- If sub-second behavior is not achieved, this iteration must identify the measured bottleneck precisely enough to drive the next iteration.

## Inputs

- Created at: 2026-07-04
- Iteration ID: 0438-app-open-frontend-latency
- Previous evidence:
  - 0437 plain bootstrap: `143.3ms`, `28639` bytes.
  - 0437 bootstrap + App ref: `104.4ms`, `43570` bytes.
  - 0437 SSE first `snapshot`: `101.4ms`, `43458` bytes read.

## Review Requirement

Before Phase 3 implementation starts, this plan and `resolution.md` must be reviewed by a sub-agent using the `codex-code-review` skill. Implementation can start only after an `Approved` review gate is recorded in `runlog.md`.
