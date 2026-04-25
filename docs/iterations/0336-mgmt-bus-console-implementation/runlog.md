---
title: "0336 — mgmt-bus-console-implementation Run Log"
doc_type: iteration-runlog
status: completed
updated: 2026-04-26
source: ai
iteration_id: 0336-mgmt-bus-console-implementation
id: 0336-mgmt-bus-console-implementation
phase: phase4
---

# 0336 — mgmt-bus-console-implementation Run Log

规则：只记事实（FACTS）。不要写愿景。

## Environment
- Date: `2026-04-26`
- Branch: `dev_0336-0337-mgmt-bus-slide-impl`
- Runtime: local macOS, repo `/Users/drop/codebase/cowork/dongyuapp_elysia_based`

## Review Gate Record
- Iteration ID: `0336-mgmt-bus-console-implementation`
- Review Date: `2026-04-26`
- Review Type: User
- Review Index: `1`
- Decision: Approved
- Notes: User approved implementing the 0334 / 0335 follow-up work in this branch; Codex will split into small stages with sub-agent code review checkpoints.

## Execution Records

### Step 0 — Registration
- Command: `python3 /Users/drop/.codex/skills/it/scripts/init_iteration_scaffold.py 0336-mgmt-bus-console-implementation --repo-root /Users/drop/codebase/cowork/dongyuapp_elysia_based`
- Key output: generated `plan.md`, `resolution.md`, `runlog.md`.
- Result: PASS
- Commit: `eac92ed`

### Step 1 — Contract Test And Model Implementation
- Files changed:
  - `scripts/tests/test_0336_mgmt_bus_console_contract.mjs`
  - `packages/worker-base/system-models/workspace_positive_models.json`
  - `packages/worker-base/system-models/system_models.json`
  - `packages/worker-base/system-models/runtime_hierarchy_mounts.json`
  - `packages/ui-renderer/src/renderer.mjs`
  - `packages/ui-renderer/src/renderer.js`
  - `packages/ui-model-demo-server/server.mjs`
- Key facts:
  - Added positive Model `1036` with `app_name=Mgmt Bus Console`, `slide_capable=true`, `slide_surface_type=workspace.page`, and `ui_authoring_version=cellwise.ui.v1`.
  - Model `1036` projects a four-region console from cellwise labels: subject list, event timeline, composer, event inspector / route status.
  - Model `1036` uses existing components only: `Container`, `Card`, `Tabs`, `Table`, `Terminal`, `Input`, `Button`, `StatusBadge`.
  - Projection labels for subjects, timeline, and route status are empty slots; no Matrix room truth, route truth, or secret-like values are copied into the console model.
  - The Send button emits `bus_event_v2` with `bus_in_key=mgmt_bus_console_send` and temporary ModelTable record array payload.
  - Model 0 routes `mgmt_bus_console_send` to system Model `-10` pin `mgmt_bus_console_intent`.
  - Model `1036` is mounted in `runtime_hierarchy_mounts.json`; browser verification first failed with `Model 1036 is not mounted into Workspace`, then this mount was added and covered by the contract test.
- Result: PASS
- Commit: `eac92ed`

### Step 2 — Stage Code Review
- Review agent `019dc5d4-28d0-72e3-97c4-170915d9a371`: CHANGE_REQUESTED.
- Finding: static subject / timeline / route rows copied external truth, and runtime behavior was not verified.
- Follow-up: projection rows were reset to empty slots and runtime route / invalid payload rejection checks were added.
- Review agent `019dc5d8-5881-7963-9de3-035992356675`: CHANGE_REQUESTED.
- Finding: `selected_subject` defaulted to `Matrix Debug`, which copied external subject truth.
- Follow-up: `selected_subject` was changed to an empty string and asserted by the contract test.
- Review agent `019dc5da-1c8a-7ca1-99d9-8425100194fd`: APPROVED.
- Result: PASS
- Commit: `eac92ed`

