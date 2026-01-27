Charter: docs/charters/dongyu_app_next_runtime.md
SSOT: docs/architecture_mantanet_and_workers.md

# Dongyu App Next Runtime – Execution Roadmap

> This document is a **stateful execution roadmap**.
> It is used by `$doit-auto` to plan, track, and validate long-running work.
>
> - It does NOT replace SSOT.
> - It does NOT replace the Project Charter.
> - It records **where we are**, **what is done**, and **what is next**.

---

## Roadmap Meta

- Roadmap ID: dongyu-app-next-runtime-elysia
- SSOT: docs/architecture_mantanet_and_workers.md
- Charter: docs/charters/dongyu_app_next_runtime.md
- Behavior Oracle: PICtest (vendor/PICtest or vender/PICtest)
- Execution Mode: `$doit` + `$doit-auto`
- Last Updated: 2026-01-27

## Evidence & Final Test Case
- 程序模型注册/加载过程（证据指针）：
  - [PICtest PIN_IN/PIN_OUT 与程序模型触发机制（理解记录）](../concepts/pictest_pin_and_program_model.md)
  - [V1N / PICtest 软件工人基座：概念与实现理解](../v1n_concept_and_implement.md)
- 最终测试用例（程序模型加载、PIN_IN、运行时触发）：
  - [test_files/test7/main.py](../../test_files/test7/main.py)
  - [test_files/test7/yhl.db](../../test_files/test7/yhl.db)

---

## Current State

- Current Phase: Phase 2 – JS Worker Base Minimal Loop (Stage 2.5)
- Current Iteration: 0127-program-model-loader-v0 (completed) / next: TBD (propose 0128-function-exec-v0)
- Last Completed Checkpoint: Stage 2.4 completed (0127-program-model-loader-v0)
- Blockers: None

---

# Phase 0 – Governance & Constraints (COMPLETED)

## Description
Establish SSOT, Charter, execution workflow, and behavioral oracle.
No runtime or UI implementation is allowed.

### Checkpoints
- [x] SSOT (`architecture_mantanet_and_workers.md`) locked
- [x] Project Charter created
- [x] `$doit` and `$doit-auto` installed
- [x] PICtest identified as behavior oracle

### Status
- Status: COMPLETED
- Completed In: Pre-Roadmap

---

# Phase 1 – PICtest Behavior Evidence (CRITICAL)

## Goal
Make Python runtime behavior explicit, documentable, and verifiable.

---

## Stage 1.1 – PICtest Evidence Extraction

### Description
Extract observable behavior of built-in `k`, triggers, and PIN semantics
from PICtest.

### Deliverables
- Behavior tables for each built-in `k`
- Trigger conditions and side effects
- Error and idempotency behavior
- Reference file paths and symbols

### Checkpoints
- [ ] All built-in `k` listed
- [ ] Each `k` has:
  - [ ] Input conditions
  - [ ] Output side effects
  - [ ] Error semantics
- [ ] Evidence linked to PICtest source paths
- [ ] No new behavior invented

### Status
- Status: COMPLETED
- Iteration ID: 0122-pictest-evidence
- Verified By: manual

---

## Stage 1.2 – Oracle Test Harness Plan

### Description
Define how JS runtime behavior will be validated against PICtest.

### Deliverables
- Input equivalence definition
- Output equivalence rules
- Allowed vs forbidden divergence
- Test harness structure

### Checkpoints
- [ ] Input equivalence rules defined
- [ ] Output comparison rules defined
- [ ] Error equivalence rules defined
- [ ] PASS/FAIL criteria explicit

### Status
- Status: COMPLETED
- Iteration ID: 0122-oracle-harness-plan
- Verified By: manual

---

# Phase 2 – JS Worker Base Minimal Loop (NO UI)

## Goal
Reproduce PICtest behavior in JS using Bun/Elysia with ModelTable.

---

## Stage 2.1 – ModelTable Runtime v0

### Description
Implement ModelTable core with fixed `p/r/c/k/t/v`.

### Checkpoints
- [ ] Cell structure enforced
- [ ] Deterministic update semantics
- [ ] Change detection available

### Status
- Status: COMPLETED
- Iteration ID: 0123-modeltable-runtime-v0
- Verified By: manual

---

## Stage 2.2 – Program Model Built-ins v0

### Description
Implement built-in `k` based strictly on PICtest evidence.

### Checkpoints
- [ ] Each implemented `k` maps to evidence table
- [ ] No extra behavior
- [ ] Errors written to ModelTable

### Status
- Status: COMPLETED
- Iteration ID: 0123-builtins-v0-impl
- Verified By: validation_protocol + runlog PASS

---

## Stage 2.3 – PIN_IN / PIN_OUT + MQTT Loop

### Description
Implement control bus semantics using local Docker MQTT.

### Checkpoints
- [ ] MQTT → PIN_IN writes cell
- [ ] PIN_OUT publishes MQTT
- [ ] MQTT config sourced from page0/args

### Status
- Status: COMPLETED
- Iteration ID: 0123-pin-mqtt-loop
- Verified By: validation_protocol + runlog PASS

---

## Stage 2.4 – Program Model Loader v0 (sqlite replay)

