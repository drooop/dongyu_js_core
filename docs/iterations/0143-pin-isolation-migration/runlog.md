---
title: "0143 — Runlog (FACTS)"
doc_type: iteration-runlog
status: active
updated: 2026-03-21
source: ai
iteration_id: 0143-pin-isolation-migration
id: 0143-pin-isolation-migration
phase: phase3
---

# 0143 — Runlog (FACTS)

## Environment
- Runtime: node v24.13.0
- Branch: dev_0143-pin-isolation-migration
- Base: dev (after 0141/0142 merge)

---

## Step 1-2: Inventory & MBR Check (previous session)

Completed in prior session. Scan identified 14 legacy symbols across 8 files.
MBR Worker (`run_worker_mbr_v0.mjs`) does not directly depend on deleted symbols.

## Step 3: system_models.json + test_model_100_full.json Migration (previous session)

- Backed up originals to `.legacy` files
- `system_models.json`: Deleted 4 pin_demo legacy functions (declare_pin_in/out, inject_in, send_out). Removed pin_register/pin_send_out from intent_dispatch. Kept pin_demo_set_mqtt_config, pin_demo_start_mqtt_loop.
- `test_model_100_full.json`: Replaced PIN_IN/PIN_OUT with cell_connection routing + CELL_CONNECT wiring:
  - routing: `[0,0,0,"event"]→[1,0,0,"event"]`, `[1,0,0,"patch"]→[0,0,0,"patch"]`
  - wiring: `(self,event)→(func,on_model100_event_in:in)`, `(func,on_model100_event_in:out)→(self,patch)`
- Fixed trailing comma in system_models.json (JSON syntax error from prior session)

## Step 4: Delete Legacy PIN Code from Runtime

### 4.1 runtime.js (1696 → ~1387 lines, ~309 lines deleted)
- Constructor: Deleted `pinInSet`, `pinOutSet`, `pinInBindings`
- Deleted functions: `_pinKey`, `_parsePinKey`, `_normalizeTargetRef`, `_parsePinInBinding`, `_resolvePinInRouteForMode`, `resolvePinInRoute`, `findPinInBindingsForDelivery`, `_pinRegistryCellFor`, `_pinMailboxCellFor`, `_applyPinDeclarations`, `_applyPinRemoval`, `_resolveTriggerModelId`, `_applyMailboxTriggers`
- `addLabel`: Removed `_applyPinDeclarations` and `_applyMailboxTriggers` calls
- `rmLabel`: Removed `_applyPinRemoval` call
- `_subscribeDeclaredPinsOnStart`: Removed PIN_IN subscription loop
- `mqttIncoming`: Removed all PIN_IN routing. New flow: BUS_IN short-circuit → write IN to model (0,0,0)
- `_handleWildcardIncoming`: Changed target from legacy mailbox (0,1,1) to root cell (0,0,0)
- `_applyBuiltins`: Added MQTT_WILDCARD_SUB handling (moved from deleted `_applyPinDeclarations`)
- **Bug fix (0143)**: Added `_routeViaCellConnection` call for IN labels in `_applyBuiltins` — without this, cell_connection routing is NOT triggered when IN is written to a cell

### 4.2 runtime.mjs (ESM variant)
- Identical changes as runtime.js
- Both files syntax-checked: PASS

### 4.3 Consumer Updates
- `server.mjs`: Replaced `resolvePinInRoute` (L750) → direct addLabel; replaced `findPinInBindingsForDelivery` block (L988) → comment
- `run_remote_worker_k8s_v2.mjs`: Replaced `pinInSet`/`pinOutSet` logs → `busInPorts`/`busOutPorts`; removed manual event detection loop (CELL_CONNECT handles it)
- `test_bus_in_out.mjs`: Removed `pinInSet`/`_pinKey` references from test_bus_in_shortcircuit_mqtt
- `validate_pin_mqtt_loop.mjs`: Renamed to `.legacy` (pure legacy PIN validation)
- `validate_model100_records_e2e_v0.mjs`: Updated cell references from (0,1,1) to (0,0,0)/(1,0,0); added async await for CELL_CONNECT execution

### 4.4 ESM Import Fixes
Fixed `require is not defined` in 8 `.mjs` test files by replacing CJS `require` with `createRequire`:
- test_bus_in_out.mjs, test_cell_connect_parse.mjs, test_cell_connection_route.mjs
- test_async_function_engine.mjs, test_0141_integration.mjs
- test_submodel_register.mjs, test_model_in_out.mjs, test_submodel_connect.mjs, test_0142_integration.mjs

### 4.5 Residual Symbol Grep
```
grep pinInSet|pinOutSet|pinInBindings|_pinKey|... → 0 matches in *.{js,mjs,json}
grep PIN_IN|PIN_OUT → only in legacy scripts (test data, comments, deprecated scripts)
```
PASS: No functional residual references.

## Step 5: E2E Verification

### test_0143_e2e.mjs — 5/5 PASS
1. no_legacy_pin_symbols: PASS
2. new_arch_symbols: PASS
3. model100_new_format_load: PASS
4. in_triggers_cell_connection: PASS
5. model100_full_flow: PASS (async CELL_CONNECT function execution)

### Regression Suite — 47/47 PASS
- test_cell_connect_parse: 10/10
- test_cell_connection_route: 4/4
- test_async_function_engine: 6/6
- test_0141_integration: 3/3
- test_bus_in_out: 7/7
- test_submodel_register: 4/4
- test_model_in_out: 6/6
- test_submodel_connect: 4/4
- test_0142_integration: 3/3

### validate_model100_records_e2e_v0.mjs — PASS
Full MBR → mqttIncoming → cell_connection → CELL_CONNECT → function flow verified.

## Step 6: Living Docs Update

Updated `docs/ssot/runtime_semantics_modeltable_driven.md`:
- Section 5.1: PIN_IN/PIN_OUT marked DEPRECATED with full list of deleted symbols
- Section 5.2: Replaced with current structural declaration list
- Section 5.2b IN row: Added `_routeViaCellConnection` (sync) before `_propagateCellConnect` (async)
- Section 5.2c: Updated BUS_IN description (removed "legacy PIN_IN" reference)
- Section 5.3: Replaced legacy PIN payload section with current MQTT payload format
- Section 5.4: Replaced legacy Direct-Path section with full routing chain diagram
- Section 3.2: Updated reverse-effect examples (BUS_IN, CELL_CONNECT, MQTT_WILDCARD_SUB)
- Section 6.1: Updated user-side entry from PIN_IN/PIN_OUT to BUS_IN/BUS_OUT + cell_connection + CELL_CONNECT
