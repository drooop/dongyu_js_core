---
title: "Iteration 0455 Contract Surface Index Plan"
doc_type: iteration-plan
status: approved
updated: 2026-07-10
source: ai
iteration_id: 0455-contract-surface-index
id: 0455-contract-surface-index
phase: phase1
---

# Iteration 0455-contract-surface-index Plan

## Goal

Persist the 0454 findings into a trustworthy contract index and implement the approved scoped-authority model so Human and LLM entry points share one executable product contract without treating Feishu views, backlog, generated summaries, or history as interchangeable truth sources.

## Invariants

- Feishu remains read-only in this iteration.
- The approved authority model does not decide `pin_payload.v1/v2`, `ui.refresh_data`, `add_task_return`, Data/PIN naming, routing auto-fill, or compatibility aliases.
- Existing 0454/0455 candidate work and iteration history are preserved as evidence; no bulk deletion or silent rewrite.
- 0455 Phase 3 may start only after 0454 is Completed and its accepted commit is the parent/baseline of the 0455 branch.
- Repository SSOT changes still require the iteration gate; Feishu upstream consensus never changes executable behavior automatically.
- Human and LLM entry points must reference the same contract ids and must not duplicate product semantics.

## Scope

In scope:

- Add a Feishu contract backlog under `docs/ssot/`.
- Classify `feishu-model2` and `feishu-message-api` as the two approved upstream-consensus sources.
- Classify `main`, `rules`, `examples`, and `planning` as four derived views, each deriving from the approved upstream pair.
- Add `supporting-source-1` and `supporting-source-2` as explicitly pending, non-fetchable supporting-source slots.
- Record that derived views and supporting sources have no independent decision authority.
- Add a human-maintained contract manifest that maps Feishu/source contracts to SSOT files, implementation files, tests, terms, and verification commands.
- Separate source material, decision/SSOT files, open-decision backlog, and historical evidence into distinct fields.
- Add a deterministic generator/checker for the versioned contract coverage summary.
- Add a focused test that fails when:
  - a contract card is missing SSOT, implementation, test, or verification anchors;
  - a declared file path is stale;
  - a declared repo path escapes the repository;
  - a local source heading anchor is stale;
  - a verification command does not invoke an existing repository target;
  - a declared term cannot be found in declared anchors;
  - a required term is not anchored in each declared SSOT/implementation/test layer;
  - an open decision loses its required confirmation class or contract coverage;
  - the generated summary drifts from the manifest.
- Align `docs/README.md`, `AGENTS.md`, `CLAUDE.md`, Feishu alignment decisions, and source manifest with the same scoped-authority boundary.

Out of scope:

- Runtime behavior changes.
- New AST/symbol indexing beyond this starter manifest gate.
- Editing Feishu source documents.
- Solving the 0454 backlog items.
- Guessing the identity of the two supporting sources before reliable source evidence exists.
- Runtime behavior changes, deployment, merge, or push.

## Done Criteria

- `docs/ssot/feishu_contract_backlog.md` contains all non-aligned 0454 findings and their next action.
- `docs/ssot/contract_surface_manifest.json` is the single maintained source for contract cards.
- The contract manifest never lists history or an open-decision backlog as executable SSOT.
- `docs/ssot/contract_coverage_summary.md` is generated from the manifest and checked for drift.
- Source inventory contains exactly two upstream-consensus entries, four derived views, and two pending supporting-source slots; derived references are valid and acyclic.
- Human and LLM entry points reference the same executable contract and clearly separate execution governance from product semantics.
- All seven 0454 open items remain queryable with their decision class and contract coverage.
- `scripts/tests/test_0455_contract_surface_index.mjs` passes.
- `node scripts/ops/validate_obsidian_docs_gate.mjs` passes.
- `git diff --check` passes.
- Three consecutive independent reviews return `Approved` after all requested changes are implemented.
- Before Phase 3, three consecutive plan reviews are `Approved`, 0454 is Completed, and the 0454 accepted commit is recorded as the 0455 rollback baseline.
