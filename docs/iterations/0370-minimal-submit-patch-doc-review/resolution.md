---
id: 0370
title: minimal-submit-patch-doc-review
doc_type: iteration_resolution
status: Completed
updated: 2026-05-11
source: ai
branch: dropx/0370-minimal-submit-patch-doc-review
iteration_id: 0370-minimal-submit-patch-doc-review
phase: phase3
---

# Iteration 0370 Minimal Submit Patch Doc Review Resolution

## Execution Strategy

- Treat this as a bounded docs/test iteration. First verify the existing patch and zip against current contracts, then improve the developer docs without changing runtime behavior.

## Step 1 - Patch And Zip Review

- Scope: Check the saved JSON patch, zip payload, and matching remote-worker provider model.
- Files:
  - `test_files/minimal_submit_dual_bus_app_payload.json`
  - `test_files/minimal_submit_dual_bus.zip`
  - `deploy/sys-v1ns/remote-worker/patches/13_model3000_minimal_submit.json`
- Verification:
  - `node scripts/tests/test_0360_minimal_submit_dual_bus_docs_contract.mjs`
  - `node scripts/tests/test_0361_minimal_submit_import_export_contract.mjs`
- Acceptance: Patch is a temporary ModelTable record array, zip imports/exports, and provider model still uses `submit1` with `reply_to`.
- Rollback: Revert this branch before merge.

## Step 2 - Docs And Contract Test

- Scope: Expand docs and tests to explain every label and Submit chain.
- Files:
  - `docs/user-guide/slide-app-runtime/minimal_submit_app_provider_guide.md`
  - `docs/user-guide/slide-app-runtime/minimal_submit_app_provider_interactive.html`
  - `scripts/tests/test_0360_minimal_submit_dual_bus_docs_contract.mjs`
  - `docs/iterations/0370-minimal-submit-patch-doc-review/*`
  - `docs/ITERATIONS.md`
- Verification:
  - `node scripts/tests/test_0360_minimal_submit_dual_bus_docs_contract.mjs`
  - `node scripts/tests/test_0361_minimal_submit_import_export_contract.mjs`
  - HTML render check with Playwright.
  - `git diff --check`
- Acceptance: Docs include the full patch label table and explicit Submit-to-dual-bus chain.
- Rollback: Revert this branch before merge.

## Notes

- Generated at: 2026-05-11
