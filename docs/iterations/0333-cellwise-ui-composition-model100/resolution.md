---
title: "0333 — cellwise-ui-composition-model100 Resolution"
doc_type: iteration-resolution
status: completed
updated: 2026-04-24
source: ai
iteration_id: 0333-cellwise-ui-composition-model100
id: 0333-cellwise-ui-composition-model100
phase: phase4
---

# 0333 — cellwise-ui-composition-model100 Resolution

## 0. Execution Rules
- Work branch: `dev_0331-0333-pin-payload-ui`
- Execute after 0332 local deployed E2E is PASS.
- Each step must be followed by sub-agent `codex-code-review`.
- Evidence must be recorded in `runlog.md`.

## 1. Steps Overview

| Step | Title | Scope (Short) | Files (Key) | Validation (Executable) | Acceptance Criteria | Rollback |
|------|-------|---------------|-------------|--------------------------|--------------------|----------|
| 1 | UI composition docs/tests | Freeze containment/model composition rules and add tests | docs + `scripts/tests/test_0333_*.mjs` | Node test | Rules are executable | Revert docs/tests |
| 2 | Projection support | Adjust cellwise projection if needed | `packages/ui-model-demo-frontend/src/ui_cellwise_projection.js` | focused tests | Layout/props projected | Revert frontend |
| 3 | Model 100 cellwise migration | Replace schema projection source with node cells | `packages/worker-base/system-models/workspace_positive_models.json` | focused tests | Model 100 uses cellwise | Revert JSON |
| 4 | Regression and browser E2E | Build, deploy, test Workspace | frontend + ops + browser | build/baseline/browser | Generate works | Revert branch/deploy previous |

## 2. Step Details

### Step 1 — UI composition docs/tests
**Goal**
- Make row/column containment rules explicit and executable.

**Scope**
- Document:
  - `ui_parent` = visual containment
  - `ui_order` = sibling order
  - `ui_layout` = container child layout
  - `ui_slot` = named region only
  - `model.submt` = independent child model/app only
- Add projection tests for nested rows/columns.

**Files**
- Create/Update:
  - `docs/user-guide/modeltable_user_guide.md`
  - `docs/user-guide/ui_components_v2.md`
  - `scripts/tests/test_0333_cellwise_ui_composition_contract.mjs`
- Must NOT touch:
  - Model 100 data yet

**Validation (Executable)**
- Commands:
  - `node scripts/tests/test_0333_cellwise_ui_composition_contract.mjs`
- Expected signals:
  - Test fails before required projection/model changes if missing.

**Acceptance Criteria**
- Tests express the user examples: one row with three buttons, another row with nested input column.

**Rollback Strategy**
- Revert docs/tests.

---

### Step 2 — Projection support
**Goal**
- Ensure current `cellwise.ui.v1` projection supports the needed layout and label-driven props.

**Scope**
- Keep changes minimal; prefer existing `ui_parent/ui_order/ui_layout` semantics.
- Add only missing prop mapping required by tests.

**Files**
- Create/Update:
  - `packages/ui-model-demo-frontend/src/ui_cellwise_projection.js`
  - `scripts/tests/test_0333_cellwise_ui_composition_contract.mjs`
- Must NOT touch:
  - renderer component implementations unless a registry mismatch blocks rendering.

**Validation (Executable)**
- Commands:
  - `node scripts/tests/test_0333_cellwise_ui_composition_contract.mjs`
  - `npm -C packages/ui-model-demo-frontend run test`
- Expected signals:
  - PASS.

**Acceptance Criteria**
- Projection AST changes when UI label values change.

**Rollback Strategy**
- Revert frontend/test changes.

---

### Step 3 — Model 100 cellwise migration
**Goal**
- Make `E2E 颜色生成器` a real fill-table/cellwise UI example.

**Scope**
- Add root `ui_authoring_version` and `ui_root_node_id`.
- Split UI into independent cells:
  - root container
  - title text
  - status strip
  - color preview row
  - input row
  - generate button row
  - optional diagnostics row
- Preserve `submit_request` writable pin metadata.

**Files**
- Create/Update:
  - `packages/worker-base/system-models/workspace_positive_models.json`
  - `packages/worker-base/system-models/test_model_100_ui.json`
  - `scripts/tests/test_0333_model100_cellwise_contract.mjs`
- Must NOT touch:
  - unrelated positive models except shared registry if required.

**Validation (Executable)**
- Commands:
  - `node scripts/tests/test_0333_model100_cellwise_contract.mjs`
  - `node scripts/tests/test_0182_model100_submit_chain_contract.mjs`
- Expected signals:
  - PASS.

**Acceptance Criteria**
- Test proves `buildAstFromCellwiseModel(snapshot, 100)` returns the active AST.

**Rollback Strategy**
- Revert Model 100 JSON/test changes.

---

### Step 4 — Regression and browser E2E
**Goal**
- Verify all user-facing behavior after UI migration.

**Scope**
- Build frontend.
- Redeploy local stack.
- Browser-test Workspace.

**Files**
- Create/Update:
  - runlog
  - optional assets under `docs/iterations/0333-cellwise-ui-composition-model100/assets/`

**Validation (Executable)**
- Commands:
  - `npm -C packages/ui-model-demo-frontend run build`
  - `bash scripts/ops/check_runtime_baseline.sh`
  - `bash scripts/ops/ensure_runtime_baseline.sh`
  - Browser automation against `http://127.0.0.1:30900/#/workspace`
- Expected signals:
  - Build/baseline PASS.
  - Browser shows label-driven title and Generate changes color.

**Acceptance Criteria**
- User can modify Model 100 cellwise labels to affect the UI without code changes.

**Rollback Strategy**
- Revert branch and redeploy previous baseline.
