---
title: "Iteration 0460 Grill Me Review Gate Plan"
doc_type: iteration-plan
status: approved
updated: 2026-07-19
source: ai
iteration_id: 0460-grill-me-review-gate
id: 0460-grill-me-review-gate
phase: phase2
---

# Iteration 0460-grill-me-review-gate Plan

## Goal

Add a repository-scoped, optional `grill-me` decision stress-test that contributes one-question-at-a-time interrogation to the existing iteration workflow without creating a second planning, approval, documentation, or execution path.

## Scope

In scope:

- Install exactly two upstream skill directories under repository-root `.agents/skills`: `grill-me` and its required `grilling` dependency.
- Pin source acquisition to `mattpocock/skills` commit `9603c1cc8118d08bc1b3bf34cf714f62178dea3b`; preserve the upstream MIT notice and record that the local copies are adapted.
- Keep `grill-me` explicitly user-invoked and restrict the interview to high-impact plans, quotations/external commitments, architecture/SSOT decisions, or an explicit stress-test request.
- Preserve the upstream discipline: ask one question at a time, inspect repository/environment facts instead of asking the user, provide a recommendation with each decision question, and never treat a recommendation as the user's decision.
- Require explicit user confirmation of shared understanding before closing the interview; never implement or cross the existing Review Gate as a side effect of the interview.
- Persist every completed review into the current registered iteration with: confirmed decisions, assumptions plus validation methods, out-of-scope/non-goals, testable acceptance criteria, and unresolved questions/residual risks.
- Map the persistent review packet into existing artifacts: `plan.md` for decisions/assumptions/scope/success criteria, `resolution.md` for executable verification and acceptance, and `runlog.md` only for an explicit Review Gate result.
- Add the smallest workflow/template guidance needed to make that mapping durable and auditable.
- Validate skill structure, dependency presence, invocation policy, closure fields, documentation consistency, and the exact changed-file boundary.

Out of scope:

- Installing into `~/.codex/skills`, `~/.agents/skills`, an admin/system directory, or any location outside this repository worktree.
- Installing the full `mattpocock/skills` bundle, its setup workflow, `grill-with-docs`, `domain-modeling`, `design-review`, or any unrelated skill/plugin.
- Creating `CONTEXT.md`, ADRs, glossary files, HTML reports, issue-tracker configuration, or another product/governance truth source.
- Replacing `docs/WORKFLOW.md`, the `it` workflow, iteration Phase gates, explicit `Approved`, PASS/FAIL verification, or current branch/commit rules.
- Automatically invoking the wrapper for routine bug fixes, copy edits, narrow refactors, or already-Approved Phase 3 execution.
- Modifying runtime, product SSOT, Feishu documents, deployment state, global Codex configuration, or the in-flight `0459` branch and iteration files.
- Merging to `dev`, pushing, or opening a PR without a later explicit completion instruction.

## Invariants / Constraints

- `CLAUDE.md` and `docs/WORKFLOW.md` remain authoritative; the new skills are optional interaction helpers only.
- No Phase 3 change begins until this plan/resolution receives an explicit `Approved` Review Gate.
- `grill-me` and `grilling` must both exist and validate; a dangling `/grilling` call is a hard failure.
- Advice is not authority. Only an explicit user decision may be persisted as confirmed or used to approve execution.
- No interview may end with chat-only conclusions. The five required closure groups must be present in a registered iteration artifact before the review is considered complete.
- The review packet must reuse existing iteration files; it must not create parallel ADR/glossary/issue-tracker truth.
- `grill-me` remains unavailable for implicit invocation through `agents/openai.yaml`.
- Third-party license and provenance must remain present after local adaptation.
- The committed skill surface contains exactly the two approved skill directories; auxiliary files are limited to required skill metadata and license notices.
- Work remains isolated on `dropx/dev_0460-grill-me-review-gate`, based on `dev` commit `188af0d`; the parallel `0459` commits and files remain absent and untouched.
- Because `0459` is not yet on `dev`, later integration must preserve both registry entries and resolve only the expected adjacent `docs/ITERATIONS.md` insertion if it appears.

