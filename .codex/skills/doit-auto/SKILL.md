---
name: doit-auto
description: Iteration orchestrator for months-long, multi-domain objectives. Decomposes a large goal into a linear roadmap of Iterations, prepares Phase1 (docs-only) for the next Iteration via $doit, and enforces SSOT + explicit human approval gates. Never implements features or edits production code.
---

# Doit Auto

## Purpose

`$doit-auto` is an iteration orchestrator.

It does NOT implement features.
It does NOT modify code.
It does NOT bypass `$doit`.

Its only responsibility is to:
- Decompose a large, multi-domain objective into a linear sequence of Iterations
- Prepare Phase 1 (documents-only) for the *next* Iteration via `$doit`
- Enforce strict SSOT adherence across long-running, multi-iteration work
- Advance iteration-by-iteration only with explicit human approval

This skill exists to support months-long structured execution, not one-off tasks.

---

## Mandatory Reference Loading (Hard Requirement)

Before doing anything, `$doit-auto` MUST load and respect (in this exact order):
1. `AGENTS.md`
2. `docs/architecture_mantanet_and_workers.md` (SSOT, immutable)
3. `docs/WORKFLOW.md`
4. `docs/ITERATIONS.md`
5. `docs/_templates/iteration_plan.template.md`
6. `docs/_templates/iteration_resolution.template.md`
7. `docs/_templates/iteration_runlog.template.md`

If any of the above are missing or ambiguous, `$doit-auto` MUST stop and ask the user.

---

## Operating Model

### Phase A — Roadmap Construction (Documents Only)

When invoked with a large objective, `$doit-auto` MUST:

1. Treat the user’s objective as a single system-level goal.
2. Decompose it into a **linear roadmap of Iterations**.
   - Each Iteration MUST:
     - Have a single primary responsibility
     - Be independently verifiable
     - List dependencies on earlier Iterations (if any)
3. Classify each Iteration by domain (pick exactly one primary domain):
   - app-shell
   - worker-base
   - modeltable / built-in capability
   - sliding-ui / UI AST
   - bus (Matrix / MBR / MQTT)
   - crypto / E2EE / Element Call
   - packaging / platform
4. Produce a **Roadmap Summary** (documents only), including:
   - Ordered list of Iteration IDs
   - Goal of each Iteration
   - Explicit Non-Goals per Iteration

Roadmap output location (default):
- Create `docs/roadmaps/` if missing.
- Write `docs/roadmaps/<ROADMAP_ID>.md` where `<ROADMAP_ID>` is user-provided; otherwise derive from date + short slug.

No code changes are allowed in this phase.

---

### Phase B — Iteration Preparation (Phase 1 via `$doit`)

After the Roadmap is written:

1. `$doit-auto` MUST invoke `$doit` **once** to prepare Phase 1
   - Only for the **first Iteration in the roadmap**.
2. `$doit-auto` MUST ensure Phase 1 outputs exist for that iteration:
   - Register the Iteration in `docs/ITERATIONS.md` (append a new entry only)
   - Generate (docs-only):
     - `docs/iterations/<ITERATION_ID>/plan.md`
     - `docs/iterations/<ITERATION_ID>/resolution.md` (empty placeholder)
     - `docs/iterations/<ITERATION_ID>/runlog.md` (empty placeholder)
3. `$doit-auto` MUST stop after Phase 1 generation.

It MUST NOT:
- Enter Phase 3
- Prepare the next Iteration
- Modify any code

---

### Phase C — Rolling Advancement (User-Gated)

After an Iteration is completed and marked PASS:

- `$doit-auto` may be invoked again (e.g. the user says “continue”)
- It MUST:
  1. Verify the previous Iteration status in `docs/ITERATIONS.md` is `Completed`
  2. Select the next Iteration in the Roadmap (no skipping, no reordering)
  3. Invoke `$doit` to prepare Phase 1 for that Iteration
  4. Stop and wait for user approval

At no time may `$doit-auto` skip an Iteration or reorder them.

---

## SSOT Enforcement Rules

- Every Iteration prepared by `$doit-auto` MUST include an **SSOT Alignment Checklist** in `plan.md` (delegate to `$doit`).
- Any ambiguity or potential SSOT conflict MUST be documented, not resolved implicitly.
- `$doit-auto` MUST prefer stopping over guessing.

---

## Prohibited Actions

`$doit-auto` MUST NEVER:
- Modify `docs/architecture_mantanet_and_workers.md`
- Modify `AGENTS.md`
- Modify `docs/WORKFLOW.md`
- Modify `docs/ITERATIONS.md` except to append a new Iteration entry
- Generate or modify production code
- Enter Phase 3 on behalf of the user

---

## Success Criteria

This skill is successful if:
- Large objectives can be executed across many Iterations without losing structure
- The user only needs to approve Phase 3 and say “continue”
- SSOT consistency is maintained over time
