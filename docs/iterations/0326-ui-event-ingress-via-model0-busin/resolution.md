---
title: "0326 — ui-event-ingress-via-model0-busin Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0326-ui-event-ingress-via-model0-busin
id: 0326-ui-event-ingress-via-model0-busin
phase: phase1
---

# 0326 — ui-event-ingress-via-model0-busin Resolution

## Execution Strategy

1. 契约测试锁定新 ingress 链每一跳
2. server `/ui_event` 入口改写
3. 填 `mt_bus_receive` / `mt_bus_send` 业务代码到 `default_table_programs.json`
4. 合并/简化 0321 ingress adapter 与 0322 egress forward func 到 mt_bus_* 统一链
5. 前端 bundle 改造
6. 清理 Model -1 ui_event 路径
7. 回归 + browser smoke + docs + runlog

## Step 1 — 契约测试

- Scope: 锁定 end-to-end 新 ingress 链
- Files:
  - `scripts/tests/test_0326_ui_event_busin_flow.mjs`（新）
- Test cases:
  - `ui_event_writes_model0_busin`: POST /ui_event → Model 0 (0,0,0) 的 `ui_submit` pin.bus.in 被写入
  - `busin_routes_via_pin_connect_model_to_child`: pin.connect.model 把 value 路由到 imported model root (0,0,0) 某 pin.in
  - `mt_bus_receive_dispatches_to_target_pin`: mt_bus_receive 解包 value 并经 mt_write 路由到目标 cell 的 target_pin
  - `imported_app_submit_end_to_end`: 前端 submit envelope → Model 0 bus.in → imported model → mt_bus_receive → handle_submit → pin.out submit → mt_bus_send → Model 0 pin.bus.out → MQTT/Matrix publish
  - `mailbox_model_minus1_not_written_by_ui_event`: 前端 POST 后 Model -1 (0,0,1) 的 ui_event 不被写入
- Verification: 所有新测试初始 FAIL
- Acceptance: 契约端到端明确
- Rollback: 删测试文件

## Step 2 — server.mjs `/ui_event` 入口改造

- Scope: HTTP 入口写 Model 0 pin.bus.in；删子模型直达路径
- Files:
  - `packages/ui-model-demo-server/server.mjs` — `/ui_event` route / `submitEnvelope` 内部
- Changes:
  - body shape 改为 `{type:'ui_event_v2', bus_in_key, value, meta}`
  - server 收到后：`runtime.addLabel(Model0, 0, 0, 0, { k: bus_in_key, t:'pin.bus.in', v: value })` — 自动触发 `_applyBuiltins` 的 pin.bus.in 分支，走 `_routeViaCellConnection + _routeViaModelConnection`
  - 删除 `submitEnvelope` 里对 `target.model_id != 0` 时直接 addLabel 到子模型 cell 的逻辑
- Verification: Step 1 `ui_event_writes_model0_busin` + `busin_routes_via_pin_connect_model_to_child` PASS
- Acceptance: HTTP 入口只写 bus.in
- Rollback: revert commit

## Step 3 — 填 mt_bus_receive 与 mt_bus_send 业务

- Scope: 0324 种的骨架填业务
- Files:
  - `packages/worker-base/system-models/default_table_programs.json`
- `mt_bus_receive` 行为：
  - 接收 `mt_bus_receive:in` pin.in value
  - value 形态 `{ target_cell:{p,r,c}, target_pin, value }`
  - 构造 `mt_write_req` request → `V1N.addLabel('mt_write_req', 'pin.in', { op:'write', records:[{p, r, c, k: target_pin, t: 'pin.in', v: value}] })`
  - 经本模型 (0,0,0) mt_write 落盘到目标 cell 的 target_pin
- `mt_bus_send` 行为：
  - 接收 `mt_bus_send:in` pin.in value — 来自本模型内某 cell 的外发 pin 经 pin.connect.label 传入
  - 本模型为 **子模型**：value 路由到 root `pin.out` 经模型边界上行（父模型可见）
  - 本模型为 **Model 0**：value 路由到同 cell 的 `pin.bus.out` label → 触发 MQTT publish；Matrix publish 走 programEngine ctx.sendMatrix（与 0322 forward func 合并）
- Verification: Step 1 `mt_bus_receive_dispatches_to_target_pin` + `imported_app_submit_end_to_end` PASS
- Acceptance: 三程序从骨架到业务完成
- Rollback: revert JSON

## Step 4 — 0321 / 0322 adapter 合并到 mt_bus_* 链

