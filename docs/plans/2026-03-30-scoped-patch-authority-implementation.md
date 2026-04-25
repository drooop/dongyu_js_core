---
title: "Scoped Patch Authority Implementation Plan"
doc_type: note
status: active
updated: 2026-04-21
source: ai
---

# Scoped Patch Authority Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace runtime-wide patch authority with model-scoped helper execution so dual-bus return paths and user-authored program models cannot bypass hierarchy and model ownership.

**Architecture:** Freeze a new authority model where bootstrap loaders keep global patch ability, but runtime handlers and user-authored program models can only request current-model materialization through reserved helper cells. Migrate dual-bus return paths, system-model JSON patches, and deploy patches to this helper-mediated contract, then redeploy and verify on the live local stack.

**Tech Stack:** Node.js runtime (`runtime.mjs`, `server.mjs`), system-model JSON patches, deploy patches, script-based tests, local Docker/K8s deployment scripts.

---

### Task 1: Freeze SSOT and iteration documents

**Files:**
- Modify: `docs/ssot/runtime_semantics_modeltable_driven.md`
- Modify: `docs/ssot/host_ctx_api.md`
- Modify: `docs/ssot/label_type_registry.md`
- Modify: `docs/user-guide/modeltable_user_guide.md`
- Create: `docs/iterations/0266-scoped-patch-authority/plan.md`
- Create: `docs/iterations/0266-scoped-patch-authority/resolution.md`
- Create: `docs/iterations/0266-scoped-patch-authority/runlog.md`

**Step 1: Write the failing docs-contract test**

Write a new script test that asserts:
- runtime SSOT mentions scoped patch only for current model
- host ctx API no longer grants runtime-wide patch access
- label registry reserves helper executor/request/result labels or reserved helper cell convention

**Step 2: Run test to verify it fails**

Run: `node scripts/tests/test_0266_scoped_patch_docs_contract.mjs`
Expected: FAIL because current docs still allow or imply broader runtime access.

**Step 3: Update SSOT docs minimally**

Document:
- reserved helper executor cell convention
- user program restriction to pin/helper invocation only
- bootstrap-only global patch
- scoped patch semantics
- deployment-after-change verification rule for this migration

**Step 4: Re-run docs-contract test**

Run: `node scripts/tests/test_0266_scoped_patch_docs_contract.mjs`
Expected: PASS

**Step 5: Commit**

```bash
git add docs/ssot/runtime_semantics_modeltable_driven.md docs/ssot/host_ctx_api.md docs/ssot/label_type_registry.md docs/user-guide/modeltable_user_guide.md docs/iterations/0266-scoped-patch-authority
git commit -m "docs(runtime): freeze scoped patch authority contract [0266]"
```

### Task 2: Gate runtime patch authority

**Files:**
- Modify: `packages/worker-base/src/runtime.mjs`
- Modify: `packages/worker-base/src/runtime.js`
- Test: `scripts/tests/test_0266_scoped_patch_runtime_contract.mjs`
- Reference: `scripts/tests/test_0245_scoped_privilege_runtime_contract.mjs`

**Step 1: Write the failing runtime contract test**

Cover:
- runtime handler/user-visible ctx cannot call global applyPatch
- scoped patch rejects mixed-model records
- scoped patch rejects `create_model`
- scoped patch accepts same-model record updates

**Step 2: Run test to verify it fails**

Run: `node scripts/tests/test_0266_scoped_patch_runtime_contract.mjs`
Expected: FAIL on current runtime.

**Step 3: Implement minimal runtime gate**

Add:
- internal bootstrap-only patch path remains unchanged
- scoped patch API with same-model enforcement
- removal or sealing of runtime-wide patch access from runtime handler surfaces

Keep CJS and ESM behavior aligned.

**Step 4: Re-run runtime tests**

Run:
- `node scripts/tests/test_0266_scoped_patch_runtime_contract.mjs`
- `node scripts/tests/test_0245_scoped_privilege_runtime_contract.mjs`

Expected: PASS

**Step 5: Commit**

```bash
git add packages/worker-base/src/runtime.mjs packages/worker-base/src/runtime.js scripts/tests/test_0266_scoped_patch_runtime_contract.mjs
git commit -m "fix(runtime): gate patch authority to model scope [0266]"
```

### Task 3: Introduce reserved helper cell contract

**Files:**
- Modify: `packages/worker-base/system-models/*.json` (only templates/authoritative shared model definitions)
- Modify: `packages/ui-model-demo-server/filltable_policy.mjs`
- Test: `scripts/tests/test_0266_helper_cell_contract.mjs`

**Step 1: Write the failing helper contract test**

Assert:
- new models or authoritative templates include reserved helper cell convention
- helper request/result labels are structurally valid
- user-exposed policy does not offer direct patch helper bypass

**Step 2: Run test to verify it fails**

Run: `node scripts/tests/test_0266_helper_cell_contract.mjs`
Expected: FAIL

**Step 3: Add helper cell scaffolding**

Define:
- reserved cell position
- request/result pin names
- default helper function contract
- fill-table policy updates so user code cannot directly request illegal structural patch authority

**Step 4: Re-run helper contract test**

