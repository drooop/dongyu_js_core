---
title: "0361 Minimal Submit Import Export Docs Resolution"
doc_type: iteration_resolution
status: completed
updated: 2026-05-07
source: ai
iteration: 0361-minimal-submit-import-export-docs
---

# Iteration 0361-minimal-submit-import-export-docs Resolution

## Execution Strategy

- Make the chat-provided payload durable first, then validate it via the existing importer.
- Prefer a small server-side export contract over a manual-only process: developers can fill a Workspace UI model, then download a zip that the importer can later install.
- Keep docs explicit about the two paths: author records directly, or export an already authored Workspace model.
- Use deterministic tests before browser verification, then run the actual Workspace upload/import/open/submit flow.

## Step 1

- Scope: Register iteration and freeze the follow-up contract.
- Files: `docs/ITERATIONS.md`, `docs/iterations/0361-minimal-submit-import-export-docs/`.
- Verification: index row exists and runlog records the user-directed approval.
- Acceptance: implementation work is auditable under 0361.
- Rollback: remove the 0361 row and iteration directory before code changes if cancelled.

## Step 2

- Scope: Save the canonical minimal Submit import asset.
- Files: `test_files/minimal_submit_dual_bus_app_payload.json`, `test_files/minimal_submit_dual_bus.zip`.
- Verification: import validation accepts the zip and generated host egress labels exist.
- Acceptance: the saved zip can be uploaded through the normal Workspace importer.
- Rollback: remove the two fixture files.

## Step 3

- Scope: Provide a supported slide app zip export path.
- Files: `packages/ui-model-demo-server/server.mjs`, `packages/ui-model-demo-frontend/src/demo_modeltable.js`, `packages/worker-base/system-models/workspace_catalog_ui.json`, tests.
- Verification: export contract test downloads/builds a zip with one `app_payload.json`, temporary ids, no generated host labels, and re-importable records.
- Acceptance: Workspace registry entries expose an export URL and server returns a valid zip.
- Rollback: remove the endpoint, registry field, UI link, and export tests.

## Step 4

- Scope: Update developer docs.
- Files: `docs/user-guide/slide-app-runtime/minimal_submit_app_provider_guide.md`, visualized/interactive docs if needed.
- Verification: docs contract test checks export/generation instructions and saved payload references.
- Acceptance: a developer can understand how JSON is generated and how to create/download zip without internal chat context.
- Rollback: revert docs updates.

## Step 5

- Scope: Local deploy and browser verification.
- Files: runtime state only, plus Playwright evidence under iteration assets if screenshots are captured.
- Verification: frontend build/tests, local deploy/baseline, Playwright upload/import/open/submit flow.
- Acceptance: browser shows the imported app and its submit flow changes visible state; import path uses `minimal_submit_dual_bus.zip`.
- Rollback: redeploy previous local revision/state.

## Notes

- Generated at: 2026-05-07
- Outcome: completed. The saved zip imports through Workspace, export zip is available from Workspace/API, and the real browser run on imported Model 1053 showed Submit entering the Model 0 egress chain with visible `REMOTE sending` state.
