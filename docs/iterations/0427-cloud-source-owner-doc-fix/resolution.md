---
title: "Iteration 0427 Cloud Source Owner Doc Fix Resolution"
doc_type: iteration-resolution
status: completed
updated: 2026-06-24
source: ai
iteration_id: 0427-cloud-source-owner-doc-fix
id: 0427-cloud-source-owner-doc-fix
phase: completed
---

# Iteration 0427-cloud-source-owner-doc-fix Resolution

## Execution Strategy

Make a narrow documentation-only correction. Prefer changing active runbooks
and address records; do not edit runtime scripts or remote server ownership.

## Step 1 - Locate Active Owner References

- Scope: Search current deployment docs and user-facing runbooks for
  `--remote-repo-owner wwpic`, `sudo -u wwpic`, and related owner wording.
- Files: no edits.
- Verification: `rg -n "remote-repo-owner|sudo -u wwpic|/home/wwpic/dongyuapp" ...`.
- Acceptance: active docs needing correction are identified; historical plans
  are excluded unless they are current runbooks.
- Rollback: no-op.

## Step 2 - Patch Docs And Verify

- Scope: Replace active docs with the current `drop` owner command and add
  owner validation notes.
- Files:
  - `scripts/ops/README.md`
  - `docs/deployment/cloud_public_docs_fast_deploy.md`
  - `docs/user-guide/slide_ui_evidence_runbook.md`
  - `docs/user-guide/project_address_record.md`
  - `docs/ITERATIONS.md`
  - `docs/iterations/0427-cloud-source-owner-doc-fix/*`
- Verification:
  - `rg -n "--remote-repo-owner wwpic|sudo -u wwpic" scripts/ops/README.md docs/deployment/cloud_public_docs_fast_deploy.md docs/user-guide/slide_ui_evidence_runbook.md docs/user-guide/project_address_record.md`
  - `git diff --check`
  - `node scripts/ops/obsidian_docs_audit.mjs --root docs`
- Acceptance: active docs no longer instruct the stale owner and checks pass.
- Rollback: revert the docs-only commit.

## Notes

- Generated at: 2026-06-24
