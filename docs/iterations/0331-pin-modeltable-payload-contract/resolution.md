---
title: "0331 — pin-modeltable-payload-contract Resolution"
doc_type: iteration-resolution
status: completed
updated: 2026-04-24
source: ai
iteration_id: 0331-pin-modeltable-payload-contract
id: 0331-pin-modeltable-payload-contract
phase: phase4
---

# 0331 — pin-modeltable-payload-contract Resolution

## 0. Execution Rules
- Work branch: `dev_0331-0333-pin-payload-ui`
- This iteration is docs-only.
- Every step must be followed by sub-agent review with `codex-code-review`.
- Real execution evidence must go to `runlog.md`, not this file.
- User approval is recorded in `runlog.md`; do not stop for another human gate unless a blocker violates `CLAUDE.md`.

## 1. Steps Overview

| Step | Title | Scope (Short) | Files (Key) | Validation (Executable) | Acceptance Criteria | Rollback |
|------|-------|---------------|-------------|--------------------------|--------------------|----------|
| 1 | Freeze payload shape | Define pin payload and writeLabel temp model shape | `docs/ssot/temporary_modeltable_payload_v1.md`, `docs/ssot/program_model_pin_and_payload_contract_vnext.md` | `rg` contract checks | Canonical shape is unambiguous | Revert docs |
| 2 | Align host/runtime docs | Replace old object write request with ModelTable payload request | `docs/ssot/host_ctx_api.md`, `docs/ssot/runtime_semantics_modeltable_driven.md`, `docs/ssot/label_type_registry.md` | `rg` contract checks | No normative `{op, records}` writeLabel request remains | Revert docs |
| 3 | User guide and 0332 handoff | Explain fill-table-facing rule and implementation acceptance | `docs/user-guide/modeltable_user_guide.md`, `docs/iterations/0332-*` | `rg` and sub-agent review | 0332 has executable target | Revert docs |

## 2. Step Details

### Step 1 — Freeze payload shape
**Goal**
- Define all non-null `pin.*` and `pin.bus.*` business payloads as temporary ModelTable record arrays.

**Scope**
- Add `writeLabel` payload subsection:
  - `id = 0`
  - all records live at temporary `(0,0,0)`
  - metadata labels use `__mt_*`
  - exactly one non-`__mt_*` user label is allowed

**Files**
- Create/Update:
  - `docs/ssot/temporary_modeltable_payload_v1.md`
  - `docs/ssot/program_model_pin_and_payload_contract_vnext.md`
- Must NOT touch:
  - runtime code
  - system-model JSON

**Validation (Executable)**
- Commands:
  - `rg -n "__mt_payload_kind|__mt_target_cell|writeLabel" docs/ssot`
- Expected signals:
  - All required terms are present in SSOT docs.

**Acceptance Criteria**
- A reader can construct a valid `writeLabel` request without knowing legacy `{op, records}`.

**Rollback Strategy**
- Revert the edited docs.

---

### Step 2 — Align host/runtime docs
**Goal**
- Align host/runtime docs with the new pin payload contract.

**Scope**
- Replace normative write request object examples with temp ModelTable payload examples.
- Keep old object examples only as historical/deprecated if needed.

**Files**
- Create/Update:
  - `docs/ssot/host_ctx_api.md`
  - `docs/ssot/runtime_semantics_modeltable_driven.md`
  - `docs/ssot/label_type_registry.md`
- Must NOT touch:
  - runtime code

**Validation (Executable)**
- Commands:
  - `rg -n "op.*add_label|op.*write|records" docs/ssot/host_ctx_api.md docs/ssot/program_model_pin_and_payload_contract_vnext.md`
- Expected signals:
  - Normative current contract no longer teaches object-envelope writeLabel.

**Acceptance Criteria**
- `writeLabel` is documented as a user API that emits a ModelTable payload to an explicit write pin.

**Rollback Strategy**
- Revert the edited docs.

---

### Step 3 — User guide and 0332 handoff
**Goal**
- Turn the contract into implementation-ready acceptance criteria.

**Scope**
- Add user-facing explanation.
- Ensure 0332 plan/resolution requires tests, system-model migration, local deploy, and browser verification.

**Files**
- Create/Update:
  - `docs/user-guide/modeltable_user_guide.md`
  - `docs/iterations/0332-pin-modeltable-payload-implementation/plan.md`
  - `docs/iterations/0332-pin-modeltable-payload-implementation/resolution.md`
- Must NOT touch:
  - runtime code

**Validation (Executable)**
- Commands:
  - `rg -n "writeLabel|临时 ModelTable|pin payload" docs/user-guide/modeltable_user_guide.md docs/iterations/0332-pin-modeltable-payload-implementation`
- Expected signals:
  - User-facing guide and 0332 handoff both mention the same contract.

**Acceptance Criteria**
- 0332 can start without additional design decisions.

**Rollback Strategy**
- Revert docs.
