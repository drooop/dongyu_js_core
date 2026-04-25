---
title: "0335 — slide-flow-current-truth-realignment Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-26
source: ai
iteration_id: 0335-slide-flow-current-truth-realignment
id: 0335-slide-flow-current-truth-realignment
phase: phase1
---

# 0335 — slide-flow-current-truth-realignment Plan

## 0. Metadata
- ID: `0335-slide-flow-current-truth-realignment`
- Date: `2026-04-26`
- Owner: Codex
- Branch: `dev_0331-0333-pin-payload-ui`
- Type: planning / documentation realignment
- Implementation status: not started

## 1. Goal
把“滑动 APP”的过程说明重整成 4 段，并修正文档中已经过时的“浏览器事件先直达目标 cell”口径。此 iteration 先落计划，不直接改写用户指南正文。

## 2. Evidence Found
- `docs/user-guide/slide_delivery_and_runtime_overview_v1.md` 已经说明安装链和运行链，但运行时触发段仍写着“server 直接把目标 pin 写到目标 cell”和“浏览器事件先直达目标 cell”。
- `docs/ssot/runtime_semantics_modeltable_driven.md` 已在 0326 / 0331 后收口到 `bus_event_v2 -> Model 0 pin.bus.in`，并区分正式业务 ingress 与本地 UI 态。
- `docs/ssot/imported_slide_app_host_ingress_semantics_v1.md` 仍保留早期 direct-pin 过渡说明，需要在后续文档改写时明确标记为 historical / superseded where applicable。
- `docs/user-guide/slide_app_zip_import_v1.md` 可复用安装交付链说明。

## 3. Target Structure
后续文档应统一整理为以下 4 段。

### 3.1 安装交付
```text
zip
  -> /api/media/upload
  -> mxc://...
  -> importer truth
  -> importer click pin
  -> materialize / mount
```

重点说明：
- 安装链和运行链不是同一件事。
- importer truth 是安装过程 truth。
- materialize / mount 后才进入 Workspace 可运行状态。

### 3.2 App 结构
一个滑动 APP 至少拆成：
- root metadata
- UI projection layer
- optional program layer
- optional egress adapter

重点说明：
- root metadata 决定 app 是否可被 Workspace 识别和打开。
- UI projection layer 由 `cellwise.ui.v1` 等模型表 UI 规则渲染。
- program layer 是可选的，通常由 pin / func / owner materialize 组合。
- egress adapter 是可选的，只在需要外发时存在。

### 3.3 页面运行
```text
frontend renders cellwise.ui.v1
local draft / overlay stays local
formal business submit enters current pin chain
```

重点说明：
- 前端按 `cellwise.ui.v1` 渲染。
- 本地草稿 / overlay 不算正式业务。
- 正式业务提交必须进入当前 pin 链。
- 当前更高优先级事实是：正式业务入口经 `bus_event_v2 -> Model 0 pin.bus.in`，不是浏览器 direct 写目标 cell。

### 3.4 外发回流
```text
app root pin.out
  -> host / mount relay
  -> Model 0 mt_bus_send
  -> pin.bus.out
  -> Matrix / MBR / MQTT
  -> return packet
  -> Model 0
  -> owner materialization
  -> target model
```

重点说明：
- 只有显式接到外发链的动作才离开本地 runtime。
- 回包必须先回到 `Model 0`，再经 owner materialization 回到目标模型。
- 不允许 server 或前端绕过 owner materialization direct patch 目标模型。

## 4. Required Corrections
- 把“浏览器事件先直达目标 cell”改成 historical wording 或删除。
- 明确区分：
  - 本地 UI 草稿 / overlay
  - 正式业务 ingress
- 正式业务 ingress 的 current truth 应写为：
  - `bus_event_v2 -> Model 0 (0,0,0) pin.bus.in -> pin route -> target`
- 若需要保留早期 direct-pin 说明，只能放入历史/过渡说明，不能作为 current behavior。

## 5. Candidate Files For Follow-up Rewrite
- `docs/user-guide/slide_delivery_and_runtime_overview_v1.md`
- `docs/user-guide/slide_app_zip_import_v1.md`
- `docs/user-guide/slide_matrix_delivery_v1.md`
- `docs/ssot/imported_slide_app_host_ingress_semantics_v1.md`
- `docs/ssot/runtime_semantics_modeltable_driven.md`

## 6. Done Criteria For This Planning Iteration
- `docs/ITERATIONS.md` 登记 `0335-slide-flow-current-truth-realignment`。
- 本 plan 写明 4 段目标结构。
- 本 plan 明确指出旧 direct-cell wording 的修正方式。
- 没有实现代码改动。
