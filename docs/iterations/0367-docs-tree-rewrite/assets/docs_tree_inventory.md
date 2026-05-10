---
title: "Iteration 0367 Docs Tree Inventory"
doc_type: audit_asset
status: completed
updated: 2026-05-10
owner: codex
source: ai
---

# Docs Tree Inventory

This inventory fixes the planning scope before implementation. It is not a rewrite result.

## Bucket Counts

Generated from `docs/` files matching `*.md`, `*.html`, and `*.txt`.

| Bucket | Count | Planned treatment |
|---|---:|---|
| `docs/iterations` | 782 | Preserve as historical evidence. Do not bulk rewrite historical iteration bodies. Only update `0367-*` and necessary `docs/ITERATIONS.md` rows. |
| `docs/user-guide` | 49 | First-class rewrite target. Rebuild index and classify current guides, visualized/interactive HTML, historical prompts, examples, and diary/archive material. |
| `docs/plans` | 40 | Historical/design-plan layer. Add boundary/index treatment; do not let old plans override current SSOT. |
| `docs/ssot` | 19 | Rewrite active normative docs where needed. Preserve facts but clarify authority, scope, conflict handling, current/target/deprecated status. |
| `docs/<root-files>` | 10 | Review root docs individually. Rewrite active entrypoints; annotate deprecated or historical documents. |
| `docs/handover` | 5 | Treat as historical handover. Annotate/index as archive if it remains discoverable. |
| `docs/_templates` | 3 | Preserve templates unless alignment with new rule-writing/status fields is needed. |
| `docs/deployment` | 3 | Rewrite only current runbooks; preserve historical recovery notes with status boundaries. |
| `docs/roadmaps` | 3 | Mark roadmap as target/planning material, not current policy. |
| `docs/tmp` | 2 | Treat as temporary/historical; do not promote without evidence. |
| `docs/architecture-review-2026-04` | 1 | Treat as historical review evidence unless promoted by current docs. |
| `docs/charters` | 1 | Current charter layer; verify it does not override SSOT or `CLAUDE.md`. |
| `docs/concepts` | 1 | Treat as concept/history unless referenced by current SSOT. |
| `docs/prompts` | 1 | Treat as prompt archive unless explicitly promoted. |
| `docs/tests` | 1 | Treat as evidence/runbook, not policy. |

Additional tracked non-Markdown prompt file:

- `docs/prompts/Modelfile`: prompt archive; not current AI collaboration governance.

## Manifest Boundary

`file_treatment_manifest.md` gives the per-file treatment for all non-iteration docs files. `docs/iterations/**` is intentionally protected by a directory-level preserve policy because it is a historical evidence archive with hundreds of files.

The only iteration files in active rewrite scope are:

- `docs/ITERATIONS.md`
- `docs/iterations/0367-docs-tree-rewrite/plan.md`
- `docs/iterations/0367-docs-tree-rewrite/resolution.md`
- `docs/iterations/0367-docs-tree-rewrite/runlog.md`
- `docs/iterations/0367-docs-tree-rewrite/assets/docs_tree_inventory.md`
- `docs/iterations/0367-docs-tree-rewrite/assets/file_treatment_manifest.md`
- `docs/iterations/0367-docs-tree-rewrite/assets/contradictions_and_deferred.md` if contradictions are found.

## User Guide Files

Current `docs/user-guide/` contains:

- Entry/index: `README.md`
- Prompt/artifact guidance: `ai_prompt_and_artifact_guidance.md`, `ai_prompt_and_artifact_guidance.html`
- Current or potentially current guides: ModelTable, FillTable, slide app runtime, Matrix/worker/UI runbooks, deployment/use guides.
- Visualized or interactive HTML: `ai_prompt_and_artifact_guidance.html`, `slide-app-runtime/*visualized.html`, `workspace_ui_filltable_example_visualized.html`, `minimal_submit_app_provider_interactive.html`
- Historical prompt text files: `*_prompt.txt`
- Diary/archive materials: `diary/**`

Planned treatment:

- Keep HTML only where the file is explicitly visualized/interactive or already a linked visual companion.
- Ensure Markdown remains the default long-lived guide format.
- Ensure each current guide either states current usage clearly or is moved/marked as historical/example material through index wording.

## Historical Evidence Boundary

`docs/iterations/**` is evidence archive. It may contain old decisions, obsolete terms, failed branches, and target-only plans. Those contents must not be mass-edited or used to override current SSOT.

If active docs conflict with history, the active docs should state the current rule and point to the relevant historical iteration as evidence, not as a co-equal policy source.

## Initial Risk Areas

- `docs/user-guide/` has a mix of current guides, generated prompts, visualized HTML, and older examples. A flat index can mislead readers.
- `docs/plans/` and `docs/roadmaps/` can look like current direction even when superseded.
- Some active docs may still use absolute wording for judgment calls. These should be rewritten as decision rules.
- Some terms may mix current runtime facts, future targets, and historical migration notes. These need explicit status labels.
