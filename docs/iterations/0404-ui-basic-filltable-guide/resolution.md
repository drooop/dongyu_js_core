---
title: "Iteration 0404 UI Basic Fill-Table Guide Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-06-03
source: ai
iteration_id: 0404-ui-basic-filltable-guide
id: 0404-ui-basic-filltable-guide
phase: phase1
---

# Iteration 0404 UI Basic Fill-Table Guide Resolution

## 0. Execution Rules

- Work branch: `dropx/dev_0404-ui-basic-filltable-guide`.
- This is a docs-only iteration.
- Do not change runtime, renderer, server, worker model, or tests.
- Real execution evidence belongs in `runlog.md`, not this file.

## 1. Steps Overview

| Step | Title | Scope | Files | Validation | Acceptance | Rollback |
|---|---|---|---|---|---|---|
| 1 | Register iteration | Add plan/resolution/runlog and index row | `docs/ITERATIONS.md`, `docs/iterations/0404-*` | `git diff --check` | Iteration is discoverable | Remove row and directory |
| 2 | Write guide | Add focused manual fill-table guide | `docs/user-guide/ui_model_basic_filltable_guide.md`, `docs/user-guide/README.md` | JSON examples parse; static grep against key labels | Guide covers requested components and links from index | Remove guide and index row |
| 3 | Verify docs | Run static checks and review the diff for conformance | docs only | `git diff --check`, JSON snippet parser | No syntax/whitespace failures; no unsupported claims found | Revise guide |
| 4 | Validate with slide app | Build a zip from the guide and test it in browser | `docs/user-guide/examples/ui_basic_filltable_validation_app_payload.json` | local deploy, install client, real browser | Installed app works for requested controls | Fix guide or payload |

## 2. Step Details

### Step 1 — Register Iteration

**Goal**
- Make the documentation work auditable before writing the guide.

**Scope**
- Add iteration docs.
- Register 0404 in the index.

**Validation**
- `git diff --check`

**Acceptance Criteria**
- The iteration row points to `docs/iterations/0404-ui-basic-filltable-guide/`.

**Rollback Strategy**
- Remove the 0404 row and directory.

### Step 2 — Write Guide

**Goal**
- Produce a practical guide for developers hand-filling simple UI pages.

**Scope**
- Explain root metadata, node identity, parent/child layout, read/write binding, and visibility.
- Provide examples for layout, button event binding, input, text display, dialog, tab switching, and local non-tab switching.

**Validation**
- Parse JSON fenced examples from the new guide.
- Review the guide against current renderer/projection files.

**Acceptance Criteria**
- The guide does not require a developer to understand the full slide-app runtime before making a simple page.
- The guide clearly separates UI-only state updates from formal business events.

**Rollback Strategy**
- Remove the guide and README link.

### Step 3 — Verify

**Goal**
- Confirm the docs change is internally consistent and mechanically valid.

**Scope**
- Static validation and diff review.

**Validation**
- `git diff --check`
- JSON snippet parsing for the new guide.
- `rg` checks for requested topics and key supported labels.

**Acceptance Criteria**
- Checks pass.
- Any inconsistency found during review is fixed before reporting.

**Rollback Strategy**
- Revise or remove invalid sections.

### Step 4 — Validate With Slide App

**Goal**
- Use the guide as a developer would: create a simple slide app payload, install it, open it, and interact with all requested controls.

**Scope**
- Create a tracked test payload under `docs/user-guide/examples/` and a local validation zip in `test_files/`.
- Install through the supported upload/importer chain.
- Use a real browser to verify the rendered app.

**Validation**
- Parse the payload JSON.
- Confirm ZIP contains only `app_payload.json`.
- Run local deploy/runtime baseline.
- Install through `scripts/examples/slide_app_install_client.py`.
- Browser-test input submit, dialog open/close, tab switch, and non-tab local visibility switch.

**Acceptance Criteria**
- The app appears as `UI 基础填表验证`.
- Input text can be submitted and shown in Text.
- Dialog opens and closes.
- Help tab renders Markdown.
- Detail area shows/hides through `visibleRef` / `hiddenRef`.

**Rollback Strategy**
- Remove the validation payload/zip and revise the guide.
