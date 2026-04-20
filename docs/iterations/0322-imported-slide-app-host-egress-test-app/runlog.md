---
title: "0322 — imported-slide-app-host-egress-test-app Runlog"
doc_type: iteration-runlog
status: in_progress
updated: 2026-04-20
source: ai
---

# 0322 — imported-slide-app-host-egress-test-app Runlog

## Environment

- Date: 2026-04-16 (planning), 2026-04-20 (resume)
- Branch: dev_0322-imported-slide-app-host-egress-test-app
- Runtime: phase 3 implementation resumed 2026-04-20

Review Gate Record
- Iteration ID: 0322-imported-slide-app-host-egress-test-app
- Review Date: 2026-04-16
- Review Type: User
- Review Index: 1
- Decision: Approved
- Notes: 用户已明确本轮主目标是 imported app 经宿主正式 ingress 接入，并继续进入 `pin.bus.out / MQTT / Matrix` 外发链，不以页面内本地按钮自循环为主验收。

## Execution Records

### Step 1 — contract and server-flow test scaffolding

- Command (recorded):
  - `node scripts/tests/test_0322_imported_host_egress_contract.mjs`
  - `node scripts/tests/test_0322_imported_host_egress_server_flow.mjs`
- Key output (after resume 2026-04-20):
  - contract → 2 passed, 0 failed
  - server_flow → 1 passed, 0 failed (after root-cause fixes below)
- Result: PASS
- Commit (initial WIP): `8d5ed83` feat: persist 0322 egress host adapter wip from codex (fixture + adapter + tests)

### Step 2 — host egress adapter implementation & root-cause fixes

On resume 2026-04-20 the server-flow test was FAIL (status_text stayed 'idle'). Independent debugging identified two blockers:

1. Test fixture typo: `handle_submit` code array joined with `.join('\\n')` (literal backslash+n) instead of `.join('\n')` (newline). `new AsyncFunction(codeStr)` threw SyntaxError, silently caught by `_propagateCellConnect` via `_recordError('cell_connect_propagation_error')`, so handle_submit never ran. Fix applied to both test fixtures.
2. codex's egress trigger path is `eventLog → processEventsSnapshot → intercepts.record('run_func') → executeFunction(forwardFunc)` — relies on `programEngine.tick()`. Tests used direct `runtime.addLabel` and never triggered tick. Fix: runtime EventLog now exposes `setObserver(callback)`; server registers an observer that schedules `programEngine.tick()` via microtask when runtime is in `running` mode. This is tier-1 infrastructure (pure observer hook, no business logic).

Additional hardening applied in this step:
- `buildImportedHostEgressForwardCode`: receive `err` in Matrix send catch; persist structured error label `${forwardFunc}_last_error` on Model 0 (0,0,0) carrying op_id + reason + message + timestamp. User-facing `status_text` continues to show `send_failed` / `matrix_unavailable` summary.
- `materializeImportedHostEgressAdapter`: deterministic `t: 'json'` for `dual_bus_model` label (dead conditional removed); error-label key added to `host_egress_generated_model0_labels` so delete cleanup removes it.
- Unit test `test_0322_runtime_bus_out_cleanup.mjs` covers the runtime.mjs +3-line `busOutPorts` cleanup (add/remove symmetry; independence from bus.in).

- Command:
  - `node scripts/tests/test_0322_imported_host_egress_contract.mjs`
  - `node scripts/tests/test_0322_imported_host_egress_server_flow.mjs`
  - `node scripts/tests/test_0321_imported_host_ingress_contract.mjs`
  - `node scripts/tests/test_0321_imported_host_ingress_server_flow.mjs`
  - `node scripts/tests/test_0322_runtime_bus_out_cleanup.mjs`
- Key output: all five test files report `0 failed` (total 8 passed).
- Result: PASS
- Commit: (Step 2 commit in this session)

### Step 3 — authoritative docs synchronisation

Partial progress:
- `docs/ssot/label_type_registry.md` updated: `pin.connect.label` endpoint `(prefix, pinName)` form documented; numeric-prefix usage (host adapter scenario) added as a dedicated table entry + note.

Still pending (open):
- `docs/ssot/runtime_semantics_modeltable_driven.md` — describe the EventLog observer hook and the programEngine tick auto-drive contract
- `docs/ssot/imported_slide_app_host_ingress_semantics_v1.md` — add egress section (was only ingress in 0320/0321)
- `docs/user-guide/modeltable_user_guide.md` — user-facing egress walkthrough
- `docs/handover/dam-worker-guide.md` — host adapter deletion checklist
- Run `node scripts/ops/obsidian_docs_audit.mjs --root docs`

- Command: (Step 3 not completed in this run)
- Result: PARTIAL
- Commit: (label_type_registry.md in this session's commit; remaining docs as follow-up iteration)

## Known Follow-ups (tracked, not blockers)

- HIGH #3 (idempotency): forward func has no op_id dedup; two rapid payloads within one tick window could theoretically reorder. Current MQTT + Matrix publishes are one-to-one per egressLabel write, but no explicit lock.
- MEDIUM #3: `firstSystemModel(runtime)` fallback vs explicit `runtime.getModel(-10)` — still uses fallback in egress adapter paths.
- LOW: pre-existing `console.log` statements in server.mjs dispatch paths.
- runtime.mjs `_executeFuncViaCellConnect` ctx lacks `sendMatrix` — external egress must go via `programEngine.executeFunction` path (by design); worth documenting in SSOT to avoid future `ctx.sendMatrix` mistakes in labels executed through pin.connect.label wiring.

## Docs Updated

- [x] `docs/ssot/label_type_registry.md` — numeric-prefix `pin.connect.label` semantics documented
- [ ] `docs/ssot/runtime_semantics_modeltable_driven.md` reviewed
- [ ] `docs/user-guide/modeltable_user_guide.md` reviewed
- [ ] `docs/handover/dam-worker-guide.md` reviewed
- [ ] `docs/ssot/imported_slide_app_host_ingress_semantics_v1.md` reviewed
