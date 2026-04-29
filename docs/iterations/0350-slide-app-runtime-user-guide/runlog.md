---
title: "0350 Slide App Runtime User Guide Runlog"
doc_type: iteration-runlog
status: completed
updated: 2026-04-29
source: ai
---

# Iteration 0350-slide-app-runtime-user-guide Runlog

## Environment

- Date: 2026-04-29
- Branch: `dev_0350-slide-app-runtime-user-guide`
- Runtime: docs / contract-test only; no runtime or remote deployment mutation.

## Execution Records

### Step 1

- Command:
  - `dig +short dongyudigital.com && dig +short app.dongyudigital.com && dig +short NS dongyudigital.com`
  - `dig +trace +nodnssec dongyudigital.com | tail -n 30`
  - `nc -vz -G 5 124.71.43.80 22`
  - `ssh -o BatchMode=yes -o ConnectTimeout=8 -o StrictHostKeyChecking=accept-new drop@124.71.43.80 'printf "%s@%s\n" "$(whoami)" "$(hostname)"'`
- Key output:
  - `dongyudigital.com` and `app.dongyudigital.com` resolve to `expired.hichina.com.` and parked IPs (`8.218.208.240`, `47.91.170.222`, `47.76.127.217`).
  - Public delegation trace returns `dongyudigital.com. NS expirens3.hichina.com.` / `expirens4.hichina.com.`, then `CNAME expired.hichina.com.`.
  - SSH TCP port 22 succeeds on `124.71.43.80`.
  - SSH login succeeds as `drop@aPIC-XC599-dongyu`.
- Result: PASS. SSH is usable via `drop@124.71.43.80`; DNS issue is authoritative / registrar-side HiChina expiration routing, not a local DNS server cache-only symptom.
- Commit: this iteration commit

### Step 2

- Command:
  - Reviewed `packages/worker-base/system-models/default_table_programs.json`.
  - Reviewed `packages/ui-renderer/src/renderer.mjs`.
  - Reviewed `packages/ui-model-demo-frontend/src/remote_store.js`.
  - Reviewed `packages/ui-model-demo-server/server.mjs`.
  - Reviewed `docs/ssot/imported_slide_app_host_ingress_semantics_v1.md`.
  - Reviewed `docs/user-guide/slide_delivery_and_runtime_overview_v1.md`.
- Key output:
  - Every `model.table` root is seeded with `mt_write`, `mt_bus_receive`, and `mt_bus_send` chains.
  - Frontend formal events use `bus_event_v2` and remote mode posts them to `/bus_event`.
  - Server normalizes `bus_event_v2.value` as a temporary ModelTable record array and writes it to Model 0 `(0,0,0)` as `pin.bus.in`.
  - Imported slide install generates host ingress and egress adapters around the imported root and the Model 0 mount cell.
- Result: PASS. Documentation basis matches current code paths.
- Commit: this iteration commit

### Step 3

- Command:
  - `node scripts/tests/test_0350_slide_app_runtime_user_guide_contract.mjs`
  - `node scripts/tests/test_0337_slide_flow_docs_contract.mjs`
  - `node scripts/tests/test_0321_imported_host_ingress_contract.mjs`
  - `node scripts/tests/test_0321_imported_host_ingress_server_flow.mjs`
  - `node scripts/tests/test_0322_imported_host_egress_contract.mjs`
  - `node scripts/tests/test_0322_imported_host_egress_server_flow.mjs`
  - `node scripts/tests/test_0342_mgmt_bus_console_real_messaging_contract.mjs`
  - `node scripts/ops/validate_obsidian_docs_gate.mjs`
  - `git diff --check`
  - Playwright CLI against `http://127.0.0.1:43150/slide_app_runtime_flow_visualized.html`
- Key output:
  - 0350 docs contract: 5 PASS.
  - 0337 slide flow docs contract: 3 PASS.
  - 0321 ingress contract: 3 PASS.
  - 0321 ingress server flow: 1 PASS.
  - 0322 egress contract: 2 PASS.
  - 0322 egress server flow: 1 PASS.
  - 0342 management bus real messaging contract: 12 PASS after updating its asset-tree check from old coarse `ui_props_json` fields to current fine-grained `ui_label/ui_width/ui_size` fields.
  - Obsidian docs gate: PASS after adding frontmatter to the 0350 iteration files.
  - `git diff --check`: PASS.
  - Playwright loaded the visualized page, found title `Slide App Runtime Flow`, and clicking stage 6 switched to the external-flow panel with `mt_bus_send_in`, `pin.bus.out`, and `owner materialization`.
- Result: PASS.
- Commit: this iteration commit

### Non-Blocking Baseline Note

- Command:
  - `node scripts/validate_iteration_guard.mjs`
- Key output:
  - `stage4: PASS`
  - `FAIL: forbidden_imports:packages/ui-model-demo-server/server.mjs:matrix`
  - The same `require('../worker-base/src/matrix_live.js')` line exists on current `dev`; this broad legacy guard is not specific to 0350 and is not used as the acceptance gate for this docs-only iteration.
- Result: Baseline guard mismatch noted; targeted 0350 checks passed.

## Docs Updated

- [x] `docs/ssot/runtime_semantics_modeltable_driven.md` reviewed indirectly through current slide docs and tests
- [x] `docs/user-guide/modeltable_user_guide.md` reviewed for current Model 0 / root program wording
- [x] `docs/ssot/imported_slide_app_host_ingress_semantics_v1.md` reviewed
- [x] `docs/user-guide/slide_delivery_and_runtime_overview_v1.md` reviewed