Run: `node scripts/tests/test_0266_helper_cell_contract.mjs`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/worker-base/system-models packages/ui-model-demo-server/filltable_policy.mjs scripts/tests/test_0266_helper_cell_contract.mjs
git commit -m "feat(runtime): add reserved helper cell scaffold [0266]"
```

### Task 4: Migrate dual-bus return path off direct applyPatch

**Files:**
- Modify: `packages/ui-model-demo-server/server.mjs`
- Modify: `packages/worker-base/system-models/test_model_100_ui.json`
- Modify: related authoritative dual-bus model patches discovered by repo audit
- Test: `scripts/tests/test_0266_dual_bus_return_conformance.mjs`
- Reference: `scripts/tests/test_0182_model100_submit_chain_contract.mjs`
- Reference: `scripts/validate_model100_records_e2e_v0.mjs`

**Step 1: Write the failing dual-bus conformance test**

Assert:
- `handleDyBusEvent()` no longer direct-applies cross-model patch
- model100 return handler no longer uses `ctx.runtime.applyPatch`
- return path ends at helper request pin / scoped materialization path

**Step 2: Run test to verify it fails**

Run:
- `node scripts/tests/test_0266_dual_bus_return_conformance.mjs`
- `node scripts/validate_model100_records_e2e_v0.mjs`

Expected: FAIL

**Step 3: Implement minimal conformance migration**

Change:
- server return path writes only formal relay/input data
- child model helper performs same-model scoped materialization
- remove direct patch bypass comments and code

**Step 4: Re-run focused conformance tests**

Run:
- `node scripts/tests/test_0266_dual_bus_return_conformance.mjs`
- `node scripts/tests/test_0182_model100_submit_chain_contract.mjs`
- `node scripts/validate_model100_records_e2e_v0.mjs`

Expected: PASS

**Step 5: Commit**

```bash
git add packages/ui-model-demo-server/server.mjs packages/worker-base/system-models/test_model_100_ui.json scripts/tests/test_0266_dual_bus_return_conformance.mjs scripts/validate_model100_records_e2e_v0.mjs
git commit -m "fix(dual-bus): remove direct return-path patch bypass [0266]"
```

### Task 5: Audit and upgrade all affected JSON patches

**Files:**
- Modify: `packages/worker-base/system-models/**/*.json`
- Modify: `deploy/sys-v1ns/**/*.json`
- Modify: any authoritative fixtures consumed in production/runtime validation
- Test: `scripts/tests/test_0266_json_patch_upgrade_audit.mjs`

**Step 1: Write the failing audit test**

Scan repo JSON/model patches for:
- direct patch helper assumptions
- missing reserved helper cell where required
- legacy return-path materialization patterns that bypass scoped helper flow

**Step 2: Run test to verify it fails**

Run: `node scripts/tests/test_0266_json_patch_upgrade_audit.mjs`
Expected: FAIL and print remaining files.

**Step 3: Upgrade audited JSON patches**

Perform a complete repo audit of authoritative JSON patches and migrate every affected one, not just `Model 100`.

**Step 4: Re-run audit**

Run: `node scripts/tests/test_0266_json_patch_upgrade_audit.mjs`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/worker-base/system-models deploy/sys-v1ns scripts/tests/test_0266_json_patch_upgrade_audit.mjs
git commit -m "refactor(models): migrate patches to scoped helper flow [0266]"
```

### Task 6: Full regression and live redeploy verification

**Files:**
- Modify if needed: `docs/iterations/0266-scoped-patch-authority/runlog.md`
- Optional docs updates if verification reveals missing operator guidance

**Step 1: Run deterministic regression set**

Run:
- `node scripts/tests/test_0266_scoped_patch_docs_contract.mjs`
- `node scripts/tests/test_0266_scoped_patch_runtime_contract.mjs`
- `node scripts/tests/test_0266_helper_cell_contract.mjs`
- `node scripts/tests/test_0266_dual_bus_return_conformance.mjs`
- `node scripts/tests/test_0266_json_patch_upgrade_audit.mjs`
- `node scripts/tests/test_0182_model100_submit_chain_contract.mjs`
- `node scripts/tests/test_0144_remote_worker.mjs`
- `node scripts/tests/test_0215_ui_model_tier2_examples_contract.mjs`
- `node scripts/tests/test_0216_threejs_scene_contract.mjs`

Expected: all PASS

**Step 2: Redeploy local stack before acceptance**

Run:
- `bash scripts/ops/check_runtime_baseline.sh`
- `SKIP_MATRIX_BOOTSTRAP=1 bash scripts/ops/deploy_local.sh`
- `bash scripts/ops/check_runtime_baseline.sh`

Expected: baseline ready

**Step 3: Verify live UI/runtime behavior**

Run:
- `curl -fsS http://localhost:30900/snapshot`
- Playwright verification on the live workspace pages that use dual-bus return paths

Expected:
- no direct bypass path needed
- live UI still round-trips correctly
- updated labels materialize through scoped helper flow

**Step 4: Commit final verification/docs adjustments**

```bash
git add docs/iterations/0266-scoped-patch-authority/runlog.md
git commit -m "test(runtime): verify scoped helper migration live [0266]"
```
