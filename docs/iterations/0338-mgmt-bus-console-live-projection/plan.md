---
title: "0338 — Mgmt Bus Console Live Projection Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-26
source: ai
iteration_id: 0338-mgmt-bus-console-live-projection
id: 0338-mgmt-bus-console-live-projection
phase: phase1
---

# 0338 — Mgmt Bus Console Live Projection Plan

## 0. Metadata
- ID: `0338-mgmt-bus-console-live-projection`
- Date: `2026-04-26`
- Owner: Codex
- Branch: `dev_0338-mgmt-bus-console-live-projection`
- Type: planning / contract freeze
- Implementation status: not started

## 1. Goal
冻结 `Mgmt Bus Console` 从静态四区壳推进到 live read-only projection 的合同：左侧 subject / room 列表、中间 event timeline、右侧 event inspector / route status 必须从既有 truth 投影出来，而不是在 Model `1036` 中复制 Matrix、MBR 或 Model 0 的事实数据。

本 iteration 只定义后续实现范围、数据来源、禁止项、验证项和回滚策略；不实现代码，不改运行时行为。

## 2. Current Baseline
- `0336` 已实现并验证 Model `1036`：
  - Workspace 可打开 `Mgmt Bus Console`。
  - Console 由 `cellwise.ui.v1` 标签组合四区界面。
  - `Send` 通过 `bus_event_v2 -> Model 0 (0,0,0) pin.bus.in -> -10.mgmt_bus_console_intent`。
  - Playwright 已确认 browser direct Matrix request 数量为 `0`。
- 当前 `1036` 的 subject / timeline / route projection rows 是空 projection slots。
- `Model -2` 已维护 Matrix Debug 的前端状态投影标签：
  - `matrix_debug_subjects_json`
  - `matrix_debug_subject_selected`
  - `matrix_debug_readiness_text`
  - `matrix_debug_subject_summary_text`
  - `matrix_debug_trace_summary_text`
  - `matrix_debug_status_text`
- `Model -100 Matrix Debug`、`Model 0` bus route labels、MBR route labels 是可复用 truth 来源，但不能被复制进 `1036`。

## 3. Scope
In scope:
- 定义 0338 后续实现时的 read-only projection 数据合同。
- 定义 Console 可显示的 live 字段、字段来源、刷新入口与禁止写入范围。
- 定义如何验证 `1036` 不复制 external truth。
- 定义如何验证 UI 仍不发 direct Matrix request。
- 定义如何验证刷新动作仍经 `bus_event_v2 -> Model 0 pin.bus.in`。
- 定义当现有 `Table` / `Terminal` 表达不足时，新增 UI 组件的准入条件。

Out of scope:
- 不实现 live projection。
- 不新增 renderer 组件。
- 不改 Matrix live adapter 事件筛选逻辑。
- 不改 MBR routing / CRUD 策略。
- 不把 `Model -100`、`Model -2`、`Model 0`、MBR route truth 复制到 Model `1036`。
- 不提升 `dev` 到 `main`。

## 4. Data Ownership Contract

### 4.1 Model 1036 May Own
Model `1036` 只允许持有 Console-local UI state：
- `selected_subject`
- `subject_filter`
- `timeline_filter`
- `composer_draft`
- `inspector_open`
- `inspector_selected_event_id`
- `last_refresh_requested_at`
- `last_refresh_status`

这些字段只代表界面状态或用户输入，不代表 Matrix、MBR、Model 0 的事实状态。

### 4.2 Model 1036 Must Not Own
Model `1036` 禁止持有以下 truth：
- Matrix room id / room membership / event body / event id 的权威副本。
- Matrix access token、password、device id、homeserver secret。
- MBR route table 的权威副本。
- Model 0 `pin.connect.*` route labels 的权威副本。
- remote-worker / MBR worker 的 secret、token、credential。
- 任意可被下游解释成 generic CRUD 的自由对象 payload。

### 4.3 Projection Sources
后续实现只能从这些既有来源生成 read-only projection：

