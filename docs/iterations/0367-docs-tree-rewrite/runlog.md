---
title: "Iteration 0367 Docs Tree Rewrite Runlog"
doc_type: iteration_runlog
status: completed
updated: 2026-05-10
owner: codex
source: ai
---

# Iteration 0367-docs-tree-rewrite Runlog

## Environment

- Date: 2026-05-10
- Branch: `dev_0367-docs-tree-rewrite`
- Runtime: local docs-only workflow; no runtime/deploy changes intended.

## Execution Records

### Step 1: Registration and Inventory

- Command: `git switch -c dev_0367-docs-tree-rewrite`
- Key output: branch created from `dev_0366-spec-tree-rewrite`.
- Result: PASS
- Commit: pending

- Command: `python3 /Users/drop/.codex/skills/it/scripts/init_iteration_scaffold.py 0367-docs-tree-rewrite --repo-root /Users/drop/codebase/cowork/dongyuapp_elysia_based`
- Key output: iteration scaffold created.
- Result: PASS
- Commit: pending

- Command: `find docs -type f \( -name '*.md' -o -name '*.html' -o -name '*.txt' \) ...`
- Key output: `docs/` bucket counts captured in `assets/docs_tree_inventory.md`.
- Result: PASS
- Commit: pending

### Plan Review Gate 1

- Reviewer: sub-agent `019e118e-115e-76f0-84b5-1c289909a1c0`
- Decision: CHANGE_REQUESTED
- Required changes:
  - Add real directory-level bucket coverage for `docs/plans`, `docs/_templates`, `docs/architecture-review-2026-04`, root-level docs, and `docs/user-guide/slide-app-runtime`.
  - Add per-file treatment manifest before implementation.
  - Convert verification items to executable commands and PASS/FAIL criteria.
  - Treat `docs/ai-work-conventions.md` as deprecated historical reference, not current policy.
  - Add status flow for `docs/ITERATIONS.md` and iteration frontmatter.
- Implementation allowed: No.

### Step 1 Revision After Review

- Command: `find docs -type f \( -name '*.md' -o -name '*.html' -o -name '*.txt' \) ...`
- Key output: real bucket counts include `docs/plans` (40), `docs/_templates` (3), `docs/architecture-review-2026-04` (1), `docs/user-guide` (49), and `docs/iterations` (782).
- Result: PASS
- Commit: pending

### Plan Review Gate 2

- Reviewer: sub-agent `019e118e-115e-76f0-84b5-1c289909a1c0`
- Decision: APPROVED
- Required changes: none.
- Implementation allowed: Yes.
- Residual risk:
  - Preserve `docs/iterations/**` historical bodies.
  - Review remaining hard-rule wording instead of blanket replacing it.
  - Modify HTML only when visualized/interactive companions need sync, then inspect locally.

### Step 2: Current Entrypoints And Normative Docs

- Command: edited current entrypoint/governance docs and SSOT boundaries.
- Key output:
  - `docs/README.md` rewritten as docs tree map with authority tiers.
  - `docs/ssot/execution_governance_ultrawork_doit.md` rewritten around rule classes, review roles, gates, artifact boundaries.
  - `docs/ssot/fill_table_only_mode.md`, `docs/ssot/orchestrator_hard_rules.md`, and `docs/charters/dongyu_app_next_runtime.md` now state authority / scope / conflict behavior.
  - `docs/architecture_mantanet_and_workers.md` unclear phrase `目标作者ing口径` replaced.
- Result: PASS
- Commit: pending

### Step 3: User Guide Layer

- Command: rewrote user-guide indexes and classified every user-guide file.
- Key output:
  - `docs/user-guide/README.md` now separates current guides, UI/workspace, slide app, runbooks, visualized/interactive HTML, superseded preview, prompt archive, and diary/archive.
  - `docs/user-guide/slide-app-runtime/README.md` now states authority, current boundary, HTML companion status, and verification rule.
- Result: PASS
- Commit: pending

### Step 4: Operational, Roadmap, Handover, Prompt, Test, Tmp Layer

- Command: added or updated status boundaries in deployment, roadmap, handover, prompt, test, tmp, concept, review, and legacy root docs.
- Key output:
  - roadmap files now use `status: target`.
  - handover/prompt/tmp/test/concept/review files no longer present as active policy.
  - `docs/prompts/Modelfile` annotated as prompt archive.
- Result: PASS
- Commit: pending

### Step 5: Consistency Audit

- Command: `git diff --check`
- Key output: no output.
- Result: PASS
- Commit: pending

- Command: manifest coverage command from the approved resolution.
- Key output: no output.
- Result: PASS
- Commit: pending

- Command: `git -c core.quotePath=false diff --name-only -- docs | awk 'index($0,"docs/iterations/") == 1 && $0 !~ /^docs\/iterations\/0367-docs-tree-rewrite\// && $0 != "docs/ITERATIONS.md" { bad=1; print } END { exit bad }'`
- Key output: no output.
- Result: PASS
- Commit: pending

- Command: user-guide coverage command from the approved resolution.
- Key output: no output.
- Result: PASS
- Commit: pending

- Command: `git -c core.quotePath=false diff --name-only -- '*.html'`
- Key output: no output; no HTML changed.
- Result: PASS
- Commit: pending

- Command: `! rg -n "目标作者ing|OpenCode|@oracle|@momus|Claude Code CLI|codex exec|danger-full-access" ...`
- Key output: no output.
- Result: PASS
- Commit: pending

### Final Review Gate

- Reviewer: sub-agent `019e118e-115e-76f0-84b5-1c289909a1c0`
- Decision: APPROVED
- Required changes: none.
- Residual risk:
  - Ensure all 0367 untracked assets are staged.
  - Include `docs/prompts/Modelfile` in final scope review because it is a tracked non-Markdown docs file.
- Result: PASS
- Commit: pending

### Final Verification

- Command: `git diff --check`
- Key output: no output.
- Result: PASS
- Commit: pending

- Command: manifest coverage command from the approved resolution.
- Key output: no output.
- Result: PASS
- Commit: pending

- Command: user-guide coverage command from the approved resolution.
- Key output: no output.
- Result: PASS
- Commit: pending

- Command: `git -c core.quotePath=false status --short | awk '{ path=$2; if (path !~ /^(docs\/|AGENTS\.md$|CLAUDE\.md$)/) { bad=1; print } } END { exit bad }'`
- Key output: no output.
- Result: PASS
- Commit: pending

- Command: `git -c core.quotePath=false diff --name-only -- '*.html'`
- Key output: no output; no HTML changed.
- Result: PASS
- Commit: pending

- Command: `! rg -n "目标作者ing|OpenCode|@oracle|@momus|Claude Code CLI|codex exec|danger-full-access" ...`
- Key output: no output.
- Result: PASS
- Commit: pending

## Docs Updated

- [x] `docs/iterations/0367-docs-tree-rewrite/plan.md` drafted
- [x] `docs/iterations/0367-docs-tree-rewrite/resolution.md` drafted
- [x] `docs/iterations/0367-docs-tree-rewrite/runlog.md` drafted
- [x] `docs/iterations/0367-docs-tree-rewrite/assets/docs_tree_inventory.md` drafted
- [x] `docs/iterations/0367-docs-tree-rewrite/assets/file_treatment_manifest.md` drafted
- [x] Plan reviewed by sub-agent
- [x] Active docs rewritten
- [x] `docs/user-guide/` rewritten
- [x] Final review completed
- [x] Final verification completed
