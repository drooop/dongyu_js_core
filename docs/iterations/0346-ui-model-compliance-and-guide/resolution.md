---
title: "0346 — UI Model Compliance And Guide Resolution"
doc_type: iteration-resolution
status: approved
updated: 2026-04-27
source: ai
iteration_id: 0346-ui-model-compliance-and-guide
id: 0346-ui-model-compliance-and-guide
phase: planning
---

# Iteration 0346-ui-model-compliance-and-guide Resolution

## Step 1 — Inventory And Audit Harness

- Scope: build an executable inventory of Workspace-visible UI surfaces and define enforceable cellwise granularity rules.
- Files:
- `scripts/tests/test_0346_ui_model_compliance_contract.mjs`
- `docs/iterations/0346-ui-model-compliance-and-guide/runlog.md`
- Verification:
- The new test must first expose current non-conforming surfaces.
- The inventory must list each visible surface with model id, source file, UI mode, node count, and violations.
- Acceptance:
- No interface is left unclassified.
- Review:
- Spawn sub-agent `codex-code-review` after this audit harness is green or intentionally red with documented targets.
- Rollback:
- Remove the new test and iteration records if the audit strategy is rejected.

## Step 2 — Shell, Workspace, Gallery, And Example Surfaces

- Scope: fix the global shell/workspace and Gallery/example surfaces so visible UI is model-authored or explicitly bounded as host chrome.
- Files:
- `packages/ui-model-demo-frontend/**`
- `packages/worker-base/system-models/gallery_catalog_ui.json`
- `packages/worker-base/system-models/workspace_positive_models.json`
- Verification:
- Audit harness passes for this family.
- Existing Gallery/Workspace tests still pass.
- Acceptance:
- No whole-page `page_asset_v0` or schema fallback is required for this family.
- Review:
- Spawn sub-agent `codex-code-review` and fix findings before Step 3.
- Rollback:
- Revert this family’s model/renderer changes only.

## Step 3 — Business Demo And Workspace Tool Surfaces

- Scope: fix Color Generator, Leave Request, Repair Request, Static, Doc, FillTable, Slide Importer, and Slide Creator surfaces.
- Files:
- `packages/worker-base/system-models/workspace_positive_models.json`
- relevant renderer/frontend tests
- Verification:
- Audit harness passes for this family.
- Existing color, workspace filltable, static/doc, and slide import/create tests pass.
- Acceptance:
- Each visible component is represented as its own node cell or documented non-visual model label.
- Review:
- Spawn sub-agent `codex-code-review` and fix findings before Step 4.
- Rollback:
- Revert this family’s model records and tests only.

## Step 4 — Matrix And Mgmt Bus Surfaces

- Scope: fix Matrix Debug, Matrix Chat, and Mgmt Bus Console UI model compliance.
- Files:
- `packages/worker-base/system-models/**`
- `packages/ui-model-demo-server/mgmt_bus_console_projection.mjs`
- related frontend/server tests
- Verification:
- Audit harness passes for this family.
- 0342/0343/0344 Mgmt Bus and payload tests still pass.
- Acceptance:
- No direct Matrix send or direct business-state write is added.
- Review:
- Spawn sub-agent `codex-code-review` and fix findings before Step 5.
- Rollback:
- Revert this family’s records/projection changes only.

## Step 5 — Documentation Components And UI Model Guide Page

- Scope: add or formalize documentation UI components, write the developer guide, and materialize it as a UI model page.
- Files:
- `packages/ui-renderer/src/**`
- `packages/worker-base/system-models/workspace_positive_models.json`
- `docs/user-guide/ui_components_v2.md`
- `scripts/tests/**`
- Verification:
- Guide docs test passes.
- UI audit confirms the documentation page is cellwise.
- Frontend build passes.
- Browser inspection confirms Markdown/code/diagram source-preview sections render.
- Acceptance:
- The guide reads like a developer manual, not a terse ledger.
- The model-authored documentation page uses granular UI labels and enhanced Markdown/code/diagram source-preview sections.
- Review:
- Spawn sub-agent `codex-code-review` and fix findings before Step 6.
- Rollback:
- Revert renderer additions and remove documentation model records.

## Step 6 — Final Deployment, Browser Verification, And Completion

- Scope: redeploy/restart local stack as needed, inspect representative UI pages in a real browser, and perform final review.
- Files:
- runlog and iteration index only unless verification exposes a defect.
- Verification:
- `npm -C packages/ui-model-demo-frontend run build`
- deterministic UI audit tests
- Mgmt Bus / payload regression tests
- local deployment baseline check if affected stack is redeployed
- Browser inspection of Workspace, Gallery, Color Generator, Mgmt Bus Console, Matrix Chat, Slide tools, and UI Guide page.
- Acceptance:
- Final sub-agent `codex-code-review` returns `APPROVED`.
- `docs/ITERATIONS.md` marks 0346 Completed only after all evidence is recorded.
- Rollback:
- Revert `dev_0346-ui-model-compliance-and-guide` merge before promoting if final verification fails.
