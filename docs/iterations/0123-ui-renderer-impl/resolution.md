# Iteration 0123-ui-renderer-impl Resolution

## 0. Execution Rules
- Work branch: dev_0123-ui-renderer-impl
- Steps must be executed in order.
- No step skipping; no bundling multiple steps into one commit.
- Each step must have executable validation.
- Any real execution evidence must go to runlog.md (NOT here).

## 1. Steps Overview

| Step | Title | Scope (Short) | Files (Key) | Validation (Executable) | Acceptance Criteria | Rollback |
|------|-------|---------------|-------------|--------------------------|--------------------|----------|
| 1    | UI Renderer v0 | AST render + event wiring | packages/ui-renderer/** | `node scripts/validate_ui_renderer_v0.mjs --case render_minimal --env jsdom` | Renders AST v0 + event writes follow spec | Revert Step 1 changes |
| 2    | Validation PASS | Scripted validation | docs/iterations/0123-ui-renderer-impl/runlog.md | `node scripts/validate_ui_renderer_v0.mjs --case all --env jsdom` | runlog records PASS with outputs | Re-run validations |

## 2. Step Details

### Step 1 — UI Renderer v0
**Goal**
- Implement a Vue3 + Element Plus renderer for AST v0 minimal node set.

**Scope**
- AST v0 minimal node set only.
- Event normalization MUST follow Stage 3.1 spec (no new event label conventions).
- Renderer host access is limited to injected adapter (snapshot + dispatch add_label/rm_label).
- No runtime/built-in semantics changes.

**Files**
- Create/Update:
  - `packages/ui-renderer/` (new)
  - `packages/ui-renderer/src/renderer.ts`
  - `packages/ui-renderer/src/index.ts`
  - `scripts/validate_ui_renderer_v0.mjs`
- Must NOT touch:
  - worker runtime semantics or built-in behavior

**Validation (Executable)**
- Commands:
  - `node scripts/validate_ui_renderer_v0.mjs --case render_minimal --env jsdom`
- Expected signals:
  - Rendered output structure matches AST v0
  - Event writes match Stage 3.1 spec label structure

**Acceptance Criteria**
- Renderer follows AST spec, host adapter contract, and event contract

**Rollback Strategy**
- Revert Step 1 changes

---

### Step 2 — Validation PASS
**Goal**
- Execute validation cases and record PASS.

**Scope**
- Scripted validation only (no manual UI); jsdom-based harness.

**Files**
- Create/Update:
  - `docs/iterations/0123-ui-renderer-impl/runlog.md`
- Must NOT touch:
  - runtime/bus/UI behavior beyond AST v0

**Validation (Executable)**
- Commands:
  - `node scripts/validate_ui_renderer_v0.mjs --case all --env jsdom`
- Expected signals:
  - render_minimal PASS
  - event_write PASS (dispatchWrite invoked with spec-compliant payload)

**Acceptance Criteria**
- runlog includes PASS evidence for render_minimal + event_write

**Rollback Strategy**
- Re-run validations and update runlog

> 禁止在本文件记录 PASS/FAIL、命令输出、commit hash。
