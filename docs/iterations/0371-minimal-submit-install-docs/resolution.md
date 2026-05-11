---
id: 0371
title: minimal-submit-install-docs
doc_type: iteration_resolution
status: Completed
updated: 2026-05-11
source: ai
branch: dropx/0371-minimal-submit-install-docs
iteration_id: 0371-minimal-submit-install-docs
phase: phase3
---

# Iteration 0371 Minimal Submit Install Docs Resolution

## Execution Strategy

- Treat this as a docs/test-only follow-up to 0370. First inspect installer implementation and existing SSOT, then document the concrete generated labels and lock the explanation with tests.

## Step 1 - Installer Fact Check

- Scope: Verify actual UI Server install behavior.
- Files:
  - `packages/ui-model-demo-server/server.mjs`
  - `scripts/tests/test_0364_slide_import_bus_binding_contract.mjs`
  - `docs/ssot/imported_slide_app_host_ingress_semantics_v1.md`
- Verification: Compare generated label names and mount behavior with tests/SSOT.
- Acceptance: Docs changes are grounded in actual implementation names.
- Rollback: Revert this branch before merge.

## Step 2 - Docs And Tests

- Scope: Update public docs and deterministic checks.
- Files:
  - `docs/user-guide/slide-app-runtime/minimal_submit_app_provider_guide.md`
  - `docs/user-guide/slide-app-runtime/minimal_submit_app_provider_interactive.html`
  - `scripts/tests/test_0360_minimal_submit_dual_bus_docs_contract.mjs`
  - `docs/iterations/0371-minimal-submit-install-docs/*`
  - `docs/ITERATIONS.md`
- Verification:
  - `node scripts/tests/test_0360_minimal_submit_dual_bus_docs_contract.mjs`
  - `node scripts/tests/test_0361_minimal_submit_import_export_contract.mjs`
  - Playwright render check for the interactive HTML install panel
  - `git diff --check`
- Acceptance: Markdown and HTML both explain UI Server installation and generated labels.
- Rollback: Revert this branch before merge.

## Notes

- Generated at: 2026-05-11
