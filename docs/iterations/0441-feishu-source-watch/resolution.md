---
title: "Iteration 0441 Feishu Source Watch Resolution"
doc_type: iteration-resolution
status: completed
updated: 2026-07-08
source: ai
iteration_id: 0441-feishu-source-watch
id: 0441-feishu-source-watch
phase: phase1
---

# Iteration 0441-feishu-source-watch Resolution

## Execution Strategy

Freeze the Feishu source watch as a docs-only plan first. After review approval, implement the smallest local tool that can run both against fixtures and against real Feishu OpenAPI credentials. The first implementation should favor reliable local polling and diffing; official event subscription becomes an optional accelerator that triggers the same diff path.

Feishu changes are treated as meeting-consensus input. The tool may propose direct plan updates when a change is compatible with current SSOT. It must not make final reject/defer decisions. Apparent conflict, missing boundary, unclear ownership, or implementation risk must be reported as `requires_user_confirmation` with the changed heading and an explicit reason.

## Step 1 - Planning Gate

- Scope:
  - Register 0441.
  - Capture official Feishu API findings.
  - Freeze `plan.md`, `resolution.md`, and `runlog.md`.
  - No runtime code or script implementation in this step.
- Files:
  - `docs/ITERATIONS.md`
  - `docs/iterations/0441-feishu-source-watch/plan.md`
  - `docs/iterations/0441-feishu-source-watch/resolution.md`
  - `docs/iterations/0441-feishu-source-watch/runlog.md`
- Verification:
  - `git diff --check`
  - Re-read `CLAUDE.md` and `docs/ssot/feishu_alignment_decisions_v0.md` authority boundaries.
- Acceptance:
  - Iteration is registered as `Planned`.
  - The plan names official API limits and the no-auto-apply SSOT rule.
  - The plan states that reject/defer cases require explicit reason and user/team confirmation.
- Rollback:
  - Remove the 0441 row and iteration directory.

## Step 2 - Local Diff Contract And Manifest

- Scope:
  - Add a no-secrets manifest for the maintained Feishu source group.
  - Add fixture docs representing previous and current Feishu content.
  - Add a deterministic test that expects section-level change grouping, SSOT impact hints, and a `requires_user_confirmation` stop for apparent reject/defer cases.
- Expected files:
  - `docs/ssot/feishu_source_watch_manifest.json`
  - `scripts/fixtures/feishu_source_watch/basic/`
  - `scripts/tests/test_0441_feishu_source_watch_contract.mjs`
- Verification:
  - `node scripts/tests/test_0441_feishu_source_watch_contract.mjs`
- Acceptance:
  - Test starts RED before the tool exists.
  - Manifest contains document roles, URLs, token extraction hints, and likely affected SSOT files.
  - Fixtures contain no real Feishu private content.
  - Test fixture includes a direct compatible change and a conflict-like change so the report proves both paths.
- Rollback:
  - Remove the manifest, fixture directory, and test file.

## Step 3 - Fetch, Snapshot, Diff, And Report Tool

- Scope:
  - Implement one Node CLI that supports fixture mode and real Feishu mode.
  - Real mode reads credentials only from environment variables.
  - Real mode resolves `/wiki/...` source URLs through `wiki/v2/spaces/get_node` before fetching docx Markdown content.
  - If Wiki or Markdown content permissions are missing, real mode may use `raw_content` as a lower-fidelity fallback and must disclose that in the report.
  - Snapshot state is written under a caller-provided `--state-dir`, defaulting to an ignored local directory.
  - Diff report is Markdown and includes document role, changed headings, old/new hashes, likely SSOT targets, and suggested review class.
  - Because official Feishu file-version APIs only expose version metadata, not UI-level "show changes" diff content, the local report includes a bounded `Section Diff` block generated from snapshots.
  - Report must include explicit reasons for all `requires_user_confirmation` items and must not describe them as final rejections.
- Expected files:
  - `scripts/ops/feishu_source_watch.mjs`
  - `docs/ssot/feishu_source_watch_manifest.json`
  - `docs/ssot/feishu_alignment_decisions_v0.md`
  - `.gitignore` if a new local state directory must be ignored.
  - `scripts/tests/test_0441_feishu_source_watch_contract.mjs`
  - `docs/iterations/0441-feishu-source-watch/runlog.md`
- Verification:
  - `node scripts/tests/test_0441_feishu_source_watch_contract.mjs`
  - Fixture smoke:
    - `node scripts/ops/feishu_source_watch.mjs --fixture scripts/fixtures/feishu_source_watch/basic --state-dir test_files/feishu_source_watch_tmp --report test_files/feishu_source_watch_tmp/report.md`
  - No-change smoke:
    - Run the same command twice and confirm second report is `NO_CHANGE`.
  - `git diff --check`
- Acceptance:
  - Fixture report is deterministic.
  - Real Feishu code path is present but does not run in tests without credentials.
  - No secrets or raw private source snapshots are committed.
  - Compatible fixture changes are listed as `adopt_plan_update`.
  - Conflict-like fixture changes are listed as `requires_user_confirmation` with an explicit reason and stop marker.
  - Reports show concrete `+` / `-` changed lines under each changed heading without copying whole source documents into the report.
  - Real Feishu fallback mode can create a local raw-content baseline when the app has docx read permission but lacks Wiki / Markdown content scopes.
  - Real Feishu Markdown mode can create a high-fidelity local baseline without generating false SSOT change recommendations.
- Rollback:
  - Remove the CLI, fixtures, test updates, and generated local state.

## Step 4 - Optional Official Event Trigger

- Scope:
  - Add a thin event receiver or SDK long-connection helper only after local diff mode is stable.
  - Handler must accept `drive.file.edit_v1`, map `file_token` to the manifest, and invoke the same diff path.
- Expected files:
  - `scripts/ops/feishu_source_watch_event_receiver.mjs` or SDK helper script.
  - Existing 0441 contract test extensions with mocked event payload.
- Verification:
  - Mocked `drive.file.edit_v1` event triggers a diff run for the mapped document only.
  - Official subscription setup is documented but not required for local polling mode.
- Acceptance:
  - Event mode never writes SSOT directly.
  - Missing event config degrades to explicit poll mode, not silent failure.
- Rollback:
  - Remove the event helper while keeping poll mode.

## Notes

- Generated at: 2026-07-08.
- Phase 1 remains docs-only until review approval.
