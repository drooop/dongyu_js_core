---
title: "Iteration 0441 Feishu Source Watch Runlog"
doc_type: iteration-runlog
status: completed
updated: 2026-07-08
source: ai
iteration_id: 0441-feishu-source-watch
id: 0441-feishu-source-watch
phase: phase1
---

# Iteration 0441-feishu-source-watch Runlog

## Environment

- Date: 2026-07-08
- Branch: `dropx/dev_0441-feishu-source-watch`
- Starting branch: `dev`
- Starting state:
  - `docs/ssot/feishu_alignment_decisions_v0.md` already defines the four maintained Feishu collaboration documents.
  - Feishu documents are source input, not automatic repository SSOT.
  - No Feishu credentials were available or requested for this planning step.

## API Research

- Official Markdown docs checked:
  - `https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/drive-v1/file/subscribe.md`
  - `https://open.feishu.cn/document/server-docs/docs/drive-v1/event/list/file-edited.md`
  - `https://open.larkoffice.com/document/docs/docs-v1/get.md`
  - `https://open.feishu.cn/document/server-docs/docs/wiki-v2/space-node/get_node.md`
  - `https://open.feishu.cn/document/server-docs/docs/docs/docx-v1/document/raw_content.md`
  - `https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/drive-v1/file-version/list.md`
  - `https://open.feishu.cn/document/server-docs/docs/drive-v1/file-version/overview.md`
  - `https://open.feishu.cn/document/server-docs/docs/drive-v1/file-version/get.md`
- Findings:
  - `drive.file.edit_v1` can notify that a subscribed document changed.
  - The edit event identifies the file and operator metadata but does not include a semantic content diff.
  - Markdown content can be fetched from `GET /open-apis/docs/v1/content`.
  - Current maintained links are `/wiki/...` links, so real mode must first resolve the wiki node token with `GET /open-apis/wiki/v2/spaces/get_node` to obtain the actual docx `obj_token`.
  - Raw text and version-list APIs are useful fallback/supporting checks.
  - Official Drive file-version APIs support creating, deleting, listing, and getting version metadata for docx/sheet files.
  - The public file-version response fields cover title, version id, parent token, owner/creator, timestamps, status, object type, and parent type; they do not expose the page UI's "show changes" line-level diff.
  - Real probe against `feishu-model2` and `feishu-message-api` was blocked by missing `drive:drive:version` or `drive:drive:version:readonly`; enabling either scope is required before version metadata can be read.

## Review Gate Records

Review Gate Record
- Iteration ID: 0441-feishu-source-watch
- Review Date: 2026-07-08
- Review Type: User approval
- Review Index: 1
- Decision: Approved
- Notes: User approved continuing implementation and added a required boundary: Feishu documents are meeting-consensus summaries, so apparent reject/defer cases must be surfaced with explicit reasons and wait for user/team confirmation; compatible plan updates may proceed.

## Execution Records

### Step 1 - Planning Gate

- Commands:
  - `git switch -c dropx/dev_0441-feishu-source-watch`
  - Official docs fetched with `curl -L` against `.md` OpenAPI pages.
  - Manual Phase 1 docs update with `apply_patch`.
- Result:
  - Planning docs created.
  - Iteration registered as `Planned`.
- Verification:
  - `git diff --check`: PASS.
  - `node scripts/ops/validate_obsidian_docs_gate.mjs`: PASS.
  - `rg -n "[ \t]+$" docs/ITERATIONS.md docs/iterations/0441-feishu-source-watch`: PASS, no trailing whitespace matches.
  - `rg -n "0441-feishu-source-watch|drive.file.edit_v1|docs/v1/content|Feishu Source Watch" docs/ITERATIONS.md docs/iterations/0441-feishu-source-watch`: PASS, expected planning/API anchors present.
- Result: PASS.

### Step 1b - User Confirmation Boundary Update

- Trigger:
  - User approved continuing and clarified that Feishu documents summarize weekly meeting consensus.
