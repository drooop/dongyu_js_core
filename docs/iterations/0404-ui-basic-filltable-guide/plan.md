---
title: "Iteration 0404 UI Basic Fill-Table Guide Plan"
doc_type: iteration-plan
status: planned
updated: 2026-06-03
source: ai
iteration_id: 0404-ui-basic-filltable-guide
id: 0404-ui-basic-filltable-guide
phase: phase1
---

# Iteration 0404 UI Basic Fill-Table Guide Plan

## Goal

Write a developer-facing guide that lets a reader manually fill ModelTable labels to build simple `cellwise.ui.v1` interfaces: layout, buttons and event binding, inputs, text display, dialogs, tab switching, and local view switching without tabs.

## Background

Existing UI model guides describe the broader slide-app runtime and component system, but a new developer still has to infer too much before hand-filling a small page. This iteration adds a focused "copy this table shape" guide for basic UI composition.

## Invariants

- UI truth remains ModelTable labels; the document must not promote HTML-string pages or whole-page JSON blobs as the primary authoring mode.
- The current contract remains `cellwise.ui.v1`.
- Formal business actions must not be described as direct frontend writes to business truth.
- Simple UI-only state changes may use existing label update bindings.
- The document must match the current renderer/projection labels already implemented in the repo.

## Scope

In scope:

- Add a focused user-guide Markdown document for basic UI model hand-filling.
- Cover layout, `Button`, `Input`, `Text`/`Markdown`, `Dialog`, `Tabs`/`TabPane`, and local view switching with `visibleRef`.
- Include tables and complete JSON record examples that developers can adapt.
- Add and install a validation slide app built from the guide's component patterns.
- Update the user-guide index.
- Record iteration evidence.

Out of scope:

- Runtime or renderer implementation changes.
- New UI components.
- Full slide-app packaging, Workspace Manager publishing, or dual-bus integration beyond short pointers.

## Success Criteria

- The guide explains the minimum root labels and node labels needed for `cellwise.ui.v1`.
- A developer can follow the examples to create a small page with an input, result text, a button, a dialog, tab switching, and local view switching.
- JSON examples in the guide are syntactically valid.
- The validation slide app zip installs locally and the rendered app proves Input, Button, Text, Dialog, Tabs, and local visibility switching.
- The user-guide index links to the new guide.
- Static checks pass with no whitespace errors.

## Risks And Mitigations

- Risk: The guide may accidentally document a label that is not supported.
  - Mitigation: Cross-check against `ui_cellwise_projection.js`, `renderer.mjs`, and `component_registry_v1.json`.
- Risk: The guide may blur UI-only label updates and formal business events.
  - Mitigation: Separate "UI-only state" examples from "formal business event" examples.
- Risk: The guide may duplicate existing broad docs.
  - Mitigation: Keep this guide focused on manual fill-table steps and link to broader slide-app docs for packaging/runtime.

## Open Questions

None.

## Compliance Checklists

### SSOT Alignment Checklist

- `CLAUDE.md`: UI remains ModelTable projection; business events do not bypass Model 0/pin path.
- `docs/user-guide/ui_components_v2.md`: component and label vocabulary.
- `packages/ui-model-demo-frontend/src/ui_cellwise_projection.js`: supported cellwise labels.
- `packages/ui-renderer/src/component_registry_v1.json`: available component names.
- `packages/ui-renderer/src/renderer.mjs`: binding and visibility behavior.

### Charter Compliance Checklist

- Documentation only.
- No runtime behavior changes.
- No compatibility path introduced.
