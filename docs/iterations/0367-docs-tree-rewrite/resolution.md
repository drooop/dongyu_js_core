---
title: "Iteration 0367 Docs Tree Rewrite Resolution"
doc_type: iteration_resolution
status: completed
updated: 2026-05-10
owner: codex
source: ai
---

# Iteration 0367-docs-tree-rewrite Resolution

## Execution Strategy

采用“先分层，后重写，再验证”的方式推进。先用 docs tree inventory 固定文件分组和处置策略，再用 file treatment manifest 固定逐文件处置，再让 sub-agent 做计划审查；只有审查通过后，才开始改写正文。

正文重写按风险从高到低推进：先入口和权威规约，再 user-guide，再运行/部署/roadmap/supporting docs，最后做冲突扫描和收口记录。

## Step 1: Register, Inventory, Plan Review

- Scope:
  - 登记 0367 iteration。
  - 盘点 `docs/` 全树 bucket、active docs、user-guide、historical/evidence docs。
  - 建立逐文件处置 manifest；除 `docs/iterations/**` 历史正文外，每个 docs 文件都必须有计划处置。
  - 写出计划、执行策略和 runlog。
  - 用 sub-agent review 计划，直到 `APPROVED`。
- Files:
  - `docs/ITERATIONS.md`
  - `docs/iterations/0367-docs-tree-rewrite/plan.md`
  - `docs/iterations/0367-docs-tree-rewrite/resolution.md`
  - `docs/iterations/0367-docs-tree-rewrite/runlog.md`
  - `docs/iterations/0367-docs-tree-rewrite/assets/docs_tree_inventory.md`
  - `docs/iterations/0367-docs-tree-rewrite/assets/file_treatment_manifest.md`
- Verification:
  - `git diff --check`
    - PASS: no output.
  - manifest coverage command:
    ```bash
    comm -23 <(find docs -path 'docs/iterations' -prune -o -type f \( -name '*.md' -o -name '*.html' -o -name '*.txt' \) -print | sort) <(rg -o '\`docs/[^`]+\`' docs/iterations/0367-docs-tree-rewrite/assets/file_treatment_manifest.md | tr -d '\`' | sort -u)
    ```
    - PASS: no output.
  - `! rg -n 'ai-work-conventions.*(current|active|当前规约)|(?:current|active|当前规约).*ai-work-conventions' docs/README.md docs/WORKFLOW.md docs/ssot docs/charters`
    - PASS: no output.
  - sub-agent review record in runlog.
    - PASS: decision is `APPROVED`.
- Acceptance:
  - Review decision is `APPROVED`.
  - No implementation rewrite starts before approval.
- Rollback:
  - Revert iteration scaffold and index row if planning is cancelled before implementation.

## Step 2: Rewrite Current Entrypoints and Normative Docs

- Scope:
  - Rewrite active entrypoints and current policy docs using 0365 rule-writing method.
  - Clarify authority, scope, conflict resolution, current vs target vs historical status.
  - Treat `docs/ai-work-conventions.md` only as deprecated historical reference: preserve or annotate, not current policy rewrite.
- Files:
  - `docs/README.md`
  - `docs/WORKFLOW.md`
  - `docs/architecture_mantanet_and_workers.md`
  - `docs/charters/dongyu_app_next_runtime.md`
  - `docs/ssot/*.md`
  - `docs/ai-work-conventions.md` only if adding or preserving deprecated boundary text.
- Verification:
  - `git -c core.quotePath=false diff --name-only -- docs | awk 'index($0,"docs/iterations/") == 1 && $0 !~ /^docs\/iterations\/0367-docs-tree-rewrite\// && $0 != "docs/ITERATIONS.md" { bad=1; print } END { exit bad }'`
    - PASS: no output and exit 0.
  - `! rg -n 'docs/iterations/.*current policy|docs/iterations/.*当前规约|历史证据.*覆盖|history.*override' docs/README.md docs/WORKFLOW.md docs/ssot docs/charters`
    - PASS: no output.
  - `rg -n 'MUST|ALWAYS|NEVER|必须|永远|绝对|只能' docs/README.md docs/WORKFLOW.md docs/ssot docs/charters`
    - PASS: every remaining hit is reviewed as hard constraint or rewritten as decision/preference rule.
- Acceptance:
  - Current docs no longer rely on vague absolute wording where a decision rule is needed.
  - Conflicts resolve toward `CLAUDE.md` and `docs/ssot/**`.
- Rollback:
  - Revert only this step's docs if a broad conflict is found.

## Step 3: Rewrite User Guide Layer

