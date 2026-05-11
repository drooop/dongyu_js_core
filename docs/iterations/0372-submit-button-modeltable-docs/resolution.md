---
id: 0372
title: submit-button-modeltable-docs
doc_type: iteration_resolution
status: Completed
updated: 2026-05-11
source: ai
branch: dropx/0372-submit-button-modeltable-docs
iteration_id: 0372-submit-button-modeltable-docs
phase: phase3
---

# Iteration 0372 Submit Button ModelTable Docs Resolution

## Execution Strategy

- Treat this as a docs/test-only follow-up to 0370 and 0371. Reuse the reviewed minimal submit payload as truth, then make the submit-button recipe explicit in the public guide and interactive HTML.

## Step 1 - Docs Recipe

- Scope: Add a standalone submit-style button recipe to the Markdown guide and interactive HTML.
- Files:
  - `docs/user-guide/slide-app-runtime/minimal_submit_app_provider_guide.md`
  - `docs/user-guide/slide-app-runtime/minimal_submit_app_provider_interactive.html`
- Verification:
  - Browser render check for the interactive HTML submit-button panel.
  - Manual comparison with `test_files/minimal_submit_dual_bus_app_payload.json`.
- Acceptance: A developer can identify the button Cell labels, root labels, payload records, egress labels, and multi-button naming pattern without reading source code.
- Rollback: Revert this branch before merge.

## Step 2 - Contract Tests And Evidence

- Scope: Extend deterministic docs contract tests and record iteration evidence.
- Files:
  - `scripts/tests/test_0360_minimal_submit_dual_bus_docs_contract.mjs`
  - `docs/iterations/0372-submit-button-modeltable-docs/*`
  - `docs/ITERATIONS.md`
- Verification:
  - `node scripts/tests/test_0360_minimal_submit_dual_bus_docs_contract.mjs`
  - `node scripts/tests/test_0361_minimal_submit_import_export_contract.mjs`
  - `node scripts/tests/test_0353_slide_app_runtime_docs_publish_contract.mjs`
  - `git diff --check`
- Acceptance: Tests fail if submit-button label recipe is removed or materially weakened.
- Rollback: Revert this branch before merge.

## Notes

- Generated at: 2026-05-11
