---
title: "0375 - Unified Worker Model Topic Resolution"
doc_type: iteration-resolution
status: approved
updated: 2026-05-12
source: ai
iteration_id: 0375-unified-worker-model-topic
id: 0375-unified-worker-model-topic
phase: approved
---

# Iteration 0375-unified-worker-model-topic Resolution

## Execution Strategy

Use a hard-cut, test-first migration. First freeze documentation and contract tests, then change runtime/topic parsing, then refill Tier 2 models and user-facing examples. Each stage ends with a sub-agent `codex-code-review` gate. A `CHANGE_REQUESTED` review blocks the next stage until fixed and re-reviewed.

## Step 1 — Contract Docs And Iteration Gate

- Scope: Register 0375 and update SSOT/user docs so topic, payload, and forbidden return-topic semantics are explicit.
- Files:
  - `docs/ITERATIONS.md`
  - `docs/iterations/0375-unified-worker-model-topic/plan.md`
  - `docs/iterations/0375-unified-worker-model-topic/resolution.md`
  - `docs/iterations/0375-unified-worker-model-topic/runlog.md`
  - `docs/ssot/runtime_semantics_modeltable_driven.md`
  - `docs/ssot/temporary_modeltable_payload_v1.md`
  - `docs/ssot/label_type_registry.md`
  - `docs/user-guide/modeltable_user_guide.md`
  - `docs/handover/dam-worker-guide.md`
- Verification:
  - `git diff --check`
  - sub-agent review against plan Step 1 scope.
- Acceptance:
  - Contract text states exact 9-segment topic.
  - Payload metadata is defined as Temporary ModelTable records, not top-level JSON.
  - Return topic / `route.reply_to` / old topic forms are forbidden.
- Rollback: Revert documentation edits and remove 0375 index entry.

## Step 2 — Contract Tests First

- Scope: Add failing tests for topic builder/parser, payload metadata schema, return-topic prohibition, and UI Server materialization target authority.
- Files:
  - `scripts/tests/test_0332_modeltable_pin_payload_contract.mjs`
  - `scripts/tests/test_0362_slide_app_self_described_route_contract.mjs`
  - new or updated `scripts/tests/test_0375_unified_worker_model_topic_contract.mjs`
- Verification:
  - Run the new focused tests and confirm they fail before implementation.
  - Run again after implementation in later stages.
- Acceptance:
  - Tests cover valid exact 9-segment topic.
  - Tests reject missing segment, extra segment, old `worker/model/pin`, old `model/pin`.
  - Tests reject loose top-level `origin_*` / `reply_target_*`.
  - Tests prove `pin=result` is insufficient without payload reply target.
  - Tests prove payload reply target, not topic suffix, selects UI Server materialization target.
- Rollback: Remove new tests or revert test edits.

## Step 3 — Runtime Hard Cut

- Scope: Replace old topic build/parse and inbound materialization behavior without compatibility fallback.
- Files:
  - `scripts/worker_engine_v0.mjs`
  - `packages/worker-base/src/runtime.js`
  - `packages/worker-base/src/runtime.mjs`
  - `scripts/run_worker_v0.mjs`
  - `scripts/run_worker_remote_v1.mjs`
  - `packages/ui-model-demo-server/server.mjs`
- Verification:
  - focused contract tests from Step 2
  - `node scripts/tests/test_bus_in_out.mjs`
  - `node scripts/tests/test_cell_connect_parse.mjs`
- Acceptance:
  - Runtime publishes only new endpoint topics.
  - Runtime rejects old topics.
  - UI Server materializes only from payload records.
  - CJS/ESM behavior is aligned.
- Rollback: Revert runtime/server edits.

## Step 4 — Tier 2 Patch Refill

- Scope: Refill MBR, remote-worker, Model 100, minimal Submit, and seeded workspace records for the new topic/payload contract.
- Files:
  - `deploy/sys-v1ns/mbr/patches/**`
  - `deploy/sys-v1ns/remote-worker/patches/**`
  - `packages/worker-base/system-models/test_model_100_ui.json`
  - `packages/worker-base/system-models/workspace_positive_models.json`
  - minimal submit app JSON/zip fixtures under `docs/user-guide/slide-app-runtime/**` and `test_files/**`
- Verification:
  - focused contract tests
  - active surface scan for forbidden fields and old topics
- Acceptance:
  - No current-path `route.reply_to`, return topic, result topic, or old topic literal remains.
  - Remote worker returns to the endpoint topic with payload reply target records.
- Rollback: Revert patch/model fixture edits.

## Step 5 — Importer / Installer / UI Binding

- Scope: Make ZIP installation generate local origin/reply target records and host-owned labels while provider ZIP declares only the endpoint.
- Files:
  - `packages/ui-model-demo-server/server.mjs`
  - `packages/ui-model-demo-frontend/src/**` if binding projection needs updates
  - related importer tests
- Verification:
  - importer contract tests
  - focused browser-install smoke if available locally
- Acceptance:
  - Provider ZIP cannot declare return/reply topic.
  - Installed app can submit with a payload record array that includes UI Server/local model reply target records.
- Rollback: Revert importer/installer edits.

## Step 6 — Docs And Interactive HTML

- Scope: Update minimal Submit JSON patch documentation and interactive HTML to teach the new topic and payload contract.
- Files:
  - `docs/user-guide/slide-app-runtime/**`
  - generated static docs/project files if present
- Verification:
  - doc contract tests
  - active surface scan
- Acceptance:
  - Developer docs show endpoint topic only.
  - Developer docs explicitly forbid return topics and `route.reply_to`.
  - Label-by-label explanation includes origin/reply target records.
- Rollback: Revert docs/static edits.

