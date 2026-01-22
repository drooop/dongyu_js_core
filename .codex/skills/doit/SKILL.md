---
name: doit
description: Strict, gated Iteration workflow for this repo. Use when asked to start/continue an iteration, enforce Phase separation + SSOT adherence, generate Phase1 docs (plan/resolution/runlog), and execute Phase3 only after explicit human approval.
---

# Doit

## Purpose

`$doit` is a strict, gated execution skill for structured Iteration-based work.

It enforces:
- Phase separation (Discovery/Intake → Planning → Review Gate → Execution → Completion)
- SSOT adherence
- Explicit human approval gates
- Auditable execution evidence

---

## Mandatory Reference Loading (Immutable Order)

Before any action, `$doit` MUST load and treat as immutable (in this exact order):

1. `AGENTS.md`
2. `docs/architecture_mantanet_and_workers.md` (SSOT)
3. `docs/WORKFLOW.md`
4. `docs/ITERATIONS.md`
5. `docs/_templates/iteration_plan.template.md`
6. `docs/_templates/iteration_resolution.template.md`
7. `docs/_templates/iteration_runlog.template.md`

Then (as needed):
8. `docs/iterations/<ITERATION_ID>/`
9. `scripts/` test entry points and `.env`/`.env_test` conventions (if present)

If any conflict exists between these documents, SSOT takes precedence.

---

## Auto-Creation Whitelist

Allowed to create only:
- `docs/iterations/<ITERATION_ID>/`
- `docs/iterations/README.md` (only if missing)

Never auto-create, replace, or “helpfully rewrite”:
- `AGENTS.md`
- `docs/architecture_mantanet_and_workers.md` (SSOT)
- `docs/WORKFLOW.md`
- `docs/ITERATIONS.md` (only make minimal row edits required by workflow)

---

## Phase 0 — Discovery (Read-Only)

Purpose:
- Understand repository-specific constraints and SSOT invariants.
- Identify reference implementations.
- Clarify scope boundaries.

Mandatory outputs (record later in Phase 1 `runlog.md` background notes):
- Relevant SSOT clauses for this iteration.
- Reference implementations (e.g. relevant paths under `PICtest/` or elsewhere).
- Explicit list of what is OUT OF SCOPE for this iteration.

Prohibitions:
- No code modifications.
- No doc modifications.
- No tests/builds.

---

## Phase 1 — Planning (Documents Only)

Mandatory outputs:
1. `docs/iterations/<ITERATION_ID>/plan.md`
2. `docs/iterations/<ITERATION_ID>/resolution.md` (empty placeholder unless asked to draft steps)
3. `docs/iterations/<ITERATION_ID>/runlog.md` (empty placeholder except Phase0 discovery notes)

Templates:
- Base `plan.md` on `docs/_templates/iteration_plan.template.md`
- Base `resolution.md` on `docs/_templates/iteration_resolution.template.md`
- Base `runlog.md` on `docs/_templates/iteration_runlog.template.md`

Registration requirement:
- Phase 1 MUST register the iteration in `docs/ITERATIONS.md` (per `docs/WORKFLOW.md`; set `Status = Planned`).

Mandatory sections in `plan.md` (additive to template; do not remove template sections):

### SSOT Alignment Checklist (REQUIRED)
- Explicit references to SSOT clauses
- How this Iteration preserves or extends them
- Any uncertainty + verification method

### Iteration Decomposition (Conditional)
If the overall task spans multiple subsystems (e.g. app-shell, worker-base, UI, bus, crypto):
- Propose follow-up Iterations (do not create them automatically)
- Each with: Proposed ID, goal, dependency, non-goals

Phase 1 prohibitions:
- Do not modify production code.
- Do not introduce dependencies.
- Do not execute external services.
- Do not alter SSOT / WORKFLOW policy text.
- Do not delete/rewrite existing iterations; do not restructure `docs/ITERATIONS.md` (only add/update the minimum row/fields for this iteration).

---

## Phase 2 — Review Gate (After Explicit Approval)

Phase 3 may begin ONLY after explicit human approval per `docs/WORKFLOW.md`.

Acceptable signals include:
- Human explicitly says **Approved**
- Human explicitly says “审核通过”
- Human explicitly says “审核通过，开始 Phase3”

If approval is ambiguous, stop and ask for a clear Phase 2 outcome: Approved / Change Requested / On Hold.

---

## Phase 3 — Execution (After Explicit Approval)

Execution rules:
- All changes must align with the approved plan.
- Deviations require stopping and documenting (and returning to Phase 1 if needed).
- Follow `docs/iterations/<id>/resolution.md` strictly.
- Each Step MUST have executable validation.
- All real execution evidence must go to `docs/iterations/<id>/runlog.md` (commands, outputs, commits, PASS/FAIL).

Mandatory validation extension (each Step):

### SSOT Violation Check (REQUIRED)
- Identify which SSOT invariants could be impacted
- Explicitly state whether any violation occurred
- If unclear, stop and document

---

## Phase 4 — Completion (Archive)

An Iteration is complete only when:
- All Phase 3 Steps PASS
- `runlog.md` documents all decisions and evidence
- No SSOT violations are recorded
- `docs/ITERATIONS.md` is updated to `Status = Completed` (and fill final branch/commit fields if present)

---

## Global Prohibitions

`$doit` MUST NEVER:
- Modify `docs/architecture_mantanet_and_workers.md`
- Modify `AGENTS.md`
- Modify `docs/WORKFLOW.md`
- Delete or rewrite existing Iterations
- Enter Phase 3 without approval

---

## Operational Notes

- If `logs/agent.log` is used, keep it under 10MB and keep it untracked/ignored.
- Prefer repo templates and naming conventions over ad-hoc formats.
