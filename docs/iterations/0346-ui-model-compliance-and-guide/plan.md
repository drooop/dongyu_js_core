---
title: "0346 — UI Model Compliance And Guide Plan"
doc_type: iteration-plan
status: approved
updated: 2026-04-27
source: ai
iteration_id: 0346-ui-model-compliance-and-guide
id: 0346-ui-model-compliance-and-guide
phase: planning
---

# Iteration 0346-ui-model-compliance-and-guide Plan

## Goal

- Audit every user-visible UI surface in the current project, ensure it is expressed through sufficiently granular `cellwise.ui.v1` ModelTable labels, fix non-conforming surfaces, and ship a developer-facing UI model authoring manual that is both a Markdown document and a model-authored UI documentation page.

## Done Criteria

- `dev` and `main` have already been pushed to `origin` before this iteration starts.
- Every Workspace-visible app or page has a recorded audit result.
- Every user-facing positive-model UI surface either:
- is authored with `ui_authoring_version = cellwise.ui.v1`, `ui_root_node_id`, and one cell per visible component, or
- is explicitly classified as a non-user-facing truth/child model and is not opened directly as an interface.
- No active user-facing UI surface depends on `page_asset_v0` as a whole-page JSON blob or schema fallback as the primary UI definition.
- UI labels are granular: visible text, labels, layout, binding, and event intent are separated into labels instead of one large HTML/string/JSON blob.
- Formal UI business events still enter through Model 0 `pin.bus.in`; no direct Matrix or direct business-state write path is introduced.
- A deterministic audit script fails on non-cellwise/coarse UI surfaces and passes on the fixed tree.
- The UI authoring guide explains components, layout, bindings, event flow, and examples in a Vue-docs-like style.
- The guide is also represented by a UI model page that uses a `Markdown`/documentation component with enhanced sections including code highlighting and diagram source previews.
- After each interface or interface family is completed, a spawned sub-agent runs `codex-code-review`; findings are fixed before moving to the next family.
- Final local verification includes deterministic tests, frontend build, local deployment when UI behavior is claimed, and browser inspection of representative pages.

## Scope

- In scope:
- Workspace app list and workspace shell projection.
- All directly user-visible positive model apps in `packages/worker-base/system-models/workspace_positive_models.json`.
- Gallery catalog UI and gallery-driven examples.
- Matrix Debug / Mgmt Bus Console / Matrix Chat visible surfaces.
- Slide import/create surfaces and example apps.
- UI renderer support needed for the documentation page, including a Markdown-style component if missing.
- Developer documentation under `docs/user-guide/**`.
- New deterministic audit tests and runlog evidence.
- Out of scope:
- Remote cluster mutation.
- Replacing runtime semantics unrelated to UI projection.
- Rewriting historical iteration archives except where linked by current user-guide docs.
- Adding broad frontend design-system migration not needed for cellwise compliance.

## Interface Families

- Shell and Workspace: route tabs, asset tree, selected app mounting area.
- Gallery and examples: Gallery catalog, schema/page/parent/Three examples.
- Business demo forms: Color Generator, Leave Request, Repair Request.
- Static/doc/filltable workspace examples: Models 1009-1014.
- Matrix surfaces: Matrix Debug and Matrix Chat models 1016-1021.
- Slide tools: Slide importer and fill-table creator models 1030-1035.
- Mgmt Bus Console: Model 1036 and its live/event/send UI.
- UI Model Guide: new documentation model page plus Markdown guide.

## Constraints

- `CLAUDE.md` remains highest priority.
- No runtime business side effect may bypass `add_label` / `rm_label`.
- UI is projection only; ModelTable remains truth.
- New positive models must not own system truth that belongs in negative/system models.
- `model.submt` is only for child model mounting, not visual layout.
- Visual containment uses `ui_parent`, `ui_order`, `ui_layout`, and `ui_slot`.
- Each code/docs slice must be reviewed by sub-agent before the next slice when it completes an interface family.

## Success Evidence

- Audit output listing every surface and PASS/FAIL status.
- Sub-agent review decisions for each completed interface family.
- Browser evidence for representative pages after local deployment.
- Final `codex-code-review` approval before merge.

## Inputs

- Created at: 2026-04-27
- Branch: `dev_0346-ui-model-compliance-and-guide`
- Gate: user explicitly requested execution and delegated decisions in this thread.