- Changed:
  - `docs/ITERATIONS.md` status moved from `Planned` to `Approved`.
  - `plan.md` and `resolution.md` now require explicit reasons and user/team confirmation for apparent reject/defer cases.
  - Directly compatible changes remain eligible for plan-update proposals.
- Result: PASS.

### Step 2 - RED Contract For Source Watch

- Added:
  - `docs/ssot/feishu_source_watch_manifest.json`
  - `scripts/fixtures/feishu_source_watch/basic/`
  - `scripts/tests/test_0441_feishu_source_watch_contract.mjs`
- Command:
  - `node scripts/tests/test_0441_feishu_source_watch_contract.mjs`
- Key output:
  - Manifest policy test passed.
  - Fixture and event tests failed because `scripts/ops/feishu_source_watch.mjs` did not exist.
  - Failure was expected RED: `MODULE_NOT_FOUND`.
- Result: RED PASS.

### Step 3 - Fetch, Snapshot, Diff, And Report Tool

- Added:
  - `scripts/ops/feishu_source_watch.mjs`
- Changed:
  - `docs/ssot/feishu_alignment_decisions_v0.md` now points to the source-watch manifest and records the user/team confirmation rule for apparent reject/defer cases.
- Behavior:
  - Fixture mode compares previous/current Markdown by heading.
  - Real mode reads `FEISHU_TENANT_ACCESS_TOKEN` or `FEISHU_ACCESS_TOKEN`.
  - Real mode resolves wiki node tokens to docx `obj_token` through `wiki/v2/spaces/get_node`, then fetches Markdown through `docs/v1/content`.
  - If Wiki or Markdown content permission is missing, real mode falls back to `docx/v1/documents/:document_id/raw_content` and marks `Source Format: raw_content`.
  - If no previous snapshot exists, the tool writes a local baseline and reports `BASELINE_CREATED` instead of treating first-run content as an SSOT change.
  - Reports use `adopt_plan_update` for compatible changes and `requires_user_confirmation` for conflict-like changes.
  - `--event-file` accepts a mocked `drive.file.edit_v1` payload and filters the run to the matching source document.
  - `--doc-id` accepts a comma-separated list and filters the run to selected manifest document ids.
- Commands:
  - `node scripts/tests/test_0441_feishu_source_watch_contract.mjs`
  - `node --check scripts/ops/feishu_source_watch.mjs`
  - `node --check scripts/tests/test_0441_feishu_source_watch_contract.mjs`
  - `node scripts/ops/feishu_source_watch.mjs --help`
  - `rm -rf test_files/feishu_source_watch_tmp && node scripts/ops/feishu_source_watch.mjs --manifest docs/ssot/feishu_source_watch_manifest.json --fixture scripts/fixtures/feishu_source_watch/basic --state-dir test_files/feishu_source_watch_tmp/state --report test_files/feishu_source_watch_tmp/report.md`
  - `node scripts/ops/feishu_source_watch.mjs --manifest docs/ssot/feishu_source_watch_manifest.json --fixture scripts/fixtures/feishu_source_watch/basic --state-dir test_files/feishu_source_watch_tmp/state --report test_files/feishu_source_watch_tmp/report-second.md`
- Key output:
  - Contract test: `3 passed, 0 failed out of 3`.
  - First fixture smoke report: `Status: CHANGED`, `Documents Changed: 1`, `Confirmation Stops: 1`.
  - Compatible fixture section `PIN 连接规则`: `Review Class: adopt_plan_update`.
  - Conflict-like fixture section `权限边界`: `Review Class: requires_user_confirmation`, reason begins `current SSOT conflict`, stop marker says `user/team confirmation required`.
  - Second fixture smoke report: `Status: NO_CHANGE`.
