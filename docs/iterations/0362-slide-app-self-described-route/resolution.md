---
title: "0362 Slide App Self Described Route Resolution"
doc_type: iteration_resolution
status: approved
updated: 2026-05-07
source: ai
iteration: 0362-slide-app-self-described-route
---

# Iteration 0362-slide-app-self-described-route Resolution

## Execution Strategy

- Execute in four review-gated stages. Each stage produces a bounded diff, deterministic verification, a `codex-code-review` sub-agent review, and follow-up fixes before the next stage starts.
- Start with docs/contracts so runtime behavior has an explicit target. Then wire UI Server outbound route metadata. Then update MBR/remote-worker generic forwarding and fixtures. Finish with local redeploy plus Playwright browser E2E.
- Prefer hard-cut behavior. If an old path would make the flow "work" without the new route contract, fail the test instead of preserving compatibility.

## Step 1

- Scope: Freeze the route contract and add deterministic contract tests.
- Files:
  - `docs/ssot/runtime_semantics_modeltable_driven.md`
  - `docs/ssot/label_type_registry.md`
  - `docs/ssot/temporary_modeltable_payload_v1.md`
  - `docs/ssot/imported_slide_app_host_ingress_semantics_v1.md`
  - `docs/ssot/tier_boundary_and_conformance_testing.md`
  - `docs/user-guide/modeltable_user_guide.md`
  - `docs/user-guide/slide-app-runtime/minimal_submit_app_provider_guide.md`
  - `docs/user-guide/slide-app-runtime/minimal_submit_app_provider_visualized.md`
  - `docs/user-guide/slide-app-runtime/minimal_submit_app_provider_interactive.html`
  - `scripts/tests/test_0362_slide_app_self_described_route_contract.mjs`
- Verification:
  - `node scripts/tests/test_0362_slide_app_self_described_route_contract.mjs`
- Acceptance:
  - Docs and tests agree that provider model id and local installed model id are distinct.
  - Docs and tests state `remote_bus_endpoint_v1` may declare only remote `route.to` defaults; `route.reply_to` is synthesized by UI Server and cannot be imported from ZIP runtime truth.
  - Docs include the explicit RE Model 3000 root and `(1,1,1)` program cell fill-table records for `submit1`.
  - Tests assert no per-app MBR route registration is required by the contract.
- Rollback:
  - Remove the 0362 test and revert the SSOT/user-guide docs touched in this step.

## Step 2

- Scope: Implement UI Server import/export/runtime support for `remote_bus_endpoint_v1` and self-described outbound route metadata.
- Files:
  - `packages/ui-model-demo-server/server.mjs`
  - `packages/ui-model-demo-frontend/src/demo_modeltable.js` if Workspace needs updated display/export data
  - `test_files/minimal_submit_dual_bus_app_payload.json`
  - `test_files/minimal_submit_dual_bus.zip`
  - `scripts/tests/test_0361_minimal_submit_import_export_contract.mjs`
  - `scripts/tests/test_0362_slide_app_self_described_route_contract.mjs`
- Verification:
  - `node scripts/tests/test_0361_minimal_submit_import_export_contract.mjs`
  - `node scripts/tests/test_0362_slide_app_self_described_route_contract.mjs`
- Acceptance:
  - Imported apps preserve `remote_bus_endpoint_v1`.
  - Importer rejects bundle-level runtime `route.reply_to` attempts.
  - Exported ZIP keeps provider endpoint data but removes install-generated cleanup state.
  - Outbound `pin_payload` contains `route.to` pointing to RE provider model id and `route.reply_to` pointing to the local installed model id.
- Rollback:
  - Revert server/frontend/test fixture changes from this step.

## Step 3

- Scope: Implement MBR/remote-worker generic forwarding for route metadata without per-app static route registration.
- Files:
  - `scripts/run_worker_v0.mjs`
  - `scripts/run_worker_remote_v1.mjs`
  - `deploy/sys-v1ns/mbr/patches/*.json`
  - `deploy/sys-v1ns/remote-worker/patches/*.json`
  - related runtime tests under `scripts/tests/`
- Verification:
  - `node scripts/tests/test_0359_minimal_submit_matrix_e2e_contract.mjs`
  - `node scripts/tests/test_0362_slide_app_self_described_route_contract.mjs`
- Acceptance:
  - MBR derives MQTT destination from `route.to`, not a per-app route label.
  - Remote-worker can route inbound `submit1` to a public root pin and internal program cell via current pin contracts.
  - Result carries enough reply metadata for UI Server to materialize into the local installed model.
- Rollback:
  - Revert MBR/remote-worker patch and runner changes from this step.

## Step 4

- Scope: Deploy locally and run real browser E2E for uploaded slide app.
- Files:
  - `docs/iterations/0362-slide-app-self-described-route/runlog.md`
  - `docs/ITERATIONS.md`
- Verification:
  - `npm -C packages/ui-model-demo-frontend run build`
  - `docker build --no-cache -f k8s/Dockerfile.ui-server -t dy-ui-server:v1 .`
  - `bash scripts/ops/check_runtime_baseline.sh`
  - Playwright import/open/submit/result browser flow on `http://127.0.0.1:30900/#/workspace`
- Acceptance:
  - Uploaded ZIP installs as a new local model.
  - Browser submit routes to the remote provider model and returns a visible updated text label.
  - Final sub-agent review approves the full diff.
- Rollback:
  - Revert 0362 branch changes; local deployment can be restored by rebuilding from the previous branch.

## Notes

- Generated at: 2026-05-07
