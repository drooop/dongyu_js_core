---
title: "0388 Shell Route State Stability"
doc_type: iteration_plan
status: approved
updated: 2026-05-20
source: codex
---

# 0388 Shell Route State Stability

## Goal

Stabilize Android tablet shell navigation after 0387 so app launches, desktop returns, task switching, and second-level workspace pages do not bounce between stale states.

## Problem

The browser can briefly enter a desktop or slide app state and then return to the previous screen. A reproduced case showed the foreground shell title changing to `E2E 颜色生成器` while the embedded workspace content still displayed the previously selected app. This means shell foreground state and workspace selected-app state are not updated as one durable UI-local transition.

## Constraints

- UI remains a ModelTable projection; no direct business writes from the UI.
- Shell-local state may be UI-local negative-model state, but it must be persisted through the server path that already accepts UI-local labels.
- Desktop card launch must update the foreground app and the selected workspace app together.
- Stale SSE or snapshot updates must not overwrite a newer pending shell-local click.
- No compatibility fallback or hidden redirect is allowed.
- Each small stage and the final result must be reviewed by a sub-agent using `codex-code-review`.

## Scope

- Route and shell-local state sync in the frontend remote store and app shell.
- Server handling of UI-local shell state persistence if the current path is incomplete.
- Deterministic tests that reproduce stale snapshot and workspace selection mismatch.
- Local redeploy and real browser verification.

## Out of Scope

- Full redesign of all slide apps for the Android tablet shell.
- Remote cloud deployment.
- Commit/merge/push unless requested separately.

## Stages

- 0388.1: Freeze plan and review it.
- 0388.2: Add failing tests for shell state persistence and foreground/selection atomicity.
- 0388.3: Fix UI-local state persistence and stale snapshot reconciliation.
- 0388.4: Fix foreground workspace launch so shell app identity and embedded workspace content match immediately.
- 0388.5: Local deploy and real browser verification: desktop return, app launch, task switching, color generator submit.
- 0388.6: Big-stage final review and iteration closure after all deterministic and browser checks pass.

## Done Criteria

- Clicking `桌面` from a foreground app stays on desktop after delayed snapshots.
- Clicking a desktop slide app opens that same app, and the embedded workspace content matches the shell title/model.
- Task switcher open/close/reopen does not change the foreground app unexpectedly.
- `E2E 颜色生成器` still generates a new color through the deployed local stack.
- Deterministic tests and real browser verification pass.
