---
title: "0361 Minimal Submit Import Export Docs Plan"
doc_type: iteration_plan
status: completed
updated: 2026-05-07
source: ai
iteration: 0361-minimal-submit-import-export-docs
---

# Iteration 0361-minimal-submit-import-export-docs Plan

## Goal

- Preserve the portable `最小 Submit 双总线示例` import payload as a repo asset.
- Provide a repeatable way for developers to obtain a valid slide app zip instead of depending on chat-only JSON.
- Verify the saved zip through the real Workspace upload/import path and run the imported app in a browser.

## Scope

- In scope:
- Store the canonical `app_payload.json` record array and a generated zip fixture under `test_files/`.
- Add or document a supported export path that turns a Workspace slide app into a zip with exactly one `app_payload.json`.
- Update provider docs so third-party developers know how the JSON is generated, how temp ids are used, and when the exported zip is portable.
- Add deterministic checks for the saved payload/zip and export contract.
- Redeploy/restart the local UI if needed, then use Playwright against `http://127.0.0.1:30900/#/workspace`.
- Out of scope:
- Remote deployment.
- General-purpose visual UI builder.
- Migration of R1/MBR subscriptions for arbitrary imported model ids.

## Invariants / Constraints

- A slide import zip contains exactly one JSON file named `app_payload.json`.
- The payload is a ModelTable record array with temporary model ids; it is not patch ops and must not contain `model_id` patch fields.
- No `pin.connect.model`, legacy `ctx.writeLabel/getLabel/rmLabel`, direct frontend Matrix send, or non-ModelTable pin payload format.
- Exported zip must filter host-generated/import-generated labels so a package does not preserve installation state.
- UI remains projection only; formal business events still enter the existing pin/Model 0 chain.

## Success Criteria

- `test_files/minimal_submit_dual_bus_app_payload.json` and `test_files/minimal_submit_dual_bus.zip` exist and pass importer validation.
- A Workspace export endpoint or equivalent documented mechanism produces a zip with one `app_payload.json`.
- Provider docs explain both authoring from records and exporting an existing Workspace model to zip.
- Local deployment is refreshed if necessary.
- Playwright imports the saved zip through Workspace `滑动 APP 导入`, opens the newly installed app, submits text, and observes the expected state transition in the browser.

## Inputs

- Created at: 2026-05-07
- Iteration ID: 0361-minimal-submit-import-export-docs
- Review Gate: user-directed execution request on 2026-05-07; treat as Approved for this follow-up implementation.