- Real Feishu mode:
  - Initial environment check found no exported `FEISHU_TENANT_ACCESS_TOKEN` / `FEISHU_ACCESS_TOKEN`.
  - Local ignored `.env` contains `FEISHU_APP_ID` / `FEISHU_APP_SECRET`; a shell-local tenant token exchange succeeded.
  - Markdown path was blocked by missing Feishu app scopes:
    - `wiki:node:read` or `wiki:wiki:readonly` / `wiki:wiki` for wiki node resolution.
    - `docs:document.content:read` for Markdown content reads.
  - `raw_content` fallback succeeded for all four tracked wiki tokens.
  - First real fallback report:
    - `Status: CHANGED`
    - `Documents Checked: 4`
    - `Documents Changed: 4`
    - `Source Format: raw_content`
    - `Confirmation Stops: 4`
  - Second real fallback report with the same state dir:
    - `Status: NO_CHANGE`
    - `Documents Checked: 4`
    - `Documents Changed: 0`
  - After the user enabled Feishu permissions, high-fidelity Markdown mode succeeded:
    - First Markdown report: `Status: BASELINE_CREATED`
    - `Documents Checked: 4`
    - `Baselines Created: 4`
    - `Documents Changed: 0`
    - `Confirmation Stops: 0`
    - All four documents reported `Source Format: markdown`
    - Second Markdown report: `Status: NO_CHANGE`
  - Focused source monitor prepared for user-requested docs:
    - Added `feishu-model2` for `软件工人模型2`.
    - Added `feishu-message-api` for `软件工人消息API文档`.
    - Command used `--doc-id feishu-model2,feishu-message-api`.
    - First focused Markdown report: `Status: BASELINE_CREATED`, `Documents Checked: 2`, `Baselines Created: 2`.
    - Second focused Markdown report: `Status: NO_CHANGE`, `Documents Checked: 2`, `Documents Changed: 0`.
- Result: PASS.

### Step 3b - Git-like Section Diff Report

- Trigger:
  - User pointed to Feishu's page-level history UI and asked whether OpenAPI exposes an equivalent.
- Finding:
  - Official file-version APIs expose version metadata, not the concrete "show changes" diff displayed in the Feishu web UI.
- Changed:
  - `scripts/ops/feishu_source_watch.mjs` now renders a bounded `Section Diff` block for each changed heading.
  - Added lines are prefixed with `+`; removed lines are prefixed with `-`; heading lines are omitted from the diff body to keep reports compact.
  - The report still preserves `requires_user_confirmation` and explicit reasons for apparent conflict/defer/reject cases.
- Verification:
  - `node scripts/tests/test_0441_feishu_source_watch_contract.mjs`: PASS, `6 passed, 0 failed out of 6`.
  - Fixture smoke report contains `Section Diff` with concrete `+` lines for both compatible and confirmation-stop changes.
  - Focused real Feishu rerun: `Status: NO_CHANGE`, `Documents Checked: 2`, `Documents Changed: 0`, `Confirmation Stops: 0`.
- Result: PASS.

### Step 3c - Version Permission Reprobe

- Trigger:
  - User enabled the Feishu Drive version permission and asked to continue.
- Command:
  - Resolved the two focused wiki docs to docx tokens, then called `GET /open-apis/drive/v1/files/:file_token/versions?page_size=20&obj_type=docx`.
- Result:
  - `feishu-model2`: `code: 0`, `item_count: 0`, `has_more: false`.
  - `feishu-message-api`: `code: 0`, `item_count: 0`, `has_more: false`.
- Conclusion:
  - The permission is now active.
  - The official file-version API does not expose the Feishu web UI's continuous edit-history diff for these docs; it returns managed version metadata only, and there are currently no managed versions for the two focused docs.
  - Concrete change tracking should continue to use Markdown snapshot diff.
- Follow-up verification:
  - Focused Markdown watcher after version permission: `Status: NO_CHANGE`, `Documents Checked: 2`, `Documents Changed: 0`, `Confirmation Stops: 0`.
- Result: PASS.

### Step 4 - Current Baseline And Implementation Diff

- Trigger:
  - User asked to first fix the current versions of the two focused Feishu documents and then reread the current versions against the existing implementation.
- Baseline command:
  - `node scripts/ops/feishu_source_watch.mjs --manifest docs/ssot/feishu_source_watch_manifest.json --doc-id feishu-model2,feishu-message-api --state-dir test_files/feishu_source_watch_focus_jyn_wbz/state --report test_files/feishu_source_watch_focus_jyn_wbz/report-current-baseline.md`
