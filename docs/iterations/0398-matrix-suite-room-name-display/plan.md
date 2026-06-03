---
title: "0398 - Matrix Suite Room Name Display Plan"
doc_type: iteration-plan
status: approved
updated: 2026-05-29
source: ai
iteration_id: 0398-matrix-suite-room-name-display
id: 0398-matrix-suite-room-name-display
phase: approved
---

# Iteration 0398-matrix-suite-room-name-display Plan

## Goal

- Matrix Suite 房间列表默认只展示用户可读的房间名称。
- Matrix room id 不再混在列表正文中；id 只在 hover 提示或进入房间后的详情区域展示。
- 保持 0397 已打通的真实 Matrix refresh / send path 不变。

## Scope

- In scope:
- 调整 Matrix Suite 房间列表投影文本，使默认列表以 room name 为主。
- 保留 room id 在详情区域；如果当前 Terminal 展示能力支持 hover detail，则在 hover detail 中保留 id。
- 增加合同测试，防止列表再次退回到 name/id 混排。
- Out of scope:
- 不改 Matrix 收发、登录、topic、bus_event_v2、Model 0 ingress 规则。
- 不改房间选择逻辑；`target_room_id` 输入仍可直接填 Matrix room id。

## Invariants / Constraints

- UI 模型和程序模型仍是 ModelTable truth；前端不新增 Matrix direct call。
- 房间 id 可以用于内部选择和详情，但列表正文必须优先可读。
- 详情区必须仍能看到 room id，便于调试和复制。

## Success Criteria

- 合同测试证明 `rooms_text` 只显示房间名称/未读数，不直接显示 Matrix room id。
- 合同测试证明 `room_inspector_markdown` 仍显示所选房间 id。
- 本地浏览器打开 Matrix Suite，刷新 rooms 后列表看到名称，详情中可看到 id。
- 0397 Matrix Suite 合同测试和 UI AST 校验仍通过。

## Inputs

- Created at: 2026-05-29
- Iteration ID: 0398-matrix-suite-room-name-display
- Branch: `dropx/dev_0398-matrix-suite-room-name-display`
- User signal: 房间列表显示名称，id 只在 hover 或详情里展示。
