---
title: "0365 Prompt Guidance Rules Resolution"
doc_type: iteration_resolution
status: approved
updated: 2026-05-10
source: ai
iteration: 0365-prompt-guidance-rules
---

# Iteration 0365-prompt-guidance-rules Resolution

## Execution Strategy

- Treat this as a docs-only governance update.
- First encode the revised method in the highest-priority collaboration surface, then mirror it into repo-local guidance and execution governance.
- Publish a user-facing Markdown guide plus an explicit HTML guide for visualized consumption.
- Verify by source-grep checks, repository status checks, and browser loading of the HTML guide.

## Step 1 — Register and freeze the plan

- Scope: Create the iteration record, register it, and record the user-directed Approved gate for docs-only execution.
- Files:
  - `docs/ITERATIONS.md`
  - `docs/iterations/0365-prompt-guidance-rules/plan.md`
  - `docs/iterations/0365-prompt-guidance-rules/resolution.md`
  - `docs/iterations/0365-prompt-guidance-rules/runlog.md`
- Verification: `rg -n "0365-prompt-guidance-rules|Prompt guidance" docs/ITERATIONS.md docs/iterations/0365-prompt-guidance-rules`
- Acceptance: Iteration is registered, plan/resolution define scope and success criteria, runlog records the gate.
- Rollback: Remove the row and the iteration directory.

## Step 2 — Update governance and collaboration rules

- Scope: Add source-backed rule-writing policy and HTML artifact boundary without weakening existing hard rules.
- Files:
  - `CLAUDE.md`
  - `AGENTS.md`
  - `docs/ssot/execution_governance_ultrawork_doit.md`
- Verification: `rg -n "RULE_WRITING_METHOD|规约撰写方法|HTML artifact|decision rule|判断规则" CLAUDE.md AGENTS.md docs/ssot/execution_governance_ultrawork_doit.md`
- Acceptance: Rules distinguish invariants, decision rules, preferences, and artifact boundaries.
- Rollback: Revert the three documentation edits.

## Step 3 — Publish user guide and HTML guide

- Scope: Add a user-facing guide and explicit HTML version for this iteration's requested output, then update the guide index.
- Files:
  - `docs/user-guide/ai_prompt_and_artifact_guidance.md`
  - `docs/user-guide/ai_prompt_and_artifact_guidance.html`
  - `docs/user-guide/README.md`
- Verification:
  - `rg -n "ai_prompt_and_artifact_guidance|HTML|visualized|OpenAI" docs/user-guide/README.md docs/user-guide/ai_prompt_and_artifact_guidance.md docs/user-guide/ai_prompt_and_artifact_guidance.html`
  - Browser-load the HTML guide and verify key text is visible.
- Acceptance: Markdown and HTML versions exist, state HTML is not default, and include official-source rationale.
- Rollback: Remove the new guide files and README entry.

## Step 4 — Final consistency check

- Scope: Confirm no runtime files changed and the docs contain the expected source-backed guidance.
- Files:
  - `docs/iterations/0365-prompt-guidance-rules/runlog.md`
  - `docs/ITERATIONS.md`
- Verification:
  - `git diff --name-only`
  - `rg -n "Updated:|Official OpenAI|Decision: Approved|Result: PASS" docs/iterations/0365-prompt-guidance-rules docs/user-guide/ai_prompt_and_artifact_guidance.md`
- Acceptance: Only documentation files changed, runlog records PASS evidence, iteration index is updated.
- Rollback: Revert the iteration changes.

## Notes

- Generated at: 2026-05-10