- Baseline result:
  - Report: `test_files/feishu_source_watch_focus_jyn_wbz/report-current-baseline.md`
  - `Status: NO_CHANGE`
  - `Documents Checked: 2`
  - `Documents Changed: 0`
  - `Baselines Created: 0`
  - `Confirmation Stops: 0`
- Fixed snapshot hashes:
  - `feishu-model2`: `6f3b1803a9d54a05452e93a2ea9c041be424196a64a3931763b1ec571b9e129a`
  - `feishu-message-api`: `75f96f5f3b1bff23b5cd704a0e4f0fa4ed5fff01f66fbc19cc5e7424a9c5c57e`
- Added:
  - `docs/iterations/0441-feishu-source-watch/current-version-implementation-diff.md`
- Key findings:
  - `pin_payload.v1` in the current Feishu message API conflicts with the repository's current `pin_payload.v2` runtime contract; this requires user/team confirmation before any direction change.
  - Feishu `model.v1n` remains a source concept, while current implementation accepts `model.table` plus worker labels and rejects `model.v1n`; this requires confirmation.
  - Feishu numeric `model.subtableconnection.v` conflicts with the implementation's table-qualified object descriptor; this requires confirmation because it affects principal and child table boundaries.
  - Feishu lists resource/data/UI/task `sys_msg_type` APIs that are not implemented as formal repository message handlers yet; these are plan candidates after the protocol direction is confirmed.
- Result: PASS.

## Final Verification

- `node scripts/tests/test_0441_feishu_source_watch_contract.mjs`: PASS, `6 passed, 0 failed out of 6`.
- `node --check scripts/ops/feishu_source_watch.mjs`: PASS.
- `node --check scripts/tests/test_0441_feishu_source_watch_contract.mjs`: PASS.
- Fixture first run: PASS, report contains `Status: CHANGED`, `adopt_plan_update`, `requires_user_confirmation`, explicit `current SSOT conflict` reason, and bounded `Section Diff` blocks.
- Fixture second run: PASS, report contains `Status: NO_CHANGE`.
- Real Feishu raw-content fallback first run: PASS, four tracked docs read and baseline snapshots written under ignored `test_files/feishu_source_watch_real/state`.
- Real Feishu raw-content fallback second run: PASS, `Status: NO_CHANGE`.
- Real Feishu Markdown first run after permission change: PASS, `Status: BASELINE_CREATED`, four Markdown baselines created, no confirmation stops.
- Real Feishu Markdown second run: PASS, `Status: NO_CHANGE`.
- Focused two-document Markdown baseline: PASS, `Status: BASELINE_CREATED` then `Status: NO_CHANGE`.
- Focused two-document Markdown rerun after diff enhancement: PASS, `Status: NO_CHANGE`.
- Drive file-version API real probe before permission: PASS as a negative capability check, both focused docs returned missing-scope error for `drive:drive:version` / `drive:drive:version:readonly`.
- Drive file-version API real probe after permission: PASS, both focused docs returned `code: 0` with zero version items; this confirms the API is not the same as the web UI's continuous history diff.
- Current two-document Markdown baseline rerun: PASS, `Status: NO_CHANGE`, `Documents Checked: 2`, `Documents Changed: 0`.
- Current snapshot hash check: PASS, `feishu-model2` = `6f3b1803a9d54a05452e93a2ea9c041be424196a64a3931763b1ec571b9e129a`; `feishu-message-api` = `75f96f5f3b1bff23b5cd704a0e4f0fa4ed5fff01f66fbc19cc5e7424a9c5c57e`.
- Current implementation diff report: PASS, written to `docs/iterations/0441-feishu-source-watch/current-version-implementation-diff.md`.
- `git diff --check`: PASS.
- `node scripts/ops/validate_obsidian_docs_gate.mjs`: PASS.
- Trailing whitespace scan over changed docs/scripts/fixtures: PASS.
