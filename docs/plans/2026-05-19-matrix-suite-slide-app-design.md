---
title: "Matrix Suite Slide App Design"
doc_type: design
status: completed
updated: 2026-05-19
source: ai
iteration_id: 0383-ui-server-matrix-suite-slide-app
---

# Matrix Suite Slide App Design

## 1. Product Goal

`Matrix Suite` is a UI Server built-in slide app that presents a modern Matrix-style communication console. It should feel like a real chat product, but its implementation must remain ModelTable-driven:

- UI is authored by `cellwise.ui.v1` labels.
- User business actions are expressed as temporary ModelTable payload records.
- Program models receive events through declared pins and update ModelTable state.
- The browser never imports `matrix-js-sdk` or sends Matrix/MQTT traffic directly.

The design borrows Matrix concepts from `matrix-js-sdk`: rooms, timeline events, sync-driven updates, `m.room.message`, media event types, local echo/error states, calls, and group calls. In this iteration those concepts become model-table state and program-model actions. Full live Matrix/WebRTC transport can be attached later by worker-side adapters without changing the UI authoring shape.

## 2. UX Structure

The app uses a four-zone chat layout:

| Zone | Purpose | ModelTable expression |
|---|---|---|
| App rail | Profile, Home, Rooms, People, Calls, Settings | `Container` / `Box` / `Icon` / `Button` cells |
| Channel list | Search, filters, unread badges, 1v1 and room entries, create/update/delete controls | one cell per filter, row, badge, and action |
| Timeline | Room header, message/event cards, edit state, call/media cards | one cell per header block and major message row; dynamic text comes from JSON labels |
| Inspector/settings | Members, room metadata, route status, password/session controls | `Tabs`, `Card`, `StatusBadge`, `Input`, `Button` cells |

Visual direction:

- compact left icon rail;
- soft grey/green background;
- rounded conversation cards;
- strong active-state color;
- large readable room title;
- composer fixed at the bottom of the timeline;
- inspector panel on the right for room details and settings.

## 3. Model IDs and Placement

Use a new positive built-in model:

| Model ID | Name | Role |
|---:|---|---|
| 1080 | `Matrix Suite` | UI Server built-in slide app root, UI model, state model, and program model |

The root model is a `model.table` and is mounted under Model 0. For this iteration, the first implementation keeps state in the root table to reduce cross-model owner-materialization risk. The UI remains fine-grained by distributing components and programs across many cells.

If future live Matrix adapter state becomes large, it can be split into child models:

- session truth;
- room directory;
- active timeline;
- media/call state;
- settings/security state.

## 4. Formal Event Path

All formal actions use the same path:

```text
UI component
  -> ui_bind_json.write.bus_event_v2
  -> Model 0 root label: matrix_suite_1080_bus_event (pin.bus.cb.in)
  -> Model 0 pin.connect.cell route to the Matrix Suite hosting Cell
  -> Model 0 hosting Cell pin: matrix_suite_request (pin.in)
  -> child model boundary through model.submt
  -> Model 1080 root label: matrix_suite_request (pin.in)
  -> pin.connect.label
  -> handle_matrix_suite_event:in
  -> ModelTable labels updated by program model
  -> UI projection refreshes
```

Draft text input may use local overlay/on-submit behavior so fast typing does not stutter. Pressing `Send` is the formal business event.

The implementation must not create a direct `pin.connect.cell` edge from Model 0 root to Model 1080 root. Cross-model delivery is legal only through the Model 0 `model.submt` hosting Cell for model 1080 and then through the child model root.

## 5. Program Actions

`handle_matrix_suite_event` receives a temporary ModelTable record array. It reads `action` and optional fields:

| Action | Required records | Effect |
|---|---|---|
| `select_room` | `room_id` | Set active room and projection labels |
| `send_message` | `draft_text` | Append `m.room.message` text event and clear draft |
| `edit_message` | `event_id`, `draft_text` | Append replacement/edit metadata and update visible message |
| `create_channel` | `channel_kind`, `channel_name`, optional `invitees` | Add 1v1 or room entry |
| `update_channel` | `room_id`, `channel_name` | Rename the active 1v1 or room entry |
| `delete_channel` | `room_id` | Mark room archived and select fallback room |
| `start_video` | `room_id` | Append call invite status event |
| `start_voice` | `room_id` | Append audio/voice event status |
| `start_screen` | `room_id` | Append screen-share status event |
| `share_file` | `room_id`, optional `media_uri`, `file_name` | Append file event; if no uploaded file is available, show visible failure |
| `save_settings` | settings fields | Update settings status without storing secrets |

Failures must update visible `status_text` and not silently succeed.

## 6. Feature Coverage

Required feature coverage for 0383:

- 1v1 and multi-person room display.
- Create/update/delete channel controls.
- Text send and editable message flow.
- Voice message entry as `m.audio`-style event record.
- Video conference entry as Matrix call-style event record.
- Screen sharing entry as Matrix call/screen-share-style event record.
- File sharing UI with `FileInput`, media URI field, and a share action. Browser acceptance must upload a small file, produce a visible media URI or file record, send it through `bus_event_v2`, and render it in the timeline. A visible failure path is required but cannot satisfy the success test.
- Settings panel with homeserver, user ID, sync status, session status, and password-maintenance action; no sample secrets.

## 7. Verification Design

Automated checks:

- model 1080 exists and is a Workspace entry;
- app is authored with `cellwise.ui.v1`;
- UI component count and cell count exceed a minimum granularity threshold;
- Model 0 declares `matrix_suite_1080_bus_event` and routes it to the model 1080 hosting Cell, whose declared pin relays into model 1080 root `matrix_suite_request`;
- no frontend file imports `matrix-js-sdk` or implements direct Matrix send for this app;
- all required actions have UI buttons and program handler cases;
- program action simulation updates expected labels.

Browser checks:

- open Workspace at `http://127.0.0.1:30900/#/workspace`;
- open `Matrix Suite`;
- select room;
- send message and see it appear;
- edit message and see edited text;
- create, rename, and delete a channel;
- trigger video, voice, and screen actions and see visible timeline/status changes;
- upload a small file via `FileInput`, click share, and see a successful file event in the timeline;
- save settings and see visible status;
- open `E2E 颜色生成器` and confirm its button still changes color.

## 8. Risks and Boundaries

- The iteration intentionally avoids browser-side `matrix-js-sdk` because that would bypass ModelTable and Model 0 routing.
- Advanced media features are modeled as event/control entries first; attaching live WebRTC and real recording requires worker-side adapters in later iterations.
- If renderer changes are needed, they must be generic UI-model capabilities, not hardcoded `Matrix Suite` behavior.
