---
title: "0359 Matrix Submit Example E2E Resolution"
doc_type: iteration_resolution
status: completed
updated: 2026-05-07
source: ai
iteration: 0359-matrix-submit-example-e2e
---

# Iteration 0359-matrix-submit-example-e2e Resolution

## Execution Strategy

- First reproduce the color generator and local naming state in a real browser/snapshot so fixes target the observed break.
- Add a failing contract test for a new minimal submit Matrix example, then implement only the ModelTable records, route labels, remote-worker patch, and docs needed to pass it.
- Rebuild/redeploy locally and use Playwright to verify both the color generator and the new Matrix example on the real Workspace page.

## Step 1

- Scope: Baseline reproduction and local test-artifact cleanup.
- Files: runtime state only, iteration runlog evidence.
- Verification: Playwright snapshot and local snapshot/API checks.
- Acceptance: color generator current behavior is known, and any visible local app name containing `Codex` is renamed or removed/recreated with a neutral name.
- Rollback: restore from current runtime snapshot or rerun local deployment from the previous commit.

## Step 2

- Scope: Contract test and ModelTable route implementation for the minimal submit Matrix example.
- Files: `scripts/tests/`, `packages/worker-base/system-models/`, `deploy/sys-v1ns/remote-worker/patches/`.
- Verification: targeted Node contract tests and existing pin hard-cut tests.
- Acceptance: seeded example declares cellwise UI, `bus_event_v2`, Model 0 `pin.connect.cell` route, MBR route, remote-worker subscriptions, and a remote program that returns `display_text`.
- Rollback: revert the new model records, remote-worker patch, config route, and tests.

## Step 3

- Scope: User-guide and interactive/visualized documentation.
- Files: `docs/user-guide/slide-app-runtime/`.
- Verification: docs contract tests and static HTML browser load.
- Acceptance: docs describe the real dual-bus example, exact topics, exact records, and program model content; static preview wording no longer claims local-only behavior as final E2E proof.
- Rollback: revert docs files.

## Step 4

- Scope: Local deployment and real browser E2E verification.
- Files: build/deploy artifacts only.
- Verification: local baseline check, Playwright Workspace flow, MBR/remote-worker logs.
- Acceptance: browser-visible color changes, minimal submit display changes via actual Matrix roundtrip, and logs show submit/result topics.
- Rollback: redeploy previous local image/assets.

## Notes

- Completed at: 2026-05-07
- Browser evidence: color generator changed color after deploy; minimal submit Matrix example displayed `Submitted: matrix submit 0507 real roundtrip` and `remote_processed`.
- Runtime evidence: MBR and remote-worker logs show `UIPUT/ws/dam/pic/de/sw/1050/submit` and `UIPUT/ws/dam/pic/de/sw/1050/result`.
