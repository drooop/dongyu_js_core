---
title: "0365 Prompt Guidance Rules Runlog"
doc_type: iteration_runlog
status: completed
updated: 2026-05-10
source: ai
iteration: 0365-prompt-guidance-rules
---

# Iteration 0365-prompt-guidance-rules Runlog

## Environment

- Date: 2026-05-10
- Branch: `dev_0365-prompt-guidance-rules`
- Runtime: docs-only, no app/runtime deployment required

Review Gate Record
- Iteration ID: 0365-prompt-guidance-rules
- Review Date: 2026-05-10
- Review Type: User direct execution request
- Review Index: 1/1
- Decision: Approved
- Notes: User explicitly narrowed the direction and requested the rules/user-guide update to be written to disk in this turn.

## Execution Records

### Step 1 — Register and freeze the plan

- Command: `git switch -c dev_0365-prompt-guidance-rules`
- Key output: switched to new branch `dev_0365-prompt-guidance-rules`
- Command: `python3 /Users/drop/.codex/skills/it/scripts/init_iteration_scaffold.py 0365-prompt-guidance-rules --repo-root /Users/drop/codebase/cowork/dongyuapp_elysia_based`
- Key output: wrote `plan.md`, `resolution.md`, and `runlog.md`
- Command: `rg -n "0365-prompt-guidance-rules|Prompt guidance|Decision: Approved" docs/ITERATIONS.md docs/iterations/0365-prompt-guidance-rules`
- Key output: iteration row exists in `docs/ITERATIONS.md`; official source input and Approved gate are recorded
- Result: PASS
- Commit: not created; user requested files to be written, not a git commit

### Step 2 — Update governance and collaboration rules

- Command: `rg -n "RULE_WRITING_METHOD|规约撰写方法|HTML artifact|decision rule|判断规则" CLAUDE.md AGENTS.md docs/ssot/execution_governance_ultrawork_doit.md`
- Key output: `CLAUDE.md` now has `RULE_WRITING_METHOD`; `AGENTS.md` has rule-classification guidance; execution governance has `规约撰写方法` and HTML artifact boundary
- Result: PASS
- Commit: not created; user requested files to be written, not a git commit

### Step 3 — Publish user guide and HTML guide

- Command: `rg -n "ai_prompt_and_artifact_guidance|HTML|visualized|OpenAI" docs/user-guide/README.md docs/user-guide/ai_prompt_and_artifact_guidance.md docs/user-guide/ai_prompt_and_artifact_guidance.html`
- Key output: README links both new guides; Markdown and HTML guides contain OpenAI source list and HTML boundary
- Command: `node --check docs/user-guide/ai_prompt_and_artifact_guidance.html`
- Key output: FAIL, `node --check` is not applicable to `.html`; verification switched to browser loading
- Command: `command -v npx >/dev/null 2>&1 && echo PASS npx available || echo FAIL npx missing`
- Key output: `PASS npx available`
- Command: `PWCLI=/Users/drop/.codex/skills/playwright/scripts/playwright_cli.sh; "$PWCLI" open "http://127.0.0.1:8765/docs/user-guide/ai_prompt_and_artifact_guidance.html" && "$PWCLI" snapshot && "$PWCLI" click e8 && "$PWCLI" snapshot && "$PWCLI" click e9 && "$PWCLI" snapshot && "$PWCLI" click e10 && "$PWCLI" snapshot`
- Key output: browser loaded the HTML guide; tabs `三类规则`, `HTML 边界`, and `官方依据` all displayed expected content; favicon 404 was fixed with an inline empty favicon
- Result: PASS
- Commit: not created; user requested files to be written, not a git commit

### Step 4 — Final consistency check

- Command: `git diff --check`
- Key output: no whitespace errors
- Command: `rg -n "Updated:|Official OpenAI|Decision: Approved|Result: PASS|OpenAI 官方|HTML 不作为默认" docs/iterations/0365-prompt-guidance-rules docs/user-guide/ai_prompt_and_artifact_guidance.md docs/ssot/execution_governance_ultrawork_doit.md`
- Key output: confirms updated date, official-source wording, Approved gate, PASS records, and HTML-not-default boundary
- Command: `git status --short --branch`
- Key output: branch is `dev_0365-prompt-guidance-rules`; changed files are documentation and iteration artifacts only
- Result: PASS
- Commit: not created; user requested files to be written, not a git commit

## Docs Updated

- [x] `docs/ssot/runtime_semantics_modeltable_driven.md` reviewed（no update required; no runtime semantics change）
- [x] `docs/user-guide/modeltable_user_guide.md` reviewed（no update required; this iteration adds a separate AI collaboration guide）
- [x] `docs/ssot/execution_governance_ultrawork_doit.md` reviewed and updated