## Confirmed Decisions

- Adopt the capability only as a conditional Phase 1/Phase 2 stress-test, not as a new phase or autonomous review/implementation workflow.
- Use repository scope at `$REPO_ROOT/.agents/skills`, which current Codex documentation identifies as a scanned repository skill location.
- Install and adapt only `grill-me` plus `grilling`; do not install the upstream bundle.
- Require persistent closure fields: decisions, assumptions, exclusions, acceptance criteria, and unresolved/residual items.

## Assumptions And Validation Methods

- Assumption: current Codex discovers repository-root `.agents/skills` from work started inside the repository.
  - Validation: use the current official `Build skills` documentation as the directory contract; after implementation, verify both skill paths in a fresh Codex skill-discovery context or restart Codex if the documented automatic refresh does not surface them.
- Assumption: the upstream `grill-me` wrapper depends on `grilling` but has no machine-enforced dependency manifest.
  - Validation: inspect the pinned `SKILL.md`, install both paths in one scoped installer run, and fail validation unless both directories exist and the wrapper reference resolves.
- Assumption: installing individual upstream subdirectories does not copy the repository-root MIT license.
  - Validation: inspect the installed path set and add the pinned upstream license notice to each adapted copy when absent.
- Assumption: instruction-only adaptation is sufficient; no reusable script or asset is required.
  - Validation: all acceptance checks are expressible as skill structure/content checks plus repository documentation gates; no repeated executable transformation is introduced.

## Success Criteria

- Repository root contains exactly `.agents/skills/grill-me` and `.agents/skills/grilling` as the new skill directories; no global skill or Codex configuration path changes.
- Both skill folders pass `skill-creator` `quick_validate.py` and include accurate `agents/openai.yaml` metadata.
- `grill-me` remains explicit-only, names `grilling` as its dependency, and fails closed when that dependency is unavailable.
- `grilling` retains one-question-at-a-time, fact-lookup-first, recommendation-with-question, user-decision-only, and no-action-before-confirmation behavior.
- Skill instructions distinguish high-impact use from routine tasks and forbid implementation, auto-approval, and continuation of already-Approved Phase 3 work.
- Closure instructions require all five review groups and map them into the existing `plan.md`, `resolution.md`, and explicit `runlog.md` Review Gate record.
- The current iteration plan template exposes explicit confirmed-decision and assumption-validation sections while retaining existing Out of Scope, Non-goals, and Success Criteria sections.
- `docs/WORKFLOW.md` describes the optional stress-test as a conditional decision rule inside Phase 1/2, not as a separate phase.
- License/provenance, documentation gate, `git diff --check`, exact changed-file allowlist, and no-global-write checks all PASS.
- A fresh Codex discovery context exposes the two repo-scoped skills from this repository; if refresh is delayed, one restart is allowed before declaring failure.
- `0459` worktree/branch state is byte-for-byte untouched by this iteration.

## Inputs

- Created at: 2026-07-19
- Iteration ID: `0460-grill-me-review-gate`
- Branch: `dropx/dev_0460-grill-me-review-gate`
- Baseline: `188af0d9356d0bc976634c224efbcf8a4ed6b67b`
- Upstream repository: `https://github.com/mattpocock/skills`
- Pinned upstream commit: `9603c1cc8118d08bc1b3bf34cf714f62178dea3b`
- Upstream paths: `skills/productivity/grill-me`, `skills/productivity/grilling`
- Codex location contract: `https://learn.chatgpt.com/docs/build-skills#where-to-save-skills`

## Alternatives Considered

- Recommended: install and adapt only the two repo-scoped skills, then integrate their output into the existing iteration files. This adds the missing interrogation method while preserving one governance path.
- Update templates/workflow only, without a skill: lowest maintenance, but does not add the one-question-at-a-time decision-tree behavior the user selected.
- Install the two upstream skills unchanged at user scope: simpler initially, but applies beyond this project and leaves the chat-only closure gap unresolved.
- Install the complete upstream bundle or `grill-with-docs`: rejected because it adds overlapping setup, issue-tracker/domain-doc workflows, and a higher risk of parallel truth sources.
