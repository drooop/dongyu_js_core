---
title: "Handoff Mode Protocol Implementation Plan"
doc_type: note
status: active
updated: 2026-03-21
source: ai
---

# Handoff Mode Protocol Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a reusable handoff-mode migration protocol with a system-level skill and repository-local default rules for `dongyuapp_elysia_based`.

**Architecture:** Keep migration behavior in instructions rather than runtime code. Put the reusable protocol in a global `handoff-mode` skill and make the repository opt into it by default through `AGENTS.md` plus a first-level docs policy file that future sessions will read during convention discovery.

**Tech Stack:** Markdown governance docs, Codex skill metadata, Node-based static contract test.

---

### Task 1: Create the iteration records and design artifacts

**Files:**
- Modify: `docs/ITERATIONS.md`
- Modify: `docs/iterations/0173-handoff-mode-protocol/plan.md`
- Modify: `docs/iterations/0173-handoff-mode-protocol/resolution.md`
- Modify: `docs/iterations/0173-handoff-mode-protocol/runlog.md`
- Create: `docs/plans/2026-03-07-handoff-mode-protocol-design.md`
- Create: `docs/plans/2026-03-07-handoff-mode-protocol-implementation.md`

**Step 1: Write the failing test**

Treat the failing condition as “0173 iteration artifacts or design docs do not exist or do not mention handoff-mode.”

**Step 2: Run test to verify it fails**

Run: `rg -n "0173-handoff-mode-protocol|handoff-mode" docs/ITERATIONS.md docs/iterations/0173-handoff-mode-protocol docs/plans/2026-03-07-handoff-mode-protocol-*.md`
Expected: FAIL or partial matches before content is filled in.

**Step 3: Write minimal implementation**

Fill the iteration docs and plan docs with the approved design, scope, validation, and rollback details.

**Step 4: Run test to verify it passes**

Run: `rg -n "0173-handoff-mode-protocol|handoff-mode" docs/ITERATIONS.md docs/iterations/0173-handoff-mode-protocol docs/plans/2026-03-07-handoff-mode-protocol-*.md`
Expected: PASS with matches in all planned files.

**Step 5: Commit**

```bash
git add docs/ITERATIONS.md docs/iterations/0173-handoff-mode-protocol docs/plans/2026-03-07-handoff-mode-protocol-*.md
git commit -m "docs: add 0173 handoff-mode iteration plan"
```

### Task 2: Add repository-local default handoff-mode rules

**Files:**
- Modify: `AGENTS.md`
- Create: `docs/CODEX_HANDOFF_MODE.md`
- Test: `scripts/tests/test_0173_handoff_mode_contract.mjs`

**Step 1: Write the failing test**

Create a test that asserts:
- `AGENTS.md` points to `docs/CODEX_HANDOFF_MODE.md`
- `docs/CODEX_HANDOFF_MODE.md` contains `/handoff-mode`
- the doc contains `升级后继续`, `降级后继续`, `compact_handoff`, and `effort_suggestion`

**Step 2: Run test to verify it fails**

Run: `node scripts/tests/test_0173_handoff_mode_contract.mjs`
Expected: FAIL because the repo-local protocol docs do not exist yet.

**Step 3: Write minimal implementation**

Update `AGENTS.md` and add `docs/CODEX_HANDOFF_MODE.md` with the default-enabled migration contract.

**Step 4: Run test to verify it passes**

Run: `node scripts/tests/test_0173_handoff_mode_contract.mjs`
Expected: PASS.

**Step 5: Commit**

```bash
git add AGENTS.md docs/CODEX_HANDOFF_MODE.md scripts/tests/test_0173_handoff_mode_contract.mjs
git commit -m "docs: add repo-local handoff-mode protocol"
```

### Task 3: Create the system-level handoff-mode skill

**Files:**
- Create: `/Users/drop/.codex/skills/handoff-mode/SKILL.md`
- Create: `/Users/drop/.codex/skills/handoff-mode/agents/openai.yaml`
- Create: `/Users/drop/.codex/skills/handoff-mode/references/templates.md`

**Step 1: Write the failing test**

Treat the failing condition as “the global skill files do not exist or do not contain the required trigger phrases and templates.”

**Step 2: Run test to verify it fails**

Run: `test -f /Users/drop/.codex/skills/handoff-mode/SKILL.md && test -f /Users/drop/.codex/skills/handoff-mode/agents/openai.yaml && test -f /Users/drop/.codex/skills/handoff-mode/references/templates.md`
Expected: FAIL before files are created.

**Step 3: Write minimal implementation**

Create the skill with:
- trigger description for `/handoff-mode`, `compact_handoff`, upgrade/downgrade migration
- toggle rules
- migration packet contract
- reference templates

**Step 4: Run test to verify it passes**

Run: `test -f /Users/drop/.codex/skills/handoff-mode/SKILL.md && test -f /Users/drop/.codex/skills/handoff-mode/agents/openai.yaml && test -f /Users/drop/.codex/skills/handoff-mode/references/templates.md`
Expected: PASS.

**Step 5: Commit**

```bash
git add /Users/drop/.codex/skills/handoff-mode
git commit -m "feat: add handoff-mode skill"
```

### Task 4: Verify and record execution facts

**Files:**
- Modify: `docs/iterations/0173-handoff-mode-protocol/runlog.md`

**Step 1: Write the failing test**

Treat the failing condition as “runlog lacks commands, outputs, and final PASS facts.”

**Step 2: Run test to verify it fails**

Run: `rg -n "PASS|handoff-mode|test_0173_handoff_mode_contract" docs/iterations/0173-handoff-mode-protocol/runlog.md`
Expected: FAIL or partial matches before facts are recorded.

**Step 3: Write minimal implementation**

Append factual command/output summaries to the runlog and mark the docs review checklist.

**Step 4: Run test to verify it passes**

Run: `rg -n "PASS|handoff-mode|test_0173_handoff_mode_contract" docs/iterations/0173-handoff-mode-protocol/runlog.md`
Expected: PASS.

**Step 5: Commit**

```bash
git add docs/iterations/0173-handoff-mode-protocol/runlog.md
git commit -m "docs: record handoff-mode verification"
```
