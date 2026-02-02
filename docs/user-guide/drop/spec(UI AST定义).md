# UI AST Spec v0 (Stage 3.1, documents-only)

## 0. Authority & Scope
- Authority: `docs/architecture_mantanet_and_workers.md` (SSOT), `docs/charters/dongyu_app_next_runtime.md` (Charter), `docs/ssot/runtime_semantics_modeltable_driven.md` (Runtime Semantics)
- This document defines **UI AST v0** and **render contract** only. It does NOT implement UI, does NOT change runtime behavior, and does NOT introduce new built-in semantics.

---

## 1) UI AST Spec (Normative)

### 1.1 Common Node Fields (Normative)
All nodes MUST be JSON-serializable and contain:
- `id` (string, required): stable node id.
- `type` (string, required): node type.
- `children` (array, optional): child nodes for container types.
- `props` (object, optional): **presentation-only** fields (layout, style, text, placeholder, etc.).
- `bind` (object, optional): **ModelTable binding** (read/write targets only; no executable logic).

### 1.2 LabelRef v0 (Normative)
ModelTable label reference used by bindings:
- `p` (int), `r` (int), `c` (int)
- `k` (string)
- `t` (string, optional)

### 1.3 Minimal Node Set v0 (Normative)
The following node types are the **minimum required set**.

#### Node: `Root`
- Purpose: AST root.
- Presentation (`props`): `title?` (string), `meta?` (object).
- Binding (`bind`): **none** (Root does not bind to ModelTable).

#### Node: `Container`
- Purpose: layout/grouping.
- Presentation (`props`): `layout` ("row"|"column"), `gap?` (int), `align?` ("start"|"center"|"end"), `style?` (object).
- Binding (`bind`): **none** (Container does not read/write ModelTable).
- Children: required.

#### Node: `Text`
- Purpose: render text.
- Presentation (`props`): `text` (string, required if no bind).
- Binding (`bind.read`): `LabelRef` (optional). When present, UI displays the referenced label value as text.

#### Node: `Input`
- Purpose: text input control.
- Presentation (`props`): `placeholder?` (string), `input_type?` ("text"|"number"|"password"), `style?` (object).
- Binding:
  - `bind.read`: `LabelRef` (optional) for current value display.
  - `bind.write`: `EventTarget` (required for any user input event).

#### Node: `Button`
- Purpose: action trigger.
- Presentation (`props`): `label` (string), `variant?` (string), `style?` (object).
- Binding:
  - `bind.write`: `EventTarget` (required for click/press).

> Extensions beyond this minimal set MUST be introduced in later iterations and documented explicitly.

---

## 2) Render Contract (AST -> ModelTable Binding Rules)

### 2.1 One-Way Binding (Hard Rule)
- UI **only reads** from ModelTable.
- UI **only writes** by calling `add_label` / `rm_label` on ModelTable.
- UI **MUST NOT** perform any side effects directly (no bus, no network, no task execution).

### 2.2 No Executable Content (Hard Rule)
AST nodes MUST NOT contain:
- functions
- expressions
- scripts
- evaluable strings

### 2.3 Binding Object (Normative)
- `bind.read` MUST be a `LabelRef`.
- `bind.write` MUST be an `EventTarget` (defined below).
- UI MAY omit `bind` for purely static presentation nodes.

---

## 3) UI Event Normalization v0

### 3.1 EventTarget v0 (Normative)
Event write target used by UI controls:
- `target` (LabelRef, required)
- `event_type` (string, required): e.g., `click`, `change`, `submit`
- `policy` (string, optional): e.g., `add_only` (default), `clear_then_add`

### 3.2 Event Envelope v0 (Normative)
UI MUST write a normalized event object into `label.v`:
- `event_id` (string, required)
- `type` (string, required)
- `payload` (object, optional)
- `source` (object, required): `{ node_id: "<id>", node_type: "<type>" }`
- `ts` (number, optional)

### 3.3 Write Operation (Normative)
When a UI event fires:
1) UI MUST call `add_label` into `EventTarget.target`.
2) The label MUST have:
   - `k` = target.k
   - `t` = "event"
   - `v` = Event Envelope v0
3) If `policy = clear_then_add`, UI MUST call `rm_label` on the same `k` before `add_label`.

### 3.4 No Direct Business Writes (Hard Rule)
UI MUST NOT write business state labels directly.
- Allowed writes are **event-only** (`t = "event"`).
- Any non-event write by UI is a violation.

---

## 4) Negative Spec (Forbidden Capabilities)
UI AST v0 explicitly forbids:
- Any executable logic in AST (functions, expressions, scripts).
- Any direct bus/network side effects from UI.
- Any UI write that is not an event write (`t = "event"`).
- Any runtime control or scheduling semantics embedded in AST.
- Any Matrix/MBR/E2EE/packaging hooks.

---

## 5) Conformance Checklist (Doc-Level)
- AST uses only minimal node set for v0.
- All bindings are LabelRef/EventTarget only.
- All UI events write `t = "event"` via `add_label`/`rm_label`.
- No executable content or side effects in AST.
