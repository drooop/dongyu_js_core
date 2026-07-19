---
name: grilling
description: Core repository-scoped interview loop used by grill-me. Use when grill-me invokes it, or when the user explicitly asks to grill or stress-test a high-impact plan, quotation or external commitment, architecture decision, or SSOT change. Do not use for routine fixes, copy edits, narrow refactors, or already-Approved Phase 3 execution.
---

## Applicability

Run this workflow only for an explicit user request or a high-impact decision with costly, externally binding, architectural, or SSOT consequences. If the task is routine and the user did not explicitly request a stress-test, stop this workflow and return to the normal repository workflow.

## Interview loop

1. Read the governing repository documents, the current registered iteration, and available source evidence before asking questions.
2. Look up facts with the available environment and tools instead of asking the user. Decisions remain the user's: put each decision to the user and wait for an answer.
3. Map the decision tree and resolve dependencies in order.
4. Ask exactly one question per turn. With each question, provide one recommended answer and a concise reason or trade-off.
5. Treat every recommendation as a proposal only. It is not a confirmed decision until the user explicitly confirms it.

## Stop rule

Do not implement, auto-approve, or advance to Phase 3. Continue until the user explicitly confirms that shared understanding has been reached. If material questions remain unresolved, record them as Open Questions and keep the Review Gate `On Hold`.

Shared-understanding confirmation is not Phase Gate approval. Only the exact Review Gate result defined by `docs/WORKFLOW.md` can authorize later execution.

## Persistent closure contract

After explicit shared-understanding confirmation:

1. Confirm that the work has a registered iteration under `docs/WORKFLOW.md`. If no iteration exists, create the required Phase 0 and Phase 1 artifacts before any implementation.
2. Persist these five closure groups in the existing iteration artifacts, with evidence or source pointers where applicable:
   - Confirmed Decisions
   - Assumptions And Validation Methods
   - Out Of Scope / Non-goals
   - Testable Acceptance Criteria
   - Open Questions / Residual Risks
3. Keep the full review packet in `plan.md`. Translate its executable validation, acceptance, and rollback implications into `resolution.md`.
4. Write a Review Gate result to `runlog.md` only after the user gives one of the exact decisions allowed by `docs/WORKFLOW.md`: `Approved`, `Change Requested`, or `On Hold`.
5. End with a concise summary and the paths of the updated iteration artifacts.

Reuse the existing iteration artifacts. Do not create a parallel ADR, `CONTEXT.md`, glossary, HTML report, issue tracker, or another source of truth for this review.
