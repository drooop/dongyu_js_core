---
title: "0357 PIN Connection Hard-Cut Implementation Runlog"
doc_type: iteration_runlog
status: completed
updated: 2026-05-06
source: ai
iteration: 0357-pin-connection-hard-cut-implementation
---

# Iteration 0357 PIN Connection Hard-Cut Implementation Runlog

## Environment

- Date: 2026-05-06
- Branch: `dev_0357-pin-connection-hard-cut-implementation`
- Base: `dev` at `062018d`

## Execution Records

### Step 0 — Intake / Planning

- Command: `git checkout -b dev_0357-pin-connection-hard-cut-implementation`
- Result: PASS
- Command: `python3 /Users/drop/.codex/skills/it/scripts/init_iteration_scaffold.py 0357-pin-connection-hard-cut-implementation --repo-root /Users/drop/codebase/cowork/dongyuapp_elysia_based`
- Result: PASS
- Command: created `docs/plans/2026-05-06-pin-connection-hard-cut-implementation.md`
- Result: PASS

### Step 1 — RED Contract Tests

- Command: `node scripts/tests/test_0357_pin_connection_hard_cut.mjs`
- Result: PASS (RED expected failure)
- Key output: `AssertionError [ERR_ASSERTION]: pin.connect.model must be rejected, not accepted as a legacy route`

### Step 2 — Runtime Hard-Cut

- Command: `node scripts/tests/test_0357_pin_connection_hard_cut.mjs`
- Result: PASS
- Notes:
  - `pin.connect.model` and `pin.log.*` are rejected with visible errors.
  - `pin.connect.label` accepts direct same-Cell endpoints only.
  - `pin.connect.label` reports a visible error if a direct function endpoint is triggered without a same-Cell function.
  - `pin.connect.cell` rejects function-shaped endpoints and undeclared target pins.
  - `model.submt` boundary relay replaces numeric/prefix cross-model routing.

### Step 3 — Server / Policy Migration

- Command: targeted server/import tests:
  - `node scripts/tests/test_0307_executable_import_contract.mjs`
  - `node scripts/tests/test_0312_slide_import_cache_contract.mjs`
  - `node scripts/tests/test_0321_imported_host_ingress_contract.mjs`
  - `node scripts/tests/test_0322_imported_host_egress_contract.mjs`
  - `node scripts/tests/test_0326_imported_host_egress_bridge.mjs`
- Result: PASS
- Notes:
  - Server-generated host ingress/egress routes use `model.submt` host cells plus `pin.connect.cell`.
  - Slide importer repair uses canonical Model 0 mounts for `-10`, `1030`, and `1034`.

### Step 4 — Asset / Test Migration

- Command: 38-test targeted matrix
- Result: PASS (`SUMMARY failed=0 total=38`)
- Included areas:
  - runtime connection parsing
  - submodel bridge
  - bus in/out payloads
  - imported host ingress/egress
  - workspace local color submit path
  - management bus console projection
  - docs contract checks
  - workspace system pin chain contract now checks `pin.connect.cell`, not removed runtime state
- Notes:
  - Deleted inactive `*.legacy.json` system-model archives containing removed ctx / legacy PIN code.
  - Removed stale `owner_apply` helper routes from imported host egress test assets.
  - Removed runtime `helper_executor` privilege path.
  - Fixed duplicate `model.submt` mount for Model `1016`; it is now mounted once at Model 0 `(2,0,12)`.

### Step 5 — Completion Gate

- Command: `node --check packages/worker-base/src/runtime.mjs && node --check packages/ui-model-demo-server/server.mjs && node --check packages/ui-model-demo-server/filltable_policy.mjs && git diff --check`
- Result: PASS
- Command: `node scripts/validate_builtins_v0.mjs && node scripts/validate_program_model_loader_v0.mjs --case connect_allowlist`
- Result: PASS
- Command: JSON parse check for changed JSON files
- Result: PASS (`json_parse PASS files=21`)
- Command: active asset grep:
  - `rg -n 'ctx\.writeLabel|ctx\.getLabel|ctx\.rmLabel|pin\.connect\.model|pin\.log\.|"\((self|func|[0-9-]+),' packages/worker-base/system-models deploy/sys-v1ns packages/ui-model-demo-server --glob '!node_modules/**' --glob '!dist/**' -S`
- Result: PASS (no matches)
- Command: `model.submt` duplicate mount check via `createServerState({ dbPath: null })`
- Result: PASS (`duplicates=[]`, watched mounts `-10=0:1,0,3`, `1016=0:2,0,12`, `1030=0:2,0,13`, `1034=0:2,0,15`)
- Command: SSOT/user-guide active wording grep:
  - `rg -n 'CELL_CONNECT 数字前缀|数字前缀路由|兼容映射|兼容路径|历史兼容路径|legacy action-prefix|modelConnectionRoutes' docs/ssot docs/user-guide packages/ui-model-demo-server packages/worker-base/src -S --glob '!node_modules/**' --glob '!dist/**'`
- Result: PASS (no matches)
