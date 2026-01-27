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
  - [PICtest PIN_IN/PIN_OUT 与程序模型触发机制（理解记录）](docs/concepts/pictest_pin_and_program_model.md)
  - [V1N / PICtest 软件工人基座：概念与实现理解](docs/v1n_concept_and_implement.md)
- 最终测试用例（程序模型加载、PIN_IN、运行时触发）：
  - [test_files/test7/main.py](test_files/test7/main.py)
  - [test_files/test7/yhl.db](test_files/test7/yhl.db)

---

## Current State

- Current Phase: Phase 4 – Dual Bus (Matrix ↔ MBR ↔ MQTT) (Stage 4.1) — not current implementation scope
- Current Iteration: 0127-doit-auto-docs-refresh
- Last Completed Checkpoint: Stage 3.2 completed (0123-ui-renderer-impl)
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
- [ ] Trigger fires program model
- [ ] PIN_OUT publishes MQTT
- [ ] Behavior matches PICtest

### Status
- Status: COMPLETED
- Iteration ID: 0123-pin-mqtt-loop
- Verified By: validation_protocol + runlog PASS

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
