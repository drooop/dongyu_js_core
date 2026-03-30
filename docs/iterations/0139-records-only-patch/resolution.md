---
title: "Iteration 0139-records-only-patch Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-03-21
source: ai
iteration_id: 0139-records-only-patch
id: 0139-records-only-patch
phase: phase1
---

# Iteration 0139-records-only-patch Resolution

## 0. Execution Rules
- Work branch: dev_0139-records-only-patch
- Steps must be executed in order.
- No step skipping; no bundling multiple steps into one commit.
- Each step must have executable validation.
- Any real execution evidence must go to [[iterations/0139-records-only-patch/runlog]] (NOT here).

## 1. Steps Overview

| Step | Title | Scope (Short) | Files (Key) | Validation (Executable) | Acceptance Criteria | Rollback |
|------|-------|---------------|-------------|--------------------------|--------------------|----------|
| 1    | Register + docs sync | Register iteration; align handover doc with runtime semantics | `docs/ITERATIONS.md`, `docs/handover/dam-worker-guide.md` | `git diff -- __DY_PROTECTED_WL_1__ docs/handover/dam-worker-guide.md` | Iteration registered; docs state three-path semantics and trigger gating clearly | Revert doc changes |
| 2    | Runtime mqttIncoming three-path | mt.v0 records applyPatch + optional trigger + fallback | `packages/worker-base/src/runtime.js`, `packages/worker-base/src/runtime.mjs` | `node -c` (N/A for mjs), `lsp_diagnostics` | records non-empty applies patch; trigger only when binding trigger_funcs exist; records empty falls back | Revert runtime changes |
| 3    | Validation case | Add records-mode test coverage | `scripts/validate_pin_mqtt_loop.mjs` | `node scripts/validate_pin_mqtt_loop.mjs --case records_only_patch` | New case passes and covers trigger_funcs behavior | Revert script change |
| 4    | Verification closure | Diagnostics + scripted validation; record in runlog | `docs/iterations/0139-records-only-patch/runlog.md` | `lsp_diagnostics` + validate script | PASS recorded with commands + outputs snippets | Revert to pre-0139 state |

## 2. Step Details

### Step 1 — Register + docs sync
**Goal**
- Register 0139 in the authoritative iterations index and ensure docs reflect the chosen three-path delivery model.

**Scope**
- Register `0139-records-only-patch` in `docs/ITERATIONS.md`.
- Update `docs/handover/dam-worker-guide.md` to document the runtime behavior and trigger constraints.

**Files**
- Create/Update:
  - `docs/ITERATIONS.md`
  - `docs/handover/dam-worker-guide.md`
- Must NOT touch:
  - Unrelated iterations

**Validation (Executable)**
- Commands:
  - `git diff -- __DY_PROTECTED_WL_2__ docs/handover/dam-worker-guide.md`
- Expected signals:
  - Diff shows only intended iteration/doc changes.

**Acceptance Criteria**
- `docs/ITERATIONS.md` contains the 0139 entry.
- Doc explains that PIN_IN binding trigger_funcs only fire on `label.t === 'IN'` and therefore requires an explicit trigger label in records-mode.

**Rollback Strategy**
- Revert the two docs.

---

### Step 2 — Runtime mqttIncoming three-path
**Goal**
- Implement mt.v0 inbound handling: records are executed via applyPatch, and functions are triggered only when explicitly configured.

**Scope**
- When payload is mt.v0 and `records.length > 0`:
  - `applyPatch(payload, { allowCreateModel: false })`
  - If the incoming pin has binding `trigger_funcs`, emit a separate `t:'IN'` trigger label at the pin delivery target.
- When payload is mt.v0 and `records.length === 0`: fallback to legacy `t:'IN'` label with full payload.

**Files**
- Update:
  - `packages/worker-base/src/runtime.js`
  - `packages/worker-base/src/runtime.mjs`

**Validation (Executable)**
- Commands:
  - `node scripts/validate_pin_mqtt_loop.mjs --case records_only_patch`

**Acceptance Criteria**
- Records-mode applies records without creating models.
- Trigger label does not overwrite request parameters (i.e., it must not reuse the same `k` as parameter labels like `action`).

**Rollback Strategy**
- Revert both runtime files.

---

### Step 3 — Validation case
(同上结构复制)

---

### Step 4 — Verification closure
(同上结构复制)

> 禁止在本文件记录 PASS/FAIL、命令输出、commit hash。