- Scope:
  - Rebuild `docs/user-guide/README.md` as the user-facing entrypoint.
  - Mark current guides, archived prompts, visualized HTML, interactive HTML and example materials distinctly.
  - Rewrite active guide summaries so users know what is current and what must be verified locally.
- Files:
  - `docs/user-guide/README.md`
  - `docs/user-guide/*.md`
  - `docs/user-guide/slide-app-runtime/*.md`
  - Existing `docs/user-guide/**/*.html` only when they are visualized/interactive and still linked.
- Verification:
  - `find docs/user-guide -type f \( -name '*.md' -o -name '*.html' -o -name '*.txt' \) | sort`
    - PASS: every listed file is classified in `docs/user-guide/README.md` or in the manifest.
  - `git -c core.quotePath=false diff --name-only -- docs/user-guide | sort`
    - PASS: every changed guide has a current/archive/visualized/interactive/example role.
  - `git -c core.quotePath=false diff --name-only -- '*.html'`
    - PASS: either no output, or each listed HTML page is loaded through a local static server and checked in browser.
- Acceptance:
  - No user-guide page claims historical prompt files or old examples are current operating rules.
  - HTML remains opt-in and purpose-bound.
- Rollback:
  - Revert user-guide edits independently; keep plan/inventory if useful.

## Step 4: Rewrite Operational, Roadmap, Plan, Handover Index Layer

- Scope:
  - Add status and usage boundaries to non-normative docs that are still discoverable.
  - Preserve evidence while preventing it from overriding current docs.
- Files:
  - `docs/deployment/*.md`
  - `docs/roadmaps/*.md`
  - `docs/plans/*.md`
  - `docs/handover/*.md`
  - `docs/prompts/*.md`
  - `docs/tests/*.md`
  - `docs/tmp/*.md`
  - `docs/architecture-review-2026-04/*.md`
- Verification:
  - `rg -n 'current policy|当前规约|SSOT|唯一权威|authoritative|必须|永远|绝对' docs/plans docs/roadmaps docs/handover docs/prompts docs/tests docs/tmp docs/architecture-review-2026-04`
    - PASS: every remaining hit has local status boundary or is recorded in deferred list.
  - `find docs/plans docs/roadmaps docs/handover docs/prompts docs/tests docs/tmp docs/architecture-review-2026-04 -type f \( -name '*.md' -o -name '*.txt' \) | sort`
    - PASS: every file appears in manifest with preserve/annotate/defer.
- Acceptance:
  - Readers can tell whether a file is current guidance, historical plan, evidence, or archive.
- Rollback:
  - Revert this layer if it proves too noisy; keep active docs/user-guide changes.

## Step 5: Consistency Audit and Deferred List

- Scope:
  - Review contradictions and ambiguous terms found during rewrite.
  - Fix safe items; defer unsafe items with evidence and suggested next validation.
- Files:
  - `docs/iterations/0367-docs-tree-rewrite/assets/contradictions_and_deferred.md`
  - Files touched in prior steps as needed.
- Verification:
  - `git diff --check`
    - PASS: no output.
  - `git -c core.quotePath=false diff --name-only | awk '$0 !~ /^(docs\/|AGENTS\.md$|CLAUDE\.md$)/ { bad=1; print } END { exit bad }'`
    - PASS: no non-doc/non-governance changes. For this iteration the expected result is docs-only.
  - `rg -n 'Superseded|deprecated|legacy|历史|目标态|target-only|TODO|TBD|FIXME|PENDING' docs/README.md docs/WORKFLOW.md docs/ssot docs/charters docs/user-guide docs/deployment docs/roadmaps docs/plans docs/handover docs/prompts docs/tests docs/tmp docs/architecture-review-2026-04`
    - PASS: every hit is either intentionally labeled, fixed, or recorded in `contradictions_and_deferred.md`.
- Acceptance:
  - No known unresolved contradiction remains silently hidden in active docs.
- Rollback:
  - Revert only unsafe fixes and leave them in deferred list.

## Step 6: Final Review and Commit

- Scope:
  - Run final verification, update runlog, update frontmatter/status, update `docs/ITERATIONS.md`, stage and commit one docs-only change.
- Files:
  - All changed docs.
- Verification:
  - Final checks listed in plan success criteria.
  - Status flow:
    - after review approval: `docs/ITERATIONS.md` row becomes `Approved` or `In Progress`; 0367 plan/resolution/runlog status becomes `approved` or `in_progress`.
    - before commit: `docs/ITERATIONS.md` row becomes `Completed`; 0367 plan/resolution/runlog status becomes `completed`.
- Acceptance:
  - Working tree contains only intended docs-only changes.
  - Commit message follows repo convention.
- Rollback:
  - `git revert` final commit if accepted changes need to be backed out.

## Notes

- Generated at: 2026-05-10
