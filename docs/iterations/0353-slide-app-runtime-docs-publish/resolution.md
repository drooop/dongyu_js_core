---
title: "0353 Slide App Runtime Docs Publish Resolution"
doc_type: iteration_resolution
status: completed
updated: 2026-04-30
source: codex
---

# 0353 Slide App Runtime Docs Publish Resolution

## Outcome

Completed.

The `minimal_submit_app_provider` Markdown and interactive HTML docs are now published through the ui-server persisted docs/static roots and are directly reachable on `https://app.dongyudigital.com`.

## Published Entrypoints

- Static interactive HTML: `https://app.dongyudigital.com/p/slide-app-runtime-minimal-submit-provider/`
- Markdown Docs UI: `https://app.dongyudigital.com/#/docs`, search `minimal_submit_app_provider`
- Workspace UI model entry: `https://app.dongyudigital.com/#/workspace`, open `Minimal Submit App Provider Docs`

## Scope

- Added deterministic docs/static sync script for slide app runtime provider docs.
- Wired public-doc sync into local and cloud deploy flows.
- Added Model 1039 as a `cellwise.ui.v1` Workspace entry that links the Docs UI and Static HTML page.
- Mounted Model 1039 through `runtime_hierarchy_mounts.json` at `Model 0 / p2,r0,c19`.
- Kept the Markdown docs served by the existing Docs UI model and the HTML served by the existing Static mount path.

## Correction During Verification

Remote browser verification found that `Model 1039` appeared in the Workspace registry but opened as `Model 1039 is not mounted into Workspace`.

Cause: remote persisted `Model 1038` already occupied `Model 0 / p2,r0,c18`.

Fix: moved the 1039 Workspace mount into canonical hierarchy mounts at `p2,r0,c19`, and tightened the 0353 contract test so the docs UI patch does not own hierarchy mounts.

## Verification

PASS:

- `node scripts/tests/test_0353_slide_app_runtime_docs_publish_contract.mjs`
- `node scripts/tests/test_0351_slide_app_minimal_provider_guide_contract.mjs`
- `node scripts/tests/test_0352_slide_app_provider_visualized_docs_contract.mjs`
- `node scripts/validate_ui_ast_v0x.mjs --case all`
- `npm -C packages/ui-model-demo-frontend run build`
- `git diff --check`
- Remote deploy of `cfbdc4c` to ui-server with rollout and source hash gate passing.
- Playwright browser flow against `https://app.dongyudigital.com` covering Static HTML submit, Docs search, and Workspace UI model open.

## Commits

- `292fe55 feat(docs): publish slide app provider docs [0353]`
- `0ec67a5 fix(docs): avoid provider docs model id collision [0353]`
- `cfbdc4c fix(docs): mount provider docs in workspace [0353]`
