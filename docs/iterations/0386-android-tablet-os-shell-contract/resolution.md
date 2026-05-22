---
title: "0386 - Android Tablet OS Shell Contract Resolution"
doc_type: iteration-resolution
status: approved
updated: 2026-05-20
source: codex
iteration_id: 0386-android-tablet-os-shell-contract
phase: approved
---

# Iteration 0386-android-tablet-os-shell-contract Resolution

## Execution Strategy

- Treat 0374 as the baseline: it already has a desktop, single foreground app, and task switcher.
- 0386 freezes the next contract on top of 0374: Android tablet OS shell structure, reusable shell components, and slide app summary metadata.
- 0387 then implements the contract without introducing MUI / Quasar dependencies and without changing business event paths.

## Step 1: Contract Artifact And RED Tests

- Scope:
- Fill 0386 and 0387 iteration documents.
- Register both iterations in `docs/ITERATIONS.md`.
- Add a deterministic contract test that checks the expected OS shell components, app summaries, and dependency boundary.
- Files:
- `docs/ITERATIONS.md`
- `docs/iterations/0386-android-tablet-os-shell-contract/*`
- `docs/iterations/0387-android-tablet-os-shell-mvp/*`
- `scripts/tests/test_0386_android_tablet_os_shell_contract.mjs`
- Verification:
- `node scripts/tests/test_0386_android_tablet_os_shell_contract.mjs`
- Acceptance:
- Before 0387 implementation, failures must point only to expected missing implementation pieces.
- Rollback:
- Remove the two iteration rows, the two iteration directories, and the new contract test.

## Step 2: Sub-Agent Contract Review

- Scope:
- Ask a sub-agent to review the contract docs and RED test using `codex-code-review`.
- Fix concrete findings until the review decision is `APPROVED`.
- Files:
- Same as Step 1.
- Verification:
- Review decision is recorded in `runlog.md`.
- Acceptance:
- No unresolved `CHANGE_REQUESTED` findings remain.
- Rollback:
- Revert the docs/test slice.

## Step 3: Close Contract Phase

- Scope:
- Update 0386 runlog with command evidence and review decision.
- Move `docs/ITERATIONS.md` 0386 status to `Completed` and 0387 to `In Progress` immediately before 0387 implementation starts.
- Files:
- `docs/ITERATIONS.md`
- `docs/iterations/0386-android-tablet-os-shell-contract/runlog.md`
- Verification:
- `rg -n "0386-android-tablet-os-shell-contract|0387-android-tablet-os-shell-mvp" docs/ITERATIONS.md docs/iterations/0386-android-tablet-os-shell-contract docs/iterations/0387-android-tablet-os-shell-mvp`
- Acceptance:
- 0386 has reproducible evidence and an approved review gate.
- Rollback:
- Restore 0386 to `In Progress` if 0387 implementation is not started.