- Scope: 调整宿主 adapter 与 egress forward func 使之统一走 mt_bus_* 路径
- Files:
  - `packages/ui-model-demo-server/server.mjs` — `materializeImportedHostIngressAdapter` + `materializeImportedHostEgressAdapter` + `buildImportedHostEgressForwardCode`
- Ingress：
  - 旧：imported app boundary pin 由独立 `imported_host_submit_<id>` pin.bus.in 接收，经 pin.connect.model 到 imported root relay
  - 新：imported app boundary pin 通过 `ui_<role>` pin.bus.in（统一命名，如 `ui_submit`）接收，pin.connect.model 到 imported root pin.in，再经 imported root `mt_bus_receive` 分发
  - adapter 简化：不再种特化 bus.in；只登记 "imported app N 的 target_cell 映射" 到 mt_bus_receive 内部路由表（若需要）
- Egress：
  - 旧：imported app `submit` pin.out → mountBridge → Model 0 `imported_submit_<id>_out` → forwardFunc (programEngine) → `pin.bus.out` + Matrix
  - 新：imported app `submit` pin.out → 父模型 → Model 0 `mt_bus_send:in` → mt_bus_send 执行 publish（pin.bus.out + Matrix via programEngine 路径）
  - 如果 mt_bus_send 无法访问 Matrix（runtime ctx 不含 sendMatrix），egress publish 仍需走 programEngine executeFunction 路径 — 具体选项：
    - A: Model 0 mt_bus_send 只做 pin.bus.out 写入；Matrix 发送由 processEventsSnapshot 捕获 pin.bus.out 事件后转 programEngine.sendMatrix
    - B: 保留 0322 egress forward func 作为 Matrix publisher，mt_bus_send 触发它
  - 推荐 A：更接近 0323 spec 的"单路径"理想；Matrix 在 tier 2 bridge 触发
- Verification: 0321 / 0322 回归 PASS
- Acceptance: 路径统一；无双重 adapter
- Rollback: revert adapter 改动

## Step 5 — 前端 bundle

- Scope: envelope 发送端 + 事件类别 key
- Files:
  - `packages/ui-model-demo-frontend/src/remote_store.js`
  - `packages/ui-model-demo-frontend/src/demo_modeltable.js`
  - 其他 envelope-related 前端代码
- Changes:
  - envelope shape 改为 `{type:'ui_event_v2', bus_in_key, value, meta:{op_id}}`
  - bus_in_key 按事件类别分（submit / click / input / edit 等），形成 正式 key 小集合（在 plan.md invariants 里定稿）
- Verification:
  - `cd packages/ui-model-demo-frontend && npm run build` 过
  - Browser smoke: 启 server + frontend，导入 0322 test zip，点 submit → 观察后端 mt_bus_send + MQTT/Matrix publish
- Acceptance: bundle 过；浏览器跑通新链路
- Rollback: revert bundle

## Step 6 — Model -1 ui_event 路径清理

- Scope: 删除 UI 事件第一落点在 mailbox 的代码
- Files:
  - `packages/ui-model-demo-server/server.mjs` — 所有 `addLabel(EDITOR_MODEL_ID, 0, 0, 1, ui_event, ...)` 写入点
  - `processEventsSnapshot` 里 EDITOR_MODEL_ID ui_event 段
- Verification: Step 1 `mailbox_not_written_by_ui_event` PASS；editor chrome 功能（命令面板等）若仍走 mailbox 可评估是否降级到仅 chrome scope
- Acceptance: 无 UI 业务事件走 Model -1
- Rollback: revert commit

## Step 7 — 回归 + docs + runlog

- Commands:
  - `for t in scripts/tests/test_0321_*.mjs scripts/tests/test_0322_*.mjs scripts/tests/test_0324_*.mjs scripts/tests/test_0325_*.mjs scripts/tests/test_0326_*.mjs scripts/tests/test_bus_in_out.mjs; do node $t || exit 1; done`
  - `node scripts/ops/obsidian_docs_audit.mjs --root docs`
- Files:
  - `docs/ssot/imported_slide_app_host_ingress_semantics_v1.md` — 更新 §3-§9 反映统一 ingress/egress 链
  - `docs/user-guide/slide_delivery_and_runtime_overview_v1.md` — §3 改写为 "Model 0 pin.bus.in → 父子 → 子模型 mt_bus_receive"
  - `docs/iterations/0326-*/runlog.md` — 填实
  - 0319 Superseded merge 同窗口：`git checkout dev && git merge --no-ff dev_0319-*`（与本迭代 merge 同批）
- Acceptance: 全绿 + docs 一致 + 0319 historical record 入 dev