### Step 3 — Local Verification
- Command: `node scripts/tests/test_0336_mgmt_bus_console_contract.mjs`
- Result: PASS
- Command: `node scripts/tests/test_bus_in_out.mjs`
- Result: PASS
- Command: `node scripts/tests/test_0333_model100_cellwise_contract.mjs`
- Result: PASS
- Command: `npm -C packages/ui-model-demo-frontend run test`
- Result: PASS
- Command: `npm -C packages/ui-model-demo-frontend run build`
- Result: PASS, with existing Vite chunk-size warning.
- Command: `node scripts/validate_builtins_v0.mjs`
- Result: PASS
- Command: `node scripts/validate_ui_ast_v0x.mjs --case all`
- Result: PASS
- Command: `node -e "JSON.parse(require('fs').readFileSync('packages/worker-base/system-models/workspace_positive_models.json','utf8')); JSON.parse(require('fs').readFileSync('packages/worker-base/system-models/system_models.json','utf8')); JSON.parse(require('fs').readFileSync('packages/worker-base/system-models/runtime_hierarchy_mounts.json','utf8')); console.log('json_ok')"`
- Result: PASS
- Commit: `eac92ed`

### Step 4 — Local Deploy And Browser Verification
- Command: `bash scripts/ops/deploy_local.sh`
- Result: PASS
- Key output:
  - UI Server: `http://localhost:30900`
  - Matrix Room: `!QsNvzcsyGElPofMWfM:localhost`
  - Pods after deploy: `ui-server`, `mbr-worker`, `remote-worker`, `ui-side-worker`, `mosquitto`, `synapse` all `Running`.
- Browser command: Playwright CLI opened `http://127.0.0.1:30900/#/workspace` with session `dy0336`.
- Browser result:
  - Workspace asset tree contains `Mgmt Bus Console`.
  - Opening `Mgmt Bus Console` renders the console instead of `Model 1036 is not mounted into Workspace`.
  - Visible regions include `Subjects / Rooms`, `Event Timeline`, `Inspector / Route Status`, and `Composer`.
  - Filled composer with `playwright mgmt bus route check` and clicked `Send`.
- Browser snapshot check:
  - `Model 0 (0,0,0).mgmt_bus_console_send.t` is `pin.bus.in`.
  - `Model -10 (0,0,0).mgmt_bus_console_intent.t` is `pin.in`.
  - Routed payload includes `__mt_payload_kind=mgmt_bus_console.send.v1`, `source_model_id=1036`, `selected_subject=""`, and `draft="playwright mgmt bus route check"`.
  - Browser resource entries with `/_matrix/client`: `0`.
- Browser network check:
  - Requests observed: `/snapshot`, `/api/runtime/mode`, `/bus_event`.
  - No browser direct Matrix send was observed.
- Screenshot: `output/playwright/0336-0337-mgmt-bus-console/mgmt-bus-console.png`.
- Result: PASS
- Commit: `eac92ed`

### Step 5 — Final Code Review
- Review agent `019dc5ec-d0c6-7bb1-b3a4-b3b67efc7aa4`: APPROVED.
- Findings: none.
- Open questions: none.
- Verification gaps: none.
- Result: PASS
- Commit: `eac92ed`

## Docs Updated / Reviewed
- `docs/plans/2026-04-26-mgmt-bus-console-and-slide-flow-implementation.md`: added implementation plan.
- `docs/iterations/0336-mgmt-bus-console-implementation/plan.md`: added phase plan.
- `docs/iterations/0336-mgmt-bus-console-implementation/resolution.md`: added approved execution resolution.
- `docs/ssot/runtime_semantics_modeltable_driven.md`: reviewed; no edit required because the existing Model 0 `pin.bus.in` rule remains unchanged.
- `docs/ssot/label_type_registry.md`: reviewed; no new label type was introduced.
- `docs/user-guide/modeltable_user_guide.md`: reviewed; no edit required because this iteration adds a concrete Workspace console model, not a new user-facing label syntax.
- `docs/ssot/execution_governance_ultrawork_doit.md`: reviewed; no edit required.
- `docs/ssot/tier_boundary_and_conformance_testing.md`: reviewed; no edit required.
