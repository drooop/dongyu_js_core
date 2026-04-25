---
title: "0334 — mgmt-bus-console-contract Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-26
source: ai
iteration_id: 0334-mgmt-bus-console-contract
id: 0334-mgmt-bus-console-contract
phase: phase1
---

# 0334 — mgmt-bus-console-contract Plan

## 0. Metadata
- ID: `0334-mgmt-bus-console-contract`
- Date: `2026-04-26`
- Owner: Codex
- Branch: `dev_0331-0333-pin-payload-ui`
- Type: planning / contract freeze
- Implementation status: not started

## 1. Goal
冻结一个正数模型 `Mgmt Bus Console` 的产品与数据合同，用 UI 模型组合出基础管理总线通讯界面。此 iteration 只定义合同、来源、数据流和验收项，不落代码实现。

## 2. Current Evidence To Reuse
- `Model -100 Matrix Debug` 已有 Matrix / bus trace 观察面。
- `Model 1016-1021 Matrix Chat` 已有用户聊天相关模型。
- `Model 0` 已承载 `pin.bus.in` / `pin.bus.out`、Matrix/MQTT bootstrap 配置和 bus route。
- MBR route 信息已经存在于系统模型与运行态链路中。
- `matrix-js-sdk` 可作为 Matrix room / timeline / event inspector 交互模型参考，但不得复制其 SDK 内部状态作为本项目 truth。

## 3. Contract Summary

### 3.1 Positive Model
- 新建一个正数 `model.table` app，产品名为 `Mgmt Bus Console`。
- 具体 `model_id` 在实现 iteration 中分配，必须避开已有正数模型；候选范围可从当前最大正数 model id 之后递增。
- root `(0,0,0)` 最少声明：
  - `model_type = model.table`
  - `app_name = Mgmt Bus Console`
  - `slide_capable = true`
  - `slide_surface_type = workspace.page`
  - `ui_authoring_version = cellwise.ui.v1`
  - `ui_root_node_id = mgmt_bus_console_root`

### 3.2 UI Regions
界面先用现有 `cellwise.ui.v1` 能力组合，不新增组件作为第一选择。

| Region | Purpose | First-choice components |
|---|---|---|
| left | subject / room list | `Container`, `Card`, `Tabs`, `Table`, `StatusBadge` |
| center | event timeline | `Container`, `Card`, `Terminal`, `Table`, `StatusBadge` |
| bottom | composer | `Container`, `Input`, `Button`, `StatusBadge` |
| right | event inspector / route status | `Card`, `Tabs`, `Table`, `Terminal`, `StatusBadge` |

若现有组件无法表达清楚，再规划新增组件：
- `RoomList`
- `EventTimeline`
- `EventInspector`
- `Composer`

新增组件必须先补 UI 模型 contract 和 renderer 适配测试，不得直接在页面里硬编码业务 UI。

### 3.3 Truth Reuse
- 不复制 Matrix room truth。
- 不复制 MBR route truth。
- 不复制 Model 0 bus 配置 truth。
- Console 模型只能保存 UI selection、filter、composer draft、inspector open state 等本地界面状态。
- Console 可投影或引用以下来源：
  - `Model -100 Matrix Debug` 的 trace / readiness / subject summary
  - `Model 1016-1021 Matrix Chat` 的 room/chat state
  - `Model 0` 的 bus config 与 route labels
  - MBR route status 的现有来源

### 3.4 Send Path
所有正式发送必须走当前主线：

```text
UI event
  -> bus_event_v2
  -> Model 0 (0,0,0) pin.bus.in
  -> pin route
  -> target model / MBR
```

payload 必须是临时 ModelTable record array，不允许对象 envelope 作为正式业务 pin value。

### 3.5 Validation Contract
实现 iteration 至少要覆盖这些验证：
- 无前端 direct Matrix send。
- 无 Matrix token / password / access secret 泄漏到 client snapshot、console UI 或 trace summary。
- invalid payload 被 server/runtime 拒绝，并写出可观察错误。
- Matrix live adapter 忽略 initial sync / backfill，只处理 live event。
- MBR 拒绝 generic CRUD，只接受明确的管理总线动作。

## 4. Out of Scope
- 不实现新界面。
- 不新增 renderer 组件。
- 不改 Matrix live adapter 行为，除非后续实现验证发现现有能力不够。
- 不改 MBR CRUD 策略，只把拒绝 generic CRUD 作为验收项。
- 不复制 `Model -100` / `Model 1016-1021` / `Model 0` 的 truth 到新模型。

## 5. Implementation Follow-up Steps
后续实现 iteration 可拆成：
1. Contract tests: 证明 UI surface、truth reuse、send path、secret redaction 规则可执行。
2. Positive model fill-table surface: 用 `Container/Card/Tabs/Table/Terminal/Input/Button/StatusBadge` 组合四区界面。
3. Event dispatch: composer/button 只发 `bus_event_v2` 临时 ModelTable payload。
4. Inspector and route status: 从既有 truth 投影，不复制。
5. Browser E2E: 打开 Workspace，选择 Mgmt Bus Console，点击发送，确认路径与 UI 状态。

## 6. Done Criteria For This Planning Iteration
- `docs/ITERATIONS.md` 登记 `0334-mgmt-bus-console-contract`。
- 本 plan 明确 UI 分区、truth 来源、发送路径、验证项和非目标。
- 没有实现代码改动。
