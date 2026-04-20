---
title: "0326 — ui-event-ingress-via-model0-busin Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0326-ui-event-ingress-via-model0-busin
id: 0326-ui-event-ingress-via-model0-busin
phase: phase1
---

# 0326 — ui-event-ingress-via-model0-busin Plan

## Goal

- 把前端所有 UI 事件入口统一改为：**浏览器 → server → `pin.bus.in` on Model 0 `(0,0,0)` → pin.connect.model → 子模型 root `pin.in` → 子模型 `(0,0,0) mt_bus_receive` 程序模型**（mt_bus_receive 在 0324 已种骨架，本迭代填业务）
- 废弃两条旧路径：
  - `ui_event → mailbox (Model -1, cell (0,0,1))` 作为 UI 事件第一落点（彻底移除）
  - `submitEnvelope {target, pin, value}` 对子模型目标 cell 的直达写入
- imported slide app 的 `submit` 按钮自然落在 "Model 0 pin.bus.in → 父子链 → 子模型 (0,0,0) mt_bus_receive" 末端；0321 ingress adapter 与新 ingress 合并
- 同时完成 0323 spec §5.2g 提到的 "Model 0 mt_bus_send 上行后的外发机制明确（pin.bus.out 触发链）" — 与 0322 egress 路径合并

## Scope

- In scope:
  - `packages/ui-model-demo-server/server.mjs` `/ui_event` HTTP 入口改写 + `submitEnvelope` 内部路径
  - 前端 `packages/ui-model-demo-frontend/` envelope 发送端 — 改 shape 为 `{type:'ui_event_v2', bus_in_key, value, meta}`
  - `default_table_programs.json`（0324 新文件）的 `mt_bus_receive` + `mt_bus_send` code 从骨架填业务
  - 0321 `materializeImportedHostIngressAdapter` 合并到新 ingress 链（可能简化 adapter — imported app boundary pin 直接经 mt_bus_receive 分发）
  - 0322 egress forward func 对接 mt_bus_send（或保留宿主特化 forward，本迭代 resolution 裁决）
  - 彻底删除 `EDITOR_MODEL_ID (0,0,1) ui_event` 写入路径
  - `scripts/tests/test_0326_ui_event_busin_flow.mjs`（新）端到端测试
  - 0319 追溯改写 snapshot 一起 merge 同窗口（0319 分支独立处理）
- Out of scope:
  - docs 大对齐（CLAUDE.md / slide_delivery §3 文字改写，留 0327）
  - V1N API 层（0325）
  - 0324 三程序种植（已完成）

## Invariants / Constraints

- 所有前端业务事件必须经 Model 0 `(0,0,0)` `pin.bus.in`：不允许 server 直接 addLabel 到子模型 cell
- 数据链路：**Model 0 (0,0,0) pin.bus.in → pin.connect.model → 子模型 root pin.in → 子模型 `(0,0,0) mt_bus_receive:in` → mt_bus_receive 解包并分发**
- `mt_bus_receive` code 业务：
  - value 形态：`{ target_cell: {p, r, c}, target_pin: 'xxx', value: <任意> }`（pin_payload v1 已冻结 — 见 0323 host_ctx_api §2）
  - 执行：在模型内部发请求给 (0,0,0) `mt_write_req` 让 mt_write 把 value 写到 target_cell 的 target_pin
- `mt_bus_send` code 业务（0323 §5.2g 延后项）：
  - 本模型内任意 cell 的外发 pin → pin.connect.label → `(0,0,0) mt_bus_send:in` → mt_bus_send 打包 → 上行到父模型边界 pin.out
  - Model 0 的 mt_bus_send 特殊：上行到 pin.bus.out（触发 MQTT + Matrix）
- 无兼容层：mailbox Model -1 ui_event 第一落点代码彻底删，不保留
- 破坏性变更：前端 bundle 必须同 PR rebuild；0321 ingress adapter 可能需要简化或合并；0322 egress forward func 可能需要调整为经 mt_bus_send 路径

## Success Criteria

1. 新 envelope：前端 POST `/ui_event` body = `{ type:'ui_event_v2', bus_in_key:'ui_submit', value, meta:{op_id}}`
2. server 收到后 `addLabel(Model0, 0, 0, 0, { k: bus_in_key, t:'pin.bus.in', v: value })`
3. 自动 pin.connect.model → 子模型 root → mt_bus_receive → 业务落盘
4. 新测试 `test_0326_ui_event_busin_flow.mjs`：
   - `ui_event_writes_model0_busin`
   - `busin_routes_via_pin_connect_model_to_child`
   - `mt_bus_receive_dispatches_to_target_pin`
   - `imported_app_submit_end_to_end`（与 0322 server_flow 合并）
   - `mailbox_model_minus1_not_written_by_ui_event`
5. imported app submit 按钮浏览器 smoke 通过（导入 0322 test zip → 点 submit → 后端 forward publish）
6. 全量回归 0321 / 0322 / 0324 / 0325 / bus_in_out PASS
7. `obsidian_docs_audit` PASS

## Inputs

- Created at: 2026-04-21
- Iteration ID: `0326-ui-event-ingress-via-model0-busin`
- Source: 0323 resolution 第 1/3 条 + runlog "Model 0 mt_bus_send 上行后的外发机制" 0323+1 延后项（本迭代处理）
- Depends on: 0324（mt_bus_receive / mt_bus_send 骨架）、0325（V1N API — mt_bus_receive code 可能用 V1N）
- Supersedes: 0319 `slide_delivery §3`"直达"口径（0319 Superseded-by-0326）
- Upstream memory: `project_0323_implementation_roadmap.md`
