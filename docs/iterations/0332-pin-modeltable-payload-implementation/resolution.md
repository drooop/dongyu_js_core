---
title: "0332 — pin-modeltable-payload-implementation Resolution"
doc_type: iteration-resolution
status: completed
updated: 2026-04-24
source: ai
iteration_id: 0332-pin-modeltable-payload-implementation
id: 0332-pin-modeltable-payload-implementation
phase: phase4
---

# 0332 — pin-modeltable-payload-implementation Resolution

## 0. Execution Rules
- Work branch: `dev_0331-0333-pin-payload-ui`
- Execute after 0331 docs review is Approved.
- Each step must be followed by sub-agent `codex-code-review`; fix all Change Requested findings before next step.
- Evidence must be recorded in `runlog.md`.

## 1. Steps Overview

| Step | Title | Scope (Short) | Files (Key) | Validation (Executable) | Acceptance Criteria | Rollback |
|------|-------|---------------|-------------|--------------------------|--------------------|----------|
| 1 | Contract tests | Add failing tests for payload parser/writeLabel path | `scripts/tests/test_0332_*.mjs` | Node test expected fail before impl | Tests express 0331 contract | Revert tests |
| 2 | Runtime helper and V1N API | Implement payload builder/parser and `V1N.writeLabel` | `packages/worker-base/src/runtime.mjs`, helper module if needed | focused node tests | Single-label write passes; multi-label rejects | Revert runtime/helper |
| 3 | Default programs and system models | Migrate `mt_write`, `mt_bus_receive`, `Model 100`, slide import/create | `packages/worker-base/system-models/*.json` | focused tests + grep | No target path uses `{op, records}` | Revert JSON |
| 4 | Regression and deploy | Run deterministic suite, rebuild/deploy local stack | scripts + ops | baseline checks | Local stack ready | Redeploy previous branch |
| 5 | Browser E2E | Test Workspace color generator | Playwright/browser artifacts | Browser flow PASS | color changes after Generate | Revert branch or previous image |

## 2. Step Details

### Step 1 — Contract tests
**Goal**
- Make the desired behavior executable before implementation.

**Scope**
- Test valid temp ModelTable `writeLabel` payload.
- Test reject for multiple non-`__mt_*` user labels.
- Test reject for old object-envelope `mt_write_req` on the new contract path.

**Files**
- Create/Update:
  - `scripts/tests/test_0332_modeltable_pin_payload_contract.mjs`
- Must NOT touch:
  - runtime implementation

**Validation (Executable)**
- Commands:
  - `node scripts/tests/test_0332_modeltable_pin_payload_contract.mjs`
- Expected signals:
  - Fails before Step 2 for missing implementation.

**Acceptance Criteria**
- Test names map directly to 0331 contract.

**Rollback Strategy**
- Remove the new test file.

---

### Step 2 — Runtime helper and V1N API
**Goal**
- Implement temp ModelTable payload parsing and a constrained `V1N.writeLabel`.

**Scope**
- Add helper functions for:
  - `buildWriteLabelPayload`
  - `parseWriteLabelPayload`
  - `isTemporaryModelTablePayload`
- `V1N.writeLabel(p,r,c,{k,t,v})` emits a single-label temp payload to a current-cell write pin.
- Missing route writes visible `__error_write_label`.

**Files**
- Create/Update:
  - `packages/worker-base/src/runtime.mjs`
  - optional helper under `packages/worker-base/src/`
  - `scripts/tests/test_0332_modeltable_pin_payload_contract.mjs`
- Must NOT touch:
  - UI migration files

**Validation (Executable)**
- Commands:
  - `node scripts/tests/test_0332_modeltable_pin_payload_contract.mjs`
  - `node scripts/tests/test_0325_v1n_api_shape.mjs`
  - `node scripts/tests/test_0324_root_scaffold.mjs`
- Expected signals:
  - All PASS.

**Acceptance Criteria**
- Old API shape tests still pass, new API behavior passes.

**Rollback Strategy**
- Revert runtime/helper/test changes.

---

### Step 3 — Default programs and system models
**Goal**
- Move target system model paths from object write request to temp ModelTable payload.

**Scope**
- Update `default_table_programs.json`.
- Update Model 100 and slide create/import routing in `workspace_positive_models.json`.
- Update fixture patches if tests depend on copied model assets.

**Files**
- Create/Update:
  - `packages/worker-base/system-models/default_table_programs.json`
  - `packages/worker-base/system-models/workspace_positive_models.json`
  - `packages/worker-base/system-models/test_model_100_ui.json`
  - relevant tests
- Must NOT touch:
  - unrelated dirty iteration files

**Validation (Executable)**
- Commands:
  - `rg -n "V1N.addLabel\\('mt_write_req', 'pin.in', \\{ op|\\\"op\\\": \\\"write\\\"" packages/worker-base/system-models`
  - `node scripts/tests/test_0182_model100_submit_chain_contract.mjs`
  - `node scripts/tests/test_0329_renderer_singleflight_release.mjs` if present
  - `node scripts/tests/test_0332_modeltable_pin_payload_contract.mjs`
- Expected signals:
  - No target-path object write request remains; tests PASS.

**Acceptance Criteria**
- Current Model 100 path is migrated and testable.

**Rollback Strategy**
- Revert edited system-model JSON and related tests.

---

### Step 4 — Regression and deploy
**Goal**
- Prove deterministic local checks and refresh local deployment before UI validation.

**Scope**
- Run required runtime and frontend checks.
- Build frontend if UI-facing output changed.
- Redeploy/restart local stack through approved scripts.

**Files**
- Create/Update:
  - runlog only unless fixes are needed

**Validation (Executable)**
- Commands:
  - `node scripts/tests/test_cell_connect_parse.mjs`
  - `node scripts/tests/test_bus_in_out.mjs`
  - `node scripts/validate_builtins_v0.mjs`
  - `node scripts/validate_ui_ast_v0x.mjs --case all`
  - `npm -C packages/ui-model-demo-frontend run build`
  - `bash scripts/ops/check_runtime_baseline.sh`
  - `bash scripts/ops/ensure_runtime_baseline.sh`
- Expected signals:
  - PASS or explicit repaired rerun.

**Acceptance Criteria**
- Local deployed stack reflects current branch.

**Rollback Strategy**
- Re-run baseline from previous dev if deployment fails.

---

### Step 5 — Browser E2E
**Goal**
- Confirm user-facing color generator still works through deployed Workspace.

**Scope**
- Navigate to `http://127.0.0.1:30900/#/workspace`.
- Select/open `E2E 颜色生成器`.
- Click Generate and confirm color value changes and loading releases.

**Files**
- Create/Update:
  - `docs/iterations/0332-pin-modeltable-payload-implementation/assets/` for screenshots if needed
  - runlog

**Validation (Executable)**
- Commands:
  - Playwright/browser automation against `http://127.0.0.1:30900/#/workspace`
- Expected signals:
  - Color changes after click; button not stuck loading.

**Acceptance Criteria**
- Browser evidence proves deployed UI path, not just direct service calls.

**Rollback Strategy**
- Revert branch changes and redeploy previous baseline.
