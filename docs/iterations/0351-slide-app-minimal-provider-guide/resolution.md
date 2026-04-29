---
title: "Iteration 0351 Resolution - Slide App Minimal Provider Guide"
doc_type: iteration-resolution
status: active
updated: 2026-04-29
source: ai
---

# Iteration 0351-slide-app-minimal-provider-guide Resolution

## Execution Strategy

- Keep this as a docs-only iteration with one executable contract test.
- Reuse the current slide import fixture patterns instead of inventing a new
  packaging format.
- Make the provider guide narrow: what to fill, what each filled cell means, and
  what submit program receives/writes.

## Step 1

- Scope: Document the minimal provider app.
- Files:
- `docs/user-guide/slide-app-runtime/minimal_submit_app_provider_guide.md`
- `docs/user-guide/slide-app-runtime/README.md`
- `docs/user-guide/README.md`
- Verification:
- Static review against `CLAUDE.md` and current user-guide wording.
- Acceptance:
- The doc includes provider mental model, full cells, full payload, full handler,
  packaging note, and expected runtime result.
- Rollback:
- Remove the new guide and index links.

## Step 2

- Scope: Add deterministic contract verification.
- Files:
- `scripts/tests/test_0351_slide_app_minimal_provider_guide_contract.mjs`
- Verification:
- `node scripts/tests/test_0351_slide_app_minimal_provider_guide_contract.mjs`
- Acceptance:
- Test parses the guide payload, imports it through the current server runtime,
  triggers `submit_request`, and observes the display label update.
- Rollback:
- Remove the test file and references from runlog.

## Step 3

- Scope: Close iteration evidence.
- Files:
- `docs/ITERATIONS.md`
- `docs/iterations/0351-slide-app-minimal-provider-guide/runlog.md`
- Verification:
- Targeted tests, docs gate, and `git diff --check`.
- Acceptance:
- Iteration status is `Completed` only after verification is recorded.
- Rollback:
- Restore iteration status and remove iteration directory if abandoned.

## Notes

- Generated at: 2026-04-29
