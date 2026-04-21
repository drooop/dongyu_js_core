---
title: "0326 — ui-event-ingress-via-model0-busin Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-22
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
  - 前端本地/远端 store 与 local bus adapter 统一改为 v2 envelope；不再把 `EDITOR_MODEL_ID` mailbox `ui_event` 当成业务入口真值
  - `default_table_programs.json`（0324 新文件）的 `mt_bus_receive` + `mt_bus_send` code 从骨架填业务
  - 0321 `materializeImportedHostIngressAdapter` 合并到新 ingress 链（可能简化 adapter — imported app boundary pin 直接经 mt_bus_receive 分发）
  - 0322 imported egress 改成 `mt_bus_send -> Model 0 pin.bus.out -> processEventsSnapshot bridge.sendMatrix` 单路径；删除 `forward_imported_*` 宿主 forward func 触发链
  - 彻底删除 `EDITOR_MODEL_ID (0,0,1) ui_event` 业务写入路径与 `submitEnvelope {target, pin, value}` 对任意子模型 cell 的直达分支
  - `scripts/tests/test_0326_ui_event_busin_flow.mjs`（新）端到端测试
  - `scripts/tests/test_0326_ui_event_busin_playwright.mjs`（新）本地浏览器 smoke，固定验证 imported app submit 的可见行为与 `pin.bus.out` 桥接
  - 0319 追溯改写 snapshot 一起 merge 同窗口（0319 分支独立处理）
- Out of scope:
  - `CLAUDE.md` / `docs/WORKFLOW.md` / handover 系统性文案大对齐（留 0327）
  - V1N API 层（0325）
  - 0324 三程序种植（已完成）

## Invariants / Constraints

- 所有前端业务事件必须经 Model 0 `(0,0,0)` `pin.bus.in`：不允许 server 直接 addLabel 到子模型 cell
- 数据链路：**Model 0 (0,0,0) pin.bus.in → pin.connect.model → 子模型 root pin.in → 子模型 `(0,0,0) mt_bus_receive:in` → mt_bus_receive 解包并分发**
- Phase 3 顺序约束：先把 `Model 0 bus.in -> child mt_bus_receive -> mt_write / mt_bus_send -> pin.bus.out` 主链跑通并用新测试证明，再删除 mailbox/direct-pin/forward-func 旧入口；最终态不保留兼容
- **Egress 路径绑定 Option A**（resolution Step 4 之硬承诺）：mt_bus_send on Model 0 只写 `pin.bus.out`；Matrix publish 由 `processEventsSnapshot` 捕获 `pin.bus.out` 事件后调用 `programEngine.sendMatrix`。**不保留** Option B（0322 forward func 作为 Matrix publisher）作为 fallback；若 phase3 执行遇到 runtime bridge 限制必须走 B，需单独在 runlog 申诉并暂停 phase3 等 user 决策，不得自行回退
- `mt_bus_receive` code 业务：
  - value 形态：`{ target_cell: {p, r, c}, target_pin: 'xxx', value: <任意> }`（pin_payload v1 已冻结 — 见 0323 host_ctx_api §2）
  - 执行：在模型内部发请求给 (0,0,0) `mt_write_req` 让 mt_write 把 value 写到 target_cell 的 target_pin
- `bus_in_key` 白名单（v1）：
  - `ui_submit` — 一次性 submit / confirm
  - `ui_click` — 无自由文本载荷的 click
  - `ui_input` — 输入中间态 / draft
  - `ui_edit` — 结构化 edit / save
  - 未知 key 或 legacy `ui_event` body 一律拒绝，返回可判定错误（`invalid_bus_in_key` / `legacy_ui_event_shape`）
- `mt_bus_send` code 业务（0323 §5.2g 延后项）：
  - 本模型内任意 cell 的外发 pin → pin.connect.label → `(0,0,0) mt_bus_send:in` → mt_bus_send 打包 → 上行到父模型边界 pin.out
  - Model 0 的 mt_bus_send 特殊：上行到 `pin.bus.out`；runtime 负责 MQTT publish，`processEventsSnapshot` 仅基于 `pin.bus.out` 事件桥接 Matrix publish
