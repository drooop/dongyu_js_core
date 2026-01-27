# UI AST v0.1 Extension (Demo-Only)

This document is an additive extension for the Stage 3.3 demo frontend. It does NOT modify or replace UI AST v0 defined in `docs/iterations/0123-ui-ast-spec/spec.md`.

## Scope
- Demo-only nodes: `Card`, `CodeBlock`
- No executable content; all bindings remain read-only or event-only per v0 spec.

## Common Rules (Inherited)
- ModelTable remains the single source of truth.
- UI events write only `t="event"` labels via Event Envelope v0.
- No new built-in semantics; no bus side effects.

## Node: Card

### Type
- `type: "Card"`

### Props
- `title` (string, optional): title for header slot.
- Additional props are presentation-only and passed to renderer.

### Children
- Allowed; renders as container for child nodes.

### Bind
- No write bindings (same as Container).

### Renderer Mapping (Demo)
- Vue/Element Plus: `ElCard` with header slot = `props.title` and default slot = children.

## Node: CodeBlock

### Type
- `type: "CodeBlock"`

### Props
- `text` (string, optional): code text if no binding is present.

### Bind
- `bind.read` allowed (LabelRef). If present, renderer uses label value as text.

### Renderer Mapping (Demo)
- Vue: `pre` element with text content (stringified).

## Event Envelope v0 (Reminder)

For any `bind.write`, the event envelope MUST satisfy:
- `envelope.type === EventTarget.event_type`
- `envelope.event_id` exists
- `envelope.source.node_id` and `envelope.source.node_type` exist
