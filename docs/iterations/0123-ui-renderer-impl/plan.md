# Iteration 0123-ui-renderer-impl Plan

## 0. Metadata
- ID: 0123-ui-renderer-impl
- Date: 2026-01-23
- Owner: TBD
- Branch: dev_0123-ui-renderer-impl
- Related:
  - docs/roadmap/dongyu_app_next_runtime.md
  - docs/iterations/0123-ui-ast-spec/spec.md
  - docs/ssot/runtime_semantics_modeltable_driven.md

## 1. Goal
Implement a Vue3 + Element Plus renderer for UI AST v0, strictly following the AST spec and its event label structure (no new event conventions).

## 2. Background
Stage 3.1 produced a UI AST v0 spec. Stage 3.2 implements the renderer without changing runtime behavior or built-in semantics.

## 3. Invariants (Must Not Change)
- ModelTable (p/r/c/k/t/v) remains the only source of truth.
- UI only reads ModelTable; UI events only write via add_label/rm_label.
- AST contains no executable content (functions/expressions/scripts).
- No new built-in semantics or runtime behavior changes.
- No Matrix/double-bus, Element Call, E2EE, or packaging.
- Event normalization MUST follow Stage 3.1 spec exactly; no new t values or label shapes.
- If Stage 3.1 spec lacks required event label details, this iteration MUST stop and request a spec revision (no local conventions).

## 4. Scope
### 4.1 In Scope
- Implement renderer for UI AST v0 minimal node set.
 - Implement event normalization to ModelTable per Stage 3.1 spec (no new conventions).
- Provide scriptable validation for rendering + event writes.
- Define Renderer Host Adapter Contract (v0) for snapshot + dispatch only.

### 4.2 Out of Scope
- UI business logic beyond spec.
- Runtime changes or new built-in semantics.
- Matrix/double-bus, Element Call, E2EE, packaging.
- Any renderer-side side-effect channels (bus/network/task execution).

## 5. Non-goals
- No renderer features beyond AST v0 minimal node set.
- No UI-side side effects (network/bus/task execution).

## 6. Success Criteria (Definition of Done)
- Renderer can render AST v0 minimal node set per spec.
- UI events write normalized event labels via add_label/rm_label as defined in Stage 3.1 spec.
- Validation script produces PASS for render_minimal + event_write (jsdom).

## 6.1 Validation Strategy (v0)
- Validation harness uses **jsdom** (not SSR tree) for deterministic DOM assertions.
- Cases required: `render_minimal` and `event_write`.
- `event_write` MUST assert `dispatchAddLabel`/`dispatchRmLabel` called with spec-compliant payload.

## 7. Risks & Mitigations
- Risk: Renderer diverges from AST spec.
  - Impact: UI behavior mismatch.
  - Mitigation: Keep spec as source; add validation script cases.

## 8. Open Questions
- Where to place renderer package if packages/ui-renderer does not exist?
- Is jsdom acceptable for the validation harness in this repo?

## 9. SSOT Alignment Checklist (REQUIRED)
- SSOT 0.2/3/4: model-driven, UI is projection, execution in worker.
- SSOT 8.2: scriptable validation.

## 10. Charter Compliance Checklist (REQUIRED)
- Charter 4.1/4.2: UI does not execute logic; events write Cell.
- Charter 6.1: no Matrix/Element Call/E2EE/packaging.

## 11. Behavior First (REQUIRED)
- Use UI AST v0 spec: `docs/iterations/0123-ui-ast-spec/spec.md`.
- Use runtime semantics: `docs/ssot/runtime_semantics_modeltable_driven.md`.

## 12. Renderer Host Adapter Contract v0 (REQUIRED)
- Renderer MAY only access ModelTable through injected host adapter interfaces:
  - `getSnapshot()` (read-only snapshot)
  - `dispatchAddLabel(label)` and `dispatchRmLabel(labelRef)`
- Renderer MUST NOT import or reference worker runtime, MQTT client, or bus adapters.
- Renderer MUST NOT create side-effect channels (network/bus/task execution).

> 禁止在本文件写 Step 编号、执行命令、commit 记录与验证输出。
