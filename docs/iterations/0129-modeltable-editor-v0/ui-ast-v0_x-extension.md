# UI AST v0.x Extension (0129 ModelTable Editor)

This document extends UI AST v0 for the ModelTable editor. It is additive and editor-only.

## Goals
- Provide editor-friendly nodes (Table/Tree/Form) without executable code in AST.
- Provide an editor write binding that always emits an event to the mailbox (see contract).

## Non-goals
- No inline functions/expressions/scripts in AST.
- No direct state mutation from UI; UI only emits mailbox events.

## Node Set (v0 + editor additions)

### Existing v0 nodes (already supported)
- Root
- Container
- Card
- Text
- CodeBlock
- Input
- Button

### Editor nodes (v0.x)
- Table
- Tree
- Form
- FormItem

Notes:
- Editor nodes are data-only descriptors; renderer may choose Element Plus components.

## Binding: Read

Read binding stays compatible with v0:
- LabelRef: `{ model_id?, p, r, c, k }`
- Legacy v0 default: `model_id` omitted => treat as 0.

## Binding: Write (two modes)

### Legacy v0 write (kept for compatibility)
- Shape:
  - `write.target`: `{ p, r, c, k }`
  - `write.event_type`: string
  - `write.policy`: optional string (e.g. clear_then_add)

### Editor v0.x write (mailbox event)
- Shape:
  - `write.action`: one of `label_add|label_update|label_remove|cell_clear|submodel_create`
  - `write.target_ref`: LabelRef-like `{ model_id, p, r, c, k? }` (required for all actions except submodel_create)
  - `write.value_ref`: optional `{ t, v }`

Rules:
- Editor write does NOT change the event write location; event labels are always written to the mailbox.
- Any missing/invalid fields are rejected by schema validation.

## Value Type Mapping (editor minimum)
- TextInput -> t=str
- NumberInput -> t=int
- Switch/Toggle -> t=bool
- JSONEditor/ModelSpec -> t=json

## Validation
- AST fixtures + validator script: `scripts/validate_ui_ast_v0x.mjs`
- Fixtures:
  - `scripts/fixtures/ui_ast_v0x/positive/*.json`
  - `scripts/fixtures/ui_ast_v0x/negative/*.json`
