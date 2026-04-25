---
title: "0337 — slide-flow-doc-realignment-implementation Resolution"
doc_type: iteration-resolution
status: approved
updated: 2026-04-26
source: ai
iteration_id: 0337-slide-flow-doc-realignment-implementation
id: 0337-slide-flow-doc-realignment-implementation
phase: phase3
---

# 0337 — slide-flow-doc-realignment-implementation Resolution

## Execution Strategy

Use a docs-only TDD loop. First add a deterministic doc contract test that fails on the current wording, then rewrite the docs until the test passes. Run a spawned sub-agent `codex-code-review` pass after the rewrite before final verification.

## Step 1 — Write The Doc Contract Test
- Scope:
  - Add a test for the four required sections, current formal ingress wording, local draft / overlay distinction, and forbidden obsolete current wording.
- Files:
  - `scripts/tests/test_0337_slide_flow_docs_contract.mjs`
- Verification:
  - `node scripts/tests/test_0337_slide_flow_docs_contract.mjs`
- Acceptance:
  - Test fails against the current docs for the known obsolete wording / missing required structure.
- Rollback:
  - Remove the test file.

## Step 2 — Rewrite Slide Process Docs
- Scope:
  - Rewrite the main overview into the four-part structure.
  - Patch any SSOT/user-guide wording that still presents direct target-cell patching as current formal ingress.
- Files:
  - `docs/user-guide/slide_delivery_and_runtime_overview_v1.md`
  - targeted related docs only if the test identifies a current-truth conflict.
- Verification:
  - `node scripts/tests/test_0337_slide_flow_docs_contract.mjs`
  - `rg -n "浏览器事件先直达目标 cell|server 直接把目标 pin 写到目标 cell" docs/user-guide docs/ssot`
- Acceptance:
  - Required current-truth phrases are present and obsolete current wording is removed or marked historical.
- Rollback:
  - Restore the previous doc text and remove the test.

## Step 3 — Final Docs Review
- Scope:
  - Run code review on the docs diff and fix any claim/code mismatch.
- Files:
  - docs and test files changed by Steps 1-2.
- Verification:
  - Review decision is `APPROVED`.
- Acceptance:
  - No unhandled finding remains.
- Rollback:
  - Revert the docs-only commit.
