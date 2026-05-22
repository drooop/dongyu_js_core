---
title: "0388 Shell Route State Stability Resolution"
doc_type: iteration_resolution
status: completed
updated: 2026-05-20
source: codex
---

# 0388 Resolution

## Implementation Plan

### Stage 0388.2: Reproduce With Tests

Add deterministic tests that fail before implementation:

- A server or store-level test proving UI-local `label_update` for editor state is accepted and durable through the intended endpoint.
- A frontend/store test proving a pending local shell state value survives an older incoming snapshot.
- A shell test proving workspace app launch updates both `desktop_foreground_app_json` and `ws_app_selected`.

Review gate: sub-agent code review of the test scope before implementation.

### Stage 0388.3: Persist And Protect UI-Local Shell State

Implement the smallest fix needed so shell-local state writes reach the server and pending browser-local shell values are not overwritten by stale snapshots.

Likely files:

- `packages/ui-model-demo-frontend/src/remote_store.js`
- `packages/ui-model-demo-server/server.mjs`
- `scripts/tests/*0388*.mjs`

Verification:

- New 0388 tests.
- Existing route and desktop tests.

Review gate: sub-agent code review.

### Stage 0388.4: Atomic Workspace Launch

Make desktop app launch write the required shell state as one transition: foreground app, workspace selected app, and route projection target must agree.

Likely files:

- `packages/ui-model-demo-frontend/src/demo_app.js`
- `packages/ui-model-demo-frontend/src/desktop_app_state.js`
- route/desktop tests as needed.

Verification:

- New atomic launch test.
- Existing shell tests.

Review gate: sub-agent code review.

### Stage 0388.5: Local Deployment And Browser Verification

Rebuild/redeploy the affected local UI Server, then verify with a real browser:

- Open root desktop.
- Launch `E2E 颜色生成器`.
- Confirm shell title and embedded content match the same model.
- Click `桌面` and confirm it stays on desktop after waiting.
- Reopen via task switcher.
- Generate color and confirm color changes and status becomes processed.

Review gate: sub-agent code review of final diff and runlog evidence.

### Stage 0388.6: Final Review And Closure

Close the iteration only after all small-stage review gates pass.

Required closure inputs:

- Final diff scope.
- Updated runlog with deterministic command output and browser evidence.
- Local deployment evidence.
- Explicit check that 0386/0387 shell behavior still works.

Verification:

- Full 0388 test set.
- Existing 0386/0387 shell contract tests.
- UI AST validation.
- Frontend build.
- Real browser verification.

Review gate: final sub-agent `codex-code-review` over the complete 0388 change set and runlog. Only after `APPROVED`, update this resolution, runlog, and `docs/ITERATIONS.md` to completed.

## Rollback

Revert the 0388 changes to frontend shell state sync, remote store UI-local reconciliation, server UI-local endpoint handling, and new tests. Existing 0386/0387 artifacts remain intact.

## Result

Completed.

- Shell-local state now syncs through the existing `/bus_event` path instead of a missing UI-only endpoint.
- Pending foreground and workspace-selection state is protected from older incoming snapshots until the committed snapshot catches up.
- Desktop app launch writes foreground app, selected workspace app, and route state as one ordered transition.
- Local deployment and real browser verification confirmed that `E2E 颜色生成器` opens without stale embedded content, `桌面` stays on desktop, `任务` stays over the active app, and color generation still works.