| Console Region | Source | Projection shape | Ownership |
|---|---|---|---|
| left subject / room list | `Model -2` Matrix Debug projection labels first; `Model -100` only through existing debug projection APIs if needed | rows with id, label, status, unread/count-like summary | source owns truth |
| center event timeline | existing Matrix Debug trace / subject summary projection | display-only rows or terminal text | source owns truth |
| right event inspector | selected event id from `1036`; event detail projection resolved from debug source | display-only key/value or terminal text | source owns truth |
| route status | Model 0 route labels and MBR route status through explicit projection adapter | display-only route rows | Model 0 / MBR owns truth |
| bottom composer | `1036` local draft plus formal send path from 0336 | writable draft only | `1036` owns draft |

## 5. Refresh And Action Contract

### 5.1 Read Refresh
Refreshing live projection is a formal business event and must use:

```text
UI click
  -> bus_event_v2
  -> Model 0 (0,0,0) pin.bus.in
  -> pin route
  -> system model / projection adapter
  -> projection labels updated in the owning model
  -> Workspace re-renders Console from snapshot
```

The refresh payload must be a temporary ModelTable record array.

### 5.2 Composer Send
Existing 0336 send path remains unchanged:

```text
UI Send
  -> bus_event_v2
  -> Model 0 (0,0,0) pin.bus.in
  -> mgmt_bus_console_send_route
  -> Model -10 mgmt_bus_console_intent
```

0338 must not introduce a second send path.

### 5.3 Forbidden Actions
- No browser direct Matrix send.
- No frontend direct write to `Model -100`, `Model 0`, MBR route models, or Matrix Chat models.
- No generic CRUD request from Console to MBR.
- No object envelope as formal `pin.bus.in` payload.
- No hidden fallback to direct target-cell writes if Model 0 ingress fails.

## 6. UI Contract
The implementation should first extend Model `1036` with existing components:
- `Table` for subject and route rows.
- `Terminal` for timeline and inspector raw trace.
- `Tabs` for Event / Route inspector.
- `StatusBadge` for readiness, route state, refresh result.
- `Button` for refresh and existing Send.

Dedicated components are allowed only if a later implementation proves existing components are insufficient. If introduced, they require:
- UI model contract labels.
- Renderer mapping.
- Deterministic renderer tests.
- Browser verification on `http://127.0.0.1:30900/#/workspace`.

Candidate components:
- `RoomList`
- `EventTimeline`
- `EventInspector`
- `Composer`

## 7. Validation Contract
A later implementation iteration must add deterministic tests for:
- Model `1036` remains mounted and renders with non-empty projection after seeded source projection labels exist.
- Changing the source projection labels changes the Console projection without writing Matrix/route truth into `1036`.
- `1036` forbidden keys / secret-like values are absent.
- Refresh button emits `bus_event_v2` to Model 0 with temporary ModelTable record array payload.
- Invalid refresh payload is rejected and produces observable error.
- Browser flow opens `Mgmt Bus Console`, triggers refresh, verifies rendered projection, and observes zero `/_matrix/client` requests from the browser.
- Existing 0336 Send path still routes to `-10.mgmt_bus_console_intent`.

## 8. Risks
- Projection adapter could accidentally duplicate truth into `1036` instead of writing to the owning projection model.
- Displaying Matrix event details could leak secrets if source projection is not redacted.
- Refresh could be mistaken for a local UI draft update and bypass Model 0 ingress.
- Adding dedicated components too early could hard-code business behavior in frontend.

## 9. Done Criteria For This Planning Iteration
- `docs/ITERATIONS.md` registers `0338-mgmt-bus-console-live-projection`.
- This plan defines data ownership, projection sources, forbidden actions, UI contract, validation contract, and out-of-scope items.
- `resolution.md` defines executable implementation steps for a later Phase 3.
- `runlog.md` records this planning work and sub-agent review results.
- A spawned sub-agent using `codex-code-review` returns `APPROVED` with no findings, or all findings are fixed and re-reviewed.
- No implementation code is changed.