- 无兼容层：mailbox Model -1 ui_event 第一落点代码彻底删，不保留
- `EDITOR_MODEL_ID (0,0,1)` mailbox 在 0326 后不再承载任何 `ui_event*` 业务或状态 label；若 editor chrome 仍需状态反馈，必须迁到非-mailbox state labels
- Legacy forbidden symbol set（0326 完成时在实现面必须退出 current truth）：
  - `ui_event`
  - `ui_event_error`
  - `ui_event_last_op_id`
  - `ui_event_*` 派生 action/mailbox 键
  - `forward_imported_*`
  - `model0_egress_label`
  - `model0_egress_func`
  - `submitEnvelope` 对 `target.model_id != 0` 的业务直达写入分支
- Implementation surface（0326 的零残留检查范围）：
  - `packages/ui-model-demo-server/server.mjs`
  - `packages/ui-model-demo-frontend/src/**`
  - `packages/worker-base/system-models/**`
- Current-truth doc surface（0326 同迭代必须改写的权威文档）：
  - `docs/ssot/runtime_semantics_modeltable_driven.md`
  - `docs/ssot/imported_slide_app_host_ingress_semantics_v1.md`
  - `docs/ssot/mt_v0_patch_ops.md`
  - `docs/user-guide/slide_delivery_and_runtime_overview_v1.md`
- Supported entrypoints（Phase 3 必须全部证死旧路径）：
  - HTTP `/ui_event`
  - 前端 remote queue / `remote_store`
  - 前端 local adapter / `local_bus_adapter`
  - imported app 生成期 host ingress / host egress adapters
  - `processEventsSnapshot` 的 egress 恢复与桥接路径
  - Model 0 `pin.bus.in` / MQTT ingress
- Historical exception rule：
  - forbidden symbol 只允许出现在显式 `Historical` / `Retired (pre-0326)` 小节
  - 该小节不得使用 `current` / `active` / `formal path` / `must` 等规范性措辞描述旧路径
  - 小节必须同时给出 0326 后的正式替代路径
  - 默认允许列表为空；若确需保留历史符号，必须在 `runlog.md` 中登记精确 allowlist，且不得阻断“旧路径不可达”证明
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
   - `direct_pin_write_path_removed`
   - `imported_egress_reaches_matrix_via_pin_bus_out_bridge`
   - `legacy_ui_event_shape_rejected`
   - `unknown_bus_in_key_rejected`
5. imported app submit 按钮浏览器 smoke 通过（导入 0322 test zip → 点 submit → 观察 `pin.bus.out` 事件与 Matrix publish）
6. `processEventsSnapshot` 不再依赖 `model0_egress_label -> forward_imported_*` 触发 imported egress
7. 前端 remote/local 消费端不再要求业务事件必须占用 mailbox `ui_event` 单槽
8. 全量回归 0321 / 0322 / 0324 / 0325 / bus_in_out PASS
9. `obsidian_docs_audit` PASS
10. `docs/ssot/imported_slide_app_host_ingress_semantics_v1.md`、`docs/ssot/runtime_semantics_modeltable_driven.md` 与 `docs/ssot/mt_v0_patch_ops.md` 不再把 mailbox / `forward_imported_*` / `model0_egress_label` / `model0_egress_func` 写成 current truth
11. `runlog.md` 记录完整 proof artifact：测试命令、grep 命令、关键输出、以及 doc inventory 审计结论
12. Phase 3 仅在“旧路径对所有 supported entrypoints 均不可达”时通过；任何 alias、transitive import、generated fallback、config-driven fallback 若重开旧路径均算 FAIL

## Inputs

- Created at: 2026-04-21
- Iteration ID: `0326-ui-event-ingress-via-model0-busin`
- Source: 0323 resolution 第 1/3 条 + runlog "Model 0 mt_bus_send 上行后的外发机制" 0323+1 延后项（本迭代处理）
- Depends on: 0324（mt_bus_receive / mt_bus_send 骨架）、0325（V1N API — mt_bus_receive code 可能用 V1N）
- Supersedes: 0319 `slide_delivery §3`"直达"口径（0319 Superseded-by-0326）
- Upstream memory: `project_0323_implementation_roadmap.md`