## Step 7 — Local Deploy And Browser Trace Verification

- Scope: Deploy local `ui-server`, `mbr-worker`, and `remote-worker`; verify color generator and minimal Submit with browser and trace.
- Files:
  - no intended source files; runlog evidence only
- Verification:
  - local deployment command(s)
  - Playwright against local Workspace
  - trace/log assertions for actual topic and payload records
- Acceptance:
  - UI result changes.
  - Trace proves new topic and record-array payload.
  - No old return/reply topic path is used.
- Rollback: Redeploy previous commit if needed.

## Step 8 — Remote Deploy And Public Verification

- Scope: Push, deploy remote three-service runtime, and verify public behavior with Playwright and trace evidence.
- Files:
  - no intended source files; runlog evidence only
- Verification:
  - remote pod hash comparison
  - Playwright against `https://app.dongyudigital.com/#/workspace`
  - remote trace/log assertions
- Acceptance:
  - Remote hashes match committed source.
  - Color generator and minimal Submit pass on public site.
  - Trace proves new endpoint topic and payload records.
- Rollback: Redeploy previous known-good revision using the documented app deploy script.

## Step 9 — Final Closure

- Scope: Final review, status update, commit/merge/push if requested or required by closure.
- Verification:
  - `git diff --check`
  - focused tests and active surface scan
  - final sub-agent code review
- Acceptance:
  - All previous stage reviews are approved.
  - `docs/ITERATIONS.md` status can be moved to Completed only after all evidence is in `runlog.md`.

## Step 10 — Worker Fill-Table Recheck

- Scope: Re-audit whether `ui-server`, `mbr-worker`, and `remote-worker` need additional fill-table changes after the same-topic implementation.
- Files:
  - `deploy/sys-v1ns/mbr/patches/**`
  - `deploy/sys-v1ns/remote-worker/patches/**`
  - `k8s/local/workers.yaml`
  - `k8s/cloud/workers.yaml`
  - `packages/ui-model-demo-server/server.mjs`
- Verification:
  - focused grep/static audit for old topic and return fields
  - `node scripts/validate_mbr_patch_v0.mjs`
  - relevant focused contract tests
  - sub-agent code review
- Acceptance:
  - Refill decision is explicit for each worker.
  - Any required patch/config update is applied and verified.
  - No current active path uses return topic, result topic, `ui-server-local`, or old endpoint shape.

## Step 11 — Existing UI Model And Surface Recheck

- Scope: Review current UI model assets and visible workspace surfaces affected by the new endpoint contract; adjust any stale label, binding, or display wording.
- Files:
  - `packages/worker-base/system-models/**`
  - `packages/ui-model-demo-frontend/src/**`
  - `packages/ui-model-demo-server/server.mjs`
- Verification:
  - UI model/static scans
  - focused renderer/importer tests
  - local browser check for affected surfaces
  - sub-agent code review
- Acceptance:
  - User-facing UI text and bindings describe the endpoint-only topic contract.
  - Submit-like buttons still bind through model labels and trigger the backend ModelTable runtime path.
  - No UI surface teaches or depends on old return-topic semantics.

## Step 12 — Minimal Submit Patch And ZIP Refresh

- Scope: Produce the current JSON patch and zip for `最小 Submit 双总线示例`, then prove import and runtime behavior locally.
- Files:
  - `docs/user-guide/slide-app-runtime/**`
  - `test_files/minimal_submit_dual_bus_app_payload.json`
  - `test_files/minimal_submit_dual_bus.zip`
  - related tests
- Verification:
  - JSON/zip structure checks
  - import/export contract tests
  - local deploy and Playwright import/submit verification
  - sub-agent code review
- Acceptance:
  - JSON patch contains only ModelTable records.
  - Provider records declare the remote endpoint only; installer owns local model/reply target.
  - Browser import creates an app that submits via `UIPUT/ws/dam/pic/de/sw/R1/3000/submit1` and updates visible text from the response.

## Step 13 — Minimal Submit MD And HTML Refresh

- Scope: Rewrite the MD and interactive HTML docs to match the actual current JSON patch, installer behavior, topic format, and runtime path.
- Files:
  - `docs/user-guide/slide-app-runtime/minimal_submit_app_provider_guide.md`
  - `docs/user-guide/slide-app-runtime/minimal_submit_app_provider_visualized.md`
  - `docs/user-guide/slide-app-runtime/minimal_submit_app_provider_interactive.html`
  - static-project mirrors if generated from these docs
- Verification:
  - doc content scan for old fields and stale URLs
  - public-doc/static sync contract tests
  - local browser view of the HTML artifact
  - sub-agent code review
- Acceptance:
  - Docs explain every patch label that matters.
  - Docs explain Submit button binding, backend program trigger, and final dual-bus send/return path.
  - Docs explain UI Server installation: model id allocation, sidebar mount, host-owned labels, and Model 0 bus path.

## Step 14 — Local And Remote Publication Verification

- Scope: Deploy locally, verify behavior, then publish docs/statics and required runtime changes to the remote server.
- Files:
  - runlog evidence
  - optional deployment docs if the process changes
- Verification:
  - local deployment
  - Playwright against `http://127.0.0.1:30900/#/workspace`
  - remote source sync/deploy or docs/static fast deploy as appropriate
  - Playwright against `https://app.dongyudigital.com/#/workspace`
  - public docs/static URL checks
  - final sub-agent code review
- Acceptance:
  - Local and remote runtime behavior passes.
  - MD docs are available via UI Server docs path.
  - HTML docs are available via UI Server static project path.
  - `docs/ITERATIONS.md` can be moved to Completed.

## Notes

- Generated at: 2026-05-12
