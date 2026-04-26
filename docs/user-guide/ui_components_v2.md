---
title: "UI Model Authoring Guide (cellwise.ui.v1)"
doc_type: user-guide
status: active
updated: 2026-04-27
source: ai
---

# UI Model Authoring Guide (cellwise.ui.v1)

This guide explains how to build Workspace / slide app interfaces by filling ModelTable labels.

The current authoring contract is `cellwise.ui.v1`: every visible component is a cell, and labels on that cell describe its component type, placement, text, data binding, and event intent. Do not store a full page as an HTML string or as one large JSON object.

## Quick Start

Create a minimal page with a root container and one title.

| cell | k | t | v |
|---|---|---|---|
| `0,0,0` | `app_name` | `str` | `Hello UI` |
| `0,0,0` | `slide_capable` | `bool` | `true` |
| `0,0,0` | `slide_surface_type` | `str` | `workspace.page` |
| `0,0,0` | `ui_authoring_version` | `str` | `cellwise.ui.v1` |
| `0,0,0` | `ui_root_node_id` | `str` | `hello_root` |
| `2,0,0` | `ui_node_id` | `str` | `hello_root` |
| `2,0,0` | `ui_component` | `str` | `Container` |
| `2,0,0` | `ui_layout` | `str` | `column` |
| `2,0,0` | `ui_gap` | `int` | `12` |
| `2,1,0` | `ui_node_id` | `str` | `hello_title` |
| `2,1,0` | `ui_component` | `str` | `Text` |
| `2,1,0` | `ui_parent` | `str` | `hello_root` |
| `2,1,0` | `ui_order` | `int` | `10` |
| `2,1,0` | `ui_text` | `str` | `Hello UI` |

If you change `2,1,0 / ui_text`, the visible title changes. If you change `0,0,0 / app_name`, the Workspace list label changes.

## Essentials

### Model-Level Labels

These labels usually live on `0,0,0`.

| label | t | required | purpose |
|---|---|---|---|
| `app_name` | `str` | for Workspace apps | Name shown in the Workspace app list. |
| `slide_capable` | `bool` | for slide apps | Marks the model as mountable in Workspace. |
| `slide_surface_type` | `str` | recommended | Describes the host surface, for example `workspace.page` or `flow.shell`. |
| `ui_authoring_version` | `str` | yes | Must be `cellwise.ui.v1`. |
| `ui_root_node_id` | `str` | yes | Points to an existing `ui_node_id`. |

### Node-Level Labels

Each visible component is one UI node cell.

| label | t | required | purpose |
|---|---|---|---|
| `ui_node_id` | `str` | yes | Stable component identity. |
| `ui_component` | `str` | yes | Component type, such as `Container`, `Text`, `Button`, `Markdown`. |
| `ui_parent` | `str` | except root | Parent node id for visual containment. |
| `ui_order` | `int` | recommended | Sibling order under the same parent. |
| `ui_slot` | `str` | optional | Named region, when a component supports slots. |

Use stable node ids such as `submit_button`, not coordinates such as `2_4_0`. Coordinates can change during refactoring; node ids should not.

### Containment And Layout

Visual nesting uses UI nodes, not submodels.

| need | use |
|---|---|
| Put three buttons in one row | `Container` with `ui_layout=row`; each button uses `ui_parent` pointing to that container. |
| Add another row | Add another `Container` cell with a later `ui_order`. |
| Put a column inside a row | Add a child `Container` with `ui_layout=column`. |
| Mount an independent child model | Use `model.submt`; do not use it for ordinary visual rows. |

Example: a row with three buttons.

| cell | k | t | v |
|---|---|---|---|
| `2,2,0` | `ui_node_id` | `str` | `actions_row` |
| `2,2,0` | `ui_component` | `str` | `Container` |
| `2,2,0` | `ui_parent` | `str` | `root` |
| `2,2,0` | `ui_order` | `int` | `20` |
| `2,2,0` | `ui_layout` | `str` | `row` |
| `2,2,0` | `ui_gap` | `int` | `8` |
| `2,2,1` | `ui_node_id` | `str` | `save_button` |
| `2,2,1` | `ui_component` | `str` | `Button` |
| `2,2,1` | `ui_parent` | `str` | `actions_row` |
| `2,2,1` | `ui_order` | `int` | `10` |
| `2,2,1` | `ui_label` | `str` | `Save` |

To add a new button, add one more cell with `ui_parent=actions_row` and a later `ui_order`.

## Component Reference

### Layout

#### Container

`Container` is the default composition component.

