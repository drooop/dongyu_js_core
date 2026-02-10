# 0142 — Runlog (FACTS)

## Environment
- Runtime: bun
- Branch: dev_0142-bus-model-boundary
- Base: dev_0141-cell-connect-engine (commit 80868b3)

---

## Step 1: BUS_IN/BUS_OUT
- Files: `packages/worker-base/src/runtime.js` (constructor + _applyBuiltins BUS_IN/BUS_OUT dispatch + _handleBusInMessage + mqttIncoming BUS_IN short-circuit + _subscribeDeclaredPinsOnStart BUS_IN subscription)
- Test: `bun scripts/tests/test_bus_in_out.mjs`
- Result: 7/7 PASS

## Step 2: subModel + parentChildMap
- Files: `packages/worker-base/src/runtime.js` (constructor + _applyBuiltins subModel dispatch)
- Test: `bun scripts/tests/test_submodel_register.mjs`
- Result: 4/4 PASS

## Step 3: MODEL_IN/MODEL_OUT
- Files: `packages/worker-base/src/runtime.js` (_applyBuiltins MODEL_IN/MODEL_OUT dispatch)
- Test: `bun scripts/tests/test_model_in_out.mjs`
- Result: 6/6 PASS

## Step 4: Numeric prefix routing
- Files: `packages/worker-base/src/runtime.js` (_propagateCellConnect numeric prefix branch)
- Test: `bun scripts/tests/test_submodel_connect.mjs`
- Result: 4/4 PASS

## Step 5: Model 0 framework + Integration
- Fixture: `scripts/tests/fixtures/test_model0_framework.json`
- Test: `bun scripts/tests/test_0142_integration.mjs`
- Result: 3/3 PASS

## Step 5b: runtime.mjs Sync
- Synced all 0142 changes to runtime.mjs (constructor fields, _handleBusInMessage, _applyBuiltins dispatch, mqttIncoming short-circuit, _subscribeDeclaredPinsOnStart, _propagateCellConnect numeric prefix)

## Step 5c: Regression Tests
- 0141 tests: 23/23 PASS
- `bun scripts/validate_builtins_v0.mjs` → 10/10 PASS
- `bun scripts/validate_program_model_loader_v0.mjs` → 5/5 PASS
- `bun scripts/validate_modeltable_persistence_v0.mjs` → 1/1 PASS

## Step 6: Living Docs
- Updated: `docs/ssot/runtime_semantics_modeltable_driven.md` §5.2c-f (BUS_IN/OUT, MODEL_IN/OUT, subModel, Bootstrap)
- Updated: §5.2b numeric target from "预留 0142" to "路由到子模型 MODEL_IN（0142 实现）"

---

## Summary
- All tests PASS: 24 new + 39 regression = 63 total
- Status: **PASS**
