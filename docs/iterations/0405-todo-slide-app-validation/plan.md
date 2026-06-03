---
title: "Iteration 0405 To Do Slide App Validation Plan"
doc_type: iteration-plan
status: planned
updated: 2026-06-03
source: ai
iteration_id: 0405-todo-slide-app-validation
id: 0405-todo-slide-app-validation
phase: phase1
---

# Iteration 0405 To Do Slide App Validation Plan

## Goal

Build and locally verify a polished To Do slide app that validates the Basic UI Model Fill-Table Guide beyond the minimal example.

The app must be authored as a Tier 2 / ModelTable-driven slide app. The UI must be defined by `cellwise.ui.v1` labels, and business state must live in the app's positive ModelTable model. UI interaction must not use direct database writes or frontend-only truth.

## Product Shape

The app is a task manager with two views:

- **Board view**: status columns for `还未开始`, `正在进行`, `已完成`, and `已归档`; task cards are compact in columns and support create, edit, and status movement.
- **Focus view**: a larger filtered view for unfinished tasks, showing more title/content detail and clearer action controls.

The UI should feel closer to a modern task product than a test harness. The visual direction should combine:

- Linear board/list behavior: board and list/focused modes are peer views; board cards stay compact and details open separately.
- LWTS / open-source Kanban conventions: cards move across columns, board/list views coexist, and mobile/tablet layout must remain usable.
- Trello-style card UX: quick add/edit, status columns, and card detail modal.

Reference pages used for this plan:

- `https://linear.app/docs/board-layout`
- `https://lwts.org/`
- `https://github.com/maxverwiebe/kanbany`

## Scope

In scope:

- Add a built-in To Do slide app model to `workspace_positive_models.json`.
- Add the To Do app to the Workspace entry allowlist and built-in app list.
- Add one or more UI-model-backed renderer components only where existing basic components cannot express dynamic task collections.
- Use existing basic components for the surrounding shell: layout, buttons, inputs, select, dialog, tabs or view switch, text, cards, badges.
- Implement task creation, editing, status movement, archive/unarchive where practical, and focused unfinished view.
- Validate the input synchronization strategy: form typing must stay smooth, and immediate submit after typing must use the visible draft value.
- Deploy locally and verify through a real browser.

Out of scope:

- Remote-worker / MBR / Matrix integration for this To Do app.
- Multi-user collaboration, permissions, due dates, assignees, comments, or persistence beyond the current ModelTable runtime storage.
- Cloud deployment.
- Rewriting the Basic UI Model Fill-Table Guide except for small corrections discovered during validation.

## Invariants / Constraints

- `CLAUDE.md` remains authoritative.
- The iteration must stay on `dropx/dev_0405-todo-slide-app-validation` unless explicitly changed.
- New user-facing app models must be positive models.
- UI is projection only; task truth is stored in ModelTable labels.
- Task mutation must enter through renderer events, Model 0 mounted ingress, and the app/runtime owner path; direct frontend mutation of canonical task state is not acceptable.
- Built-in app model `1086` must be mounted under Model 0 via `runtime_hierarchy_mounts.json`, consistent with existing built-in workspace apps.
- If formal task actions use pins, input overlays must flush before the pin event is posted.
- No compatibility aliases or legacy connection forms may be introduced.
- Local deployment must be refreshed before claiming browser verification.
- Playwright sessions must be cleaned up after real-browser tests.

## Data Model

The app root model stores task state in a single JSON label:

```text
tasks_json: json
```

Each task object should use this stable shape:

```json
{
  "id": "task_001",
  "title": "Write validation plan",
  "body": "Use the UI fill-table guide to build a richer app.",
  "status": "todo",
  "created_at": "2026-06-03T00:00:00.000Z",
  "updated_at": "2026-06-03T00:00:00.000Z"
}
```

Supported status values:

- `todo`
- `doing`
- `done`
- `archived`

The root model also stores UI-local state labels such as:

- `active_view`
- `create_dialog_open`
- `edit_dialog_open`
- `draft_title`
- `draft_body`
- `draft_status`
- `selected_task_id`
- `filter_text`

These labels are still ModelTable state, but form input should use overlay/deferred commit policies to avoid per-keystroke server churn. Formal create/edit submit must flush the visible draft before the Model 0-to-app request pin is handled.

## UI Model Strategy

Use normal `cellwise.ui.v1` nodes for the frame:

- `Container` for page layout, top bar, view body, form rows.
- `Button` for create, save, cancel, status actions.
- `Input` for title/body/filter fields.
- `Select` for task status.
- `Dialog` for create/edit/detail flows.
- `Text`, `Markdown`, `StatusBadge`, and `Card` for labels, summaries, and metadata.

Add a small dynamic projection component only for repeated task rendering:

- `TodoBoard` renders status columns and cards from `tasks_json`.
- `TodoFocusList` renders filtered unfinished tasks with more detail.

These components must be selected and configured by UI-model labels. They do not own canonical task state; they dispatch configured events back into the ModelTable path through the mounted app ingress.

## Synchronization Policy

Form inputs should use `commit_policy: "on_submit"` where the submit button triggers a formal app action. This keeps fast typing smooth because the browser overlay reflects the visible input immediately.

The runtime adapter must flush `on_submit` overlays before formal submit actions, including pin-based submit events. This is required so a user can type and immediately click Save without submitting stale ModelTable labels.

Task actions use this boundary:

```text
UI component -> formal UI event -> Model 0 mounted app ingress -> To Do app root pin -> app program model -> tasks_json
```

The frontend may keep temporary visible input overlays, but it must not become the canonical task owner.

Discrete actions such as status movement can commit immediately because they are single user actions, not continuous typing.

## Success Criteria

- The app appears in Workspace / desktop as a built-in slide app named `To Do Board`.
- Board view shows at least four status columns and seeded tasks.
- Create dialog allows entering title/body/status and creates a task in the selected status.
- Edit dialog allows changing title/body/status for an existing task.
- Task cards support at least one reliable status-move UI; drag/drop is accepted only if it proves stable in browser tests.
- Focus view shows unfinished tasks with more detail than board cards.
- Fast typing into create or edit fields remains visually smooth.
- Immediate Save after typing submits the visible value, not stale ModelTable text.
- Static tests cover component registration, model labels, app allowlist, sync flush behavior, and task mutation helpers.
- Static tests prove model `1086` is mounted under Model 0 and formal task actions are routed through the app request pin before mutating `tasks_json`.
- Local deployment passes baseline checks.
- Real browser testing verifies create, edit, status move, focus view, optional drag/drop if implemented, and browser cleanup.