| label | t | example |
|---|---|---|
| `ui_layout` | `str` | `row`, `column` |
| `ui_gap` | `int` | `12` |
| `ui_wrap` | `bool` | `true` |
| `ui_style_align_items` | `str` | `center` |
| `ui_style_justify_content` | `str` | `space-between` |

#### Card, Form, FormItem

Use `Card` for panels, `Form` for grouped input, and `FormItem` for labeled fields.

| component | common labels |
|---|---|
| `Card` | `ui_title`, `ui_style_width`, `ui_style_flex` |
| `Form` | `ui_parent`, `ui_order` |
| `FormItem` | `ui_label` |

### Display

#### Text

| label | purpose |
|---|---|
| `ui_text` | Static text. |
| `ui_variant` | Element text type, such as `info`, `success`, `danger`. |
| `ui_bind_read_json` | Dynamic text from a label. |
| `ui_style_font_size`, `ui_style_font_weight`, `ui_style_color` | Common text styling. |

#### Markdown

Use `Markdown` for documentation-style content. It supports headings, paragraphs, lists, tables, inline code, fenced code blocks, and fenced `mermaid` source-preview blocks.

| label | purpose |
|---|---|
| `ui_markdown` | Inline Markdown text. |
| `ui_bind_read_json` | Read Markdown from a label. |
| `ui_style_max_width` | Keep long docs readable. |

Example:

```json
{
  "model_id": 1037,
  "p": 2,
  "r": 4,
  "c": 0,
  "k": "ui_markdown",
  "t": "str",
  "v": "## Events\\n\\n```json\\n{ \\"pin\\": \\"click\\" }\\n```"
}
```

Use one Markdown node per logical section. Do not put an entire app manual into a single cell if sections, examples, and diagram source previews should be reusable.

#### CodeBlock And MermaidDiagram

Use `CodeBlock` for raw code values from a label. Use `MermaidDiagram` when the diagram is already a dedicated component. Use a Markdown fenced `mermaid` block when the diagram source belongs inside a document section.

### Inputs

#### Input

| label | purpose |
|---|---|
| `ui_label` | Field label when wrapped by `FormItem`. |
| `ui_placeholder` | Placeholder text. |
| `ui_bind_json.read` | Current field value. |
| `ui_bind_json.write` | Draft or commit target. |
| `ui_variant` | Input type, such as `textarea` or `password`. |

#### Select, RadioGroup, NumberInput

| component | key labels |
|---|---|
| `Select` | `ui_options_json`, `ui_bind_json` |
| `RadioGroup` | `ui_options_json`, `ui_bind_json` |
| `NumberInput` | `ui_bind_json`, small extra numeric props can stay in `ui_props_json` until promoted. |

### Actions

#### Button

| label | purpose |
|---|---|
| `ui_label` | Button text. |
| `ui_variant` | Element button type, such as `primary`, `danger`. |
| `ui_bind_json.write` | The action or pin to trigger. |

Buttons should not directly mutate final business truth. Formal business should enter the current pin chain, and the program model should write the result back to ModelTable.

Example: trigger a pin with ModelTable payload records.

```json
{
  "write": {
    "pin": "click",
    "value_t": "modeltable",
    "value_ref": [
      { "id": 0, "p": 0, "r": 0, "c": 0, "k": "__mt_payload_kind", "t": "str", "v": "ui_event.v1" },
      { "id": 0, "p": 0, "r": 0, "c": 0, "k": "input_text", "t": "str", "v": { "$label": { "model_id": -2, "p": 0, "r": 0, "c": 0, "k": "draft_text" } } }
    ],
    "commit_policy": "immediate"
  }
}
```

For management bus events, the formal path is:

```text
UI event -> bus_event_v2 -> Model 0 pin.bus.in -> pin route -> target model / MBR
```

### Data Display

| component | use |
|---|---|
| `Table` + `TableColumn` | Lists and registries. Use `ui_data_ref` or `ui_props_json.data` with a label ref. |
| `Tree` | Hierarchical data, such as docs or assets. |
| `StatusBadge` | Compact status display. |
| `StatCard` | Metrics. |
| `Terminal` | Logs and traces. |
| `ColorBox` | Color preview bound to a color label. |

## Binding Patterns

### Read Binding

Use `ui_bind_read_json` when a component only reads.

```json
{ "model_id": 100, "p": 0, "r": 0, "c": 0, "k": "bg_color" }
```

Use split labels if JSON is not convenient:

| label | v |
|---|---|
| `ui_read_model_id` | `100` |
| `ui_read_p` | `0` |
| `ui_read_r` | `0` |
| `ui_read_c` | `0` |
| `ui_read_k` | `bg_color` |

### Draft Writes

