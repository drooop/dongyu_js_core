# Dongyu App Next Runtime Execution Charter (2026)

## 0. Legal Status / Binding Force

This document is a **Project-level Execution Charter** for the current Dongyu App rewrite.

- It is **subordinate to** `docs/architecture_mantanet_and_workers.md` (System SSOT).
- It is **superior to** any Iteration plan, resolution, or implementation detail.
- All iterations executed via `$doit` / `$doit-auto` **MUST comply** with this Charter unless an explicit conflict with SSOT is identified.
- This Charter is **time- and scope-bound**: it governs the current “Next Runtime” rewrite only.

If any ambiguity exists:
> **Stop, document, and ask. Never infer.**

---

## 1. Objective of This Rewrite

This project delivers a **new-generation Dongyu App**, where:

- Dongyu App is a **system-level application (App-as-OS)**, not a thin client.
- The **Software Worker Base (V1N runtime)** is fully reimplemented in **JavaScript (Bun/Elysia)**.
- The previous **Python + NiceGUI runtime is fully removed**, not parallelized.
- The **ModelTable (Cell: p/r/c/k/t/v)** remains the **sole source of truth** for:
  - State
  - UI rendering
  - Event triggering
  - Execution causality

This rewrite is **structural**, not cosmetic.

---

## 2. Non-Negotiable Invariants (Inherited from SSOT)

The following invariants are assumed and MUST NOT be violated:

1. ModelTable is the minimal executable unit of intent and state.
2. All meaningful behavior must be representable as Cell evolution.
3. Execution responsibility and factual authority do not reside in UI.
4. Control boundaries (Worker / Workspace / Bus) remain conceptually intact.
5. UI is a projection of capability, not an execution authority.

This Charter **adds constraints**, it does not redefine these.

---

## 3. Explicit Technical Decisions (Locked)

The following decisions are **explicitly locked** for this rewrite:

### 3.1 Runtime & Language
- Software Worker Base runtime: **Bun + Elysia**
- Python runtime: **fully removed**
- NiceGUI: **fully removed**

### 3.2 ModelTable
- Cell structure is **fixed**: `p / r / c / k / t / v`
- No extension fields are allowed outside these keys.
- All system behavior MUST be decomposable into Cell interactions.

### 3.3 Built-in Semantics
- Program model behavior is determined by **built-in `k` values**.
- Examples:
  - `k:"value"`
  - `k:"pin_in"`
  - `k:"pin_out"`
- JS runtime MUST **replicate the observable behavior** of Python built-in `k`,
  based on PICtest reference extraction.

### 3.4 PIN Semantics
- `PIN_IN` and `PIN_OUT` are **explicit Cells**, not naming conventions.
- First-stage bus scope is limited to:
  - `PIN_IN / PIN_OUT`
  - Local Docker MQTT publish/subscribe

---

## 4. UI & Sliding UI Model (Critical Constraint)

### 4.1 UI Execution Principle

UI **does not execute logic**.

UI is allowed to:
- Read ModelTable
- Render projections
- Write values into designated Cells

UI is NOT allowed to:
- Send bus messages directly
- Execute real control logic
- Bypass ModelTable state transitions

### 4.2 UI Event Canonical Form

All UI interactions MUST be normalized as:

> **“Write value into a Cell”**

Example:
- Button click → write `Cell.v = <event payload>`
- No direct side effects are permitted

Subsequent behavior MUST be triggered by:
- Program model built-in `k`
- Trigger mechanisms observing Cell changes

### 4.3 UI Interpretation Architecture

- UI Model → **Abstract Component Tree (AST)** → Renderer
- AST is framework-agnostic
- Vue 3 + Element Plus is **one renderer**, not the model itself

UI rendering MUST be **entirely driven** by ModelTable-derived AST.

---

## 5. Domain Separation Inside Dongyu App

Dongyu App contains **two execution domains**:

### 5.1 Local Domain
- Used for Dongyu App’s own system UI and behavior
- May perform:
  - Local async tasks
  - Cache access
  - Indexing
- Still MUST obey ModelTable discipline
- MUST NOT forge or overwrite remote factual authority

### 5.2 Remote Sliding UI Domain
- UI projected from remote workers
- UI execution strictly limited to:
  - Rendering
  - Event normalization (write Cell)
- All real effects MUST return to remote execution via bus

These domains MUST NOT be implicitly mixed.

---

## 6. Bus Scope & Phasing (Hard Boundary)

### 6.1 First-Stage Scope (MANDATORY)

Initial iterations MUST restrict scope to:

- Control semantics only
- `PIN_IN / PIN_OUT`
- Local Docker MQTT broker

The following are **explicitly OUT OF SCOPE** in early iterations:
- Matrix management bus
- MBR
- Element Call
- E2EE flows
- Packaging / mobile shells

### 6.2 Deferred Scope (Later Iterations Only)

The following are **explicitly planned for later**, not now:
- Dual-bus (Matrix ↔ MBR ↔ MQTT)
- Element Call (MatrixRTC / Widget)
- E2EE target: **E2EE-2**
- iOS target: **iOS-1 (Safari/PWA is sufficient)**

Any attempt to implement these early is a **Charter violation**.

---

## 7. Reference Implementation Requirement

### 7.1

The Python reference implementation (PICtest) is the **behavioral oracle**.

Rules:
- JS runtime MUST replicate **observable behavior**, not internal code structure.
- Built-in `k` semantics MUST be extracted, documented, and validated.
- Any uncertainty MUST be documented before implementation.

No “best guess” behavior is allowed.

## 7.2 PICtest as Behavioral Oracle (Priority Rule)

PICtest is the behavioral oracle for this rewrite.

Rules:
1) Implementation MUST follow PICtest observable behavior by default.
2) This Charter defines scope boundaries and prohibited actions, not behavioral completeness.
3) If a written convention in plans/docs conflicts with PICtest behavior:
   - Prefer PICtest behavior, unless it violates SSOT or an explicit Charter prohibition.
4) If PICtest behavior appears ambiguous or inconsistent:
   - Document the ambiguity, extract multiple examples, and propose a minimal consistent rule.
   - Do not “invent” new behavior without evidence.

---

## 8. Iteration Governance Rules

For every Iteration:

1. Phase0 MUST:
   - Locate relevant SSOT clauses
   - Locate relevant Charter clauses
   - Locate Python reference behavior

2. Phase1 MUST:
   - Include an **SSOT Alignment Checklist**
   - Include a **Charter Compliance Checklist**
   - Explicitly list **Non-Goals**

3. Phase3 MUST:
   - Validate behavior against extracted reference
   - Include an **SSOT/Charter Violation Check**

Failure to do so invalidates the Iteration.

---

## 9. Prohibited Actions (Absolute)

During the Charter’s effective period, the system MUST NOT:

- Allow UI to directly emit bus messages
- Introduce logic paths bypassing ModelTable
- Implement Matrix or Element Call ahead of schedule
- Parallelize Python and JS runtimes
- Modify SSOT to accommodate implementation convenience

---

## 10. Termination / Amendment

This Charter remains valid until:
- The “Next Runtime” rewrite is declared complete, OR
- It is explicitly superseded by a new Charter

Amendments MUST:
- Be explicit
- Be versioned
- Never silently rewrite history

---

## 11. Final Clause

This Charter exists to ensure that:
> **The system evolves by making intent executable,  
> not by accreting ad-hoc implementation decisions.**

If forced to choose between speed and clarity:
> **Clarity wins.**