### Description
Load `yhl.db` (sqlite `mt_data`) and replay ModelTable through `add_label`/`rm_label` to rebuild in-memory state.
This stage is a prerequisite for `test_files/test7` end-to-end worker-base validation.

### Checkpoints
- [ ] Load `mt_data` into ModelTableRuntime (multi-model)
- [ ] Deterministic replay order and EventLog monotonicity
- [ ] Function label registration exists (minimal)
- [ ] `run_<func>` gating matches evidence preconditions (no silent fail)
- [ ] Validation script exists and PASS against `test_files/test7/yhl.db`

### Status
- Status: COMPLETED
- Iteration ID: 0127-program-model-loader-v0
- Verified By: validation_protocol + runlog PASS

---

## Stage 2.5 – Function Execution Engine v0 (PICtest behavior closure)

### Description
Implement minimal function execution semantics to close the observable chain:
`RunLabel/run_<func>` / pin_callin entry → `Function.handle_call` → `Function.run` → result writeback/propagation.
This stage must follow PICtest Level-A evidence; do not invent semantics.

### Checkpoints
- [ ] Implement `Function.handle_call` and `Function.run` observable behavior (Level A)
- [ ] Implement `pin_callin` / `pin_callout` minimal semantics (Level A)
- [ ] Implement `not_function_call` behavior boundary (Model.add_method wrapper)
- [ ] Errors are recorded (EventLog + error labels), no silent fail
- [ ] Scripted validation exists and PASS

### Status
- Status: PENDING
- Iteration ID: TBD (propose 0128-function-exec-v0)

---

## Stage 2.6 – Worker Base v0 End-to-End (test7)

### Description
Make `test_files/test7` the single end-to-end gate:
load `yhl.db` + register minimal JS cellcode + drive PIN_IN → trigger execution → observe PIN_OUT + ModelTable mutations.

### Checkpoints
- [ ] End-to-end script runs from a single command
- [ ] Covers: load db → start mqtt loop (mock ok) → mqttIncoming → function run → mqtt publish
- [ ] Includes negative cases (missing function / invalid label)
- [ ] Evidence-driven PASS/FAIL matches PICtest observable behavior

### Status
- Status: PENDING
- Iteration ID: TBD (propose 0128-test7-e2e-workerbase)

---

## Phase 2 Completion Criteria (JS Worker Base v0)

Phase 2 is COMPLETE when all Stage 2.x are COMPLETED and the following scripts PASS:
- `node scripts/validate_builtins_v0.mjs`
- `node scripts/validate_pin_mqtt_loop.mjs --case all`
- `bun scripts/validate_program_model_loader_v0.mjs --case all --db test_files/test7/yhl.db`
- `bun scripts/validate_worker_base_v0.mjs --case all` (to be added in Stage 2.6)

---

# Phase 3 – UI AST & Sliding UI (WRITE-CELL ONLY)

## Goal
Introduce UI without introducing execution authority.

---

## Stage 3.1 – UI AST Specification

### Checkpoints
- [ ] AST node types defined
- [ ] Binding rules to ModelTable defined
- [ ] Event normalization rules defined

### Status
- Status: COMPLETED
- Iteration ID: 0123-ui-ast-spec
- Verified By: runlog PASS

---

## Stage 3.2 – Vue / Element Plus Renderer

### Checkpoints
- [ ] AST → Vue rendering works
- [ ] UI reads only from ModelTable
- [ ] UI events only write cells

### Status
- Status: COMPLETED
- Iteration ID: 0123-ui-renderer-impl
- Verified By: runlog PASS (jsdom)

---

# Phase 4 – Dual Bus (Matrix ↔ MBR ↔ MQTT)

## Goal
Enable distributed execution while preserving causality.

### Checkpoints
- [ ] UI event → management bus
- [ ] MBR → control bus
- [ ] Remote PIN_IN updates local UI
- [ ] No shortcut paths exist

### Status
- Status: PENDING

---

# Phase 5 – Collaboration & Security

## Stage 5.1 – Element Call Integration

### Checkpoints
- [ ] Embedded Element Call
- [ ] Room/session state aligned

### Status
- Status: PENDING

---

## Stage 5.2 – E2EE-2 Minimal Closure

### Checkpoints
- [ ] Encrypted rooms supported
- [ ] SSSS backup & restore works
- [ ] Clear error states on failure

### Status
- Status: PENDING

---

# Phase 6 – Packaging & Deployment

## Stage 6.1 – Desktop Packaging

### Checkpoints
- [ ] Full feature set works
- [ ] No runtime shortcuts

### Status
- Status: PENDING

---

## Stage 6.2 – Mobile Packaging

### Checkpoints
- [ ] iOS-1 (Safari/PWA) works
- [ ] Android WebView works

### Status
- Status: PENDING

---

## Roadmap Completion Criteria

The roadmap is COMPLETE when:
- All Phases are COMPLETED
- No Charter or SSOT violations remain
- JS runtime fully replaces Python runtime

---

## Notes & Decisions Log

> Append-only. Do not rewrite history.

- 2026-01-27: Split Phase 2 milestones: Stage 2.3 kept for MQTT transport semantics only; program model trigger/execution moved to new Stage 2.5/2.6. Added Stage 2.4 (sqlite replay loader) with iteration 0127-program-model-loader-v0 and defined Phase 2 completion criteria scripts.