UI drafts can use `label_update` or `ui_owner_label_update` through the renderer mailbox.

```json
{
  "read": { "model_id": 1001, "p": 0, "r": 0, "c": 0, "k": "applicant" },
  "write": {
    "action": "ui_owner_label_update",
    "mode": "intent",
    "target_ref": { "model_id": 1001, "p": 0, "r": 0, "c": 0, "k": "applicant" },
    "commit_policy": "on_blur"
  }
}
```

### Formal Business Events

Use pin write binding with a ModelTable payload. The payload must be an array of temporary records using `id`, `p`, `r`, `c`, `k`, `t`, and `v`. Do not send loose top-level business keys.

## Full Example: Form Page

This is the structure used by simple request forms such as Leave Request and Repair Request.

| node | component | parent | role |
|---|---|---|---|
| `leave_root` | `Container` | - | Page root. |
| `leave_title` | `Text` | `leave_root` | Page title. |
| `leave_form` | `Form` | `leave_root` | Field group. |
| `leave_applicant_item` | `FormItem` | `leave_form` | Field label. |
| `leave_applicant_input` | `Input` | `leave_applicant_item` | Field editor. |
| `leave_type_item` | `FormItem` | `leave_form` | Select label. |
| `leave_type_select` | `Select` | `leave_type_item` | Select editor. |

Each field has its own cell. Labels, placeholders, options, and bindings are not hidden inside one big blob.

## Full Example: Documentation Page

A documentation page should be split into sections.

| node | component | purpose |
|---|---|---|
| `guide_root` | `Container` | Page root. |
| `guide_hero` | `Section` | Title and short introduction. |
| `guide_quick_start` | `Markdown` | Quick start prose and table. |
| `guide_api_reference` | `Markdown` | Component API reference. |
| `guide_event_flow` | `Markdown` | Contains a fenced `mermaid` source preview. |
| `guide_payload_example` | `CodeBlock` or `Markdown` fenced code | Highlighted code example. |

Example Markdown value:

````markdown
## Event Flow

```mermaid
flowchart LR
  UI[UI event] --> Bus[Model 0 pin.bus.in]
  Bus --> Target[Target model or MBR]
```

```json
{ "pin": "click", "value_t": "modeltable" }
```
````

## Validation Checklist

Run the compliance audit before shipping a UI model.

| check | pass condition |
|---|---|
| Discoverable | Workspace apps have `app_name`; slide apps have `slide_capable=true`. |
| Cellwise | `ui_authoring_version=cellwise.ui.v1`. |
| Root valid | `ui_root_node_id` points to an existing `ui_node_id`. |
| Granular | Each visible component is a cell. |
| Containment clear | Every non-root node has `ui_parent`. |
| Stable order | Siblings have `ui_order`. |
| No whole-page blob | No active `page_asset_v0`, no raw `Html`, no schema fallback as primary UI. |
| Events auditable | Business events go through pin / Model 0 bus paths. |
| Payload valid | Pin payloads are temporary ModelTable record arrays. |
| Browser verified | Page loads, edits change labels, buttons route as expected. |

Current deterministic check:

```bash
node scripts/tests/test_0346_ui_model_compliance_contract.mjs
```

## Anti-Patterns

| anti-pattern | why it is wrong | use instead |
|---|---|---|
| One `Html` component for a whole page | The UI is no longer fill-table editable. | `Container`, `Section`, `Text`, `Markdown`, and child nodes. |
| A huge `ui_props_json` with text/layout/labels | Users cannot edit the UI by obvious labels. | `ui_text`, `ui_label`, `ui_layout`, `ui_gap`, `ui_options_json`. |
| Missing `ui_parent` | Components can float to the wrong place. | Explicit parent node ids. |
| Using `model.submt` for rows | It creates a model boundary where only visual layout is needed. | Nested `Container` nodes. |
| Button writes final business truth directly | It bypasses the runtime chain. | Trigger a pin and let the program model write results. |
| Loose JSON payload on pins | MBR/worker contracts cannot validate it consistently. | Temporary ModelTable record arrays. |

## When To Add A Component

Add a new renderer component only when labels cannot express a reusable UI capability.

| need | decision |
|---|---|
| Change text, labels, order, or layout | Fill labels; do not add code. |
| Add a stable prop used by many pages | Promote it from `ui_props_json` to a named label. |
| Render a reusable visual pattern | Add a component to the registry and renderer. |
| Add a new business operation | Define the ModelTable payload and pin route first. |
| Compose a child app | Use `model.submt` only for an independent child model. |

The goal is not to eliminate code. The goal is to make user-authored UI pages editable by cells first, with renderer code serving as the component library.
