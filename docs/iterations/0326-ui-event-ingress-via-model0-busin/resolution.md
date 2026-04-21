---
title: "0326 — ui-event-ingress-via-model0-busin Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-04-22
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
5. 前端 bundle + local bus adapter 改造
6. 清理 mailbox / direct-pin / imported forward func 旧路径
7. 回归 + browser smoke + docs + runlog

## Step 1 — 契约测试

- Scope: 锁定 end-to-end 新 ingress 链
- Files:
  - `scripts/tests/test_0326_ui_event_busin_flow.mjs`（新）
  - `scripts/tests/test_0326_ui_event_busin_playwright.mjs`（新，Step 7 使用）
- Test cases:
  - `ui_event_writes_model0_busin`: POST /ui_event → Model 0 (0,0,0) 的 `ui_submit` pin.bus.in 被写入
  - `busin_routes_via_pin_connect_model_to_child`: pin.connect.model 把 value 路由到 imported model root (0,0,0) 某 pin.in
  - `mt_bus_receive_dispatches_to_target_pin`: mt_bus_receive 解包 value 并经 mt_write 路由到目标 cell 的 target_pin
  - `imported_app_submit_end_to_end`: 前端 submit envelope → Model 0 bus.in → imported model → mt_bus_receive → handle_submit → pin.out submit → mt_bus_send → Model 0 pin.bus.out → MQTT/Matrix publish
  - `mailbox_model_minus1_not_written_by_ui_event`: 前端 POST 后 Model -1 (0,0,1) 的 ui_event 不被写入
  - `direct_pin_write_path_removed`: `submitEnvelope` 不再接受 `target.model_id != 0` 的业务 pin 直达写入
  - `imported_egress_reaches_matrix_via_pin_bus_out_bridge`: imported app submit 的 Matrix publish 来源是 `pin.bus.out` 事件桥，而不是 `forward_imported_*`
  - `legacy_ui_event_shape_rejected`: 旧 `ui_event` body 被明确拒绝
  - `unknown_bus_in_key_rejected`: 白名单外 `bus_in_key` 被明确拒绝
  - `legacy_imported_egress_branches_absent`: `forward_imported_*` / `model0_egress_label` 不再可触发旧 egress
  - `legacy_symbol_set_absent`: `ui_event*` / `forward_imported_*` / `model0_egress_label` / `model0_egress_func` 在实现面不再作为 current truth 存在
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
  - 本模型为 **Model 0**：value 路由到同 cell 的 `pin.bus.out` label；runtime 负责 MQTT publish，`processEventsSnapshot` 再基于该 `pin.bus.out` 事件桥接 Matrix publish；不复用 0322 forward func
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
  - 新：imported app `submit` pin.out → 父模型 → Model 0 `mt_bus_send:in` → mt_bus_send 只写 `pin.bus.out`；`processEventsSnapshot` 捕获 `pin.bus.out` 事件后调用 `programEngine.sendMatrix`
  - 删除 `forward_imported_*` 宿主 forward func 与 `model0_egress_label` 触发链，不保留双路径
- Verification: 0321 / 0322 回归 PASS
- Acceptance: 路径统一；无双重 adapter
- Rollback: revert adapter 改动

## Step 5 — 前端 bundle + local bus adapter

- Scope: envelope 发送端 + 事件类别 key
- Files:
  - `packages/ui-model-demo-frontend/src/remote_store.js`
  - `packages/ui-model-demo-frontend/src/demo_modeltable.js`
  - `packages/ui-model-demo-frontend/src/local_bus_adapter.js`
  - 其他 envelope-related 前端代码
- Changes:
  - envelope shape 改为 `{type:'ui_event_v2', bus_in_key, value, meta:{op_id}}`
  - bus_in_key 按事件类别分（submit / click / input / edit 等），形成 正式 key 小集合（在 plan.md invariants 里定稿）
  - remote/local 前端消费端不再把 mailbox `ui_event` 当作业务入口真值
  - `EDITOR_MODEL_ID (0,0,1)` mailbox 上的 `ui_event` / `ui_event_error` / `ui_event_last_op_id` 标签族一并退役；若 editor chrome 仍需状态反馈，迁到非-mailbox state labels
- Verification:
  - `cd packages/ui-model-demo-frontend && npm run build` 过
  - Browser smoke 依赖脚本：`node scripts/tests/test_0326_ui_event_busin_playwright.mjs --base-url http://127.0.0.1:30900`
- Acceptance: bundle 过；浏览器跑通新链路
- Rollback: revert bundle

## Step 6 — 清理 mailbox / direct-pin / imported forward func 旧路径

- Scope: 删除 UI 事件第一落点在 mailbox 的代码及 imported egress 旧触发链
- Files:
  - `packages/ui-model-demo-server/server.mjs` — 所有 `addLabel(EDITOR_MODEL_ID, 0, 0, 1, ui_event, ...)` 写入点
  - `processEventsSnapshot` 里 EDITOR_MODEL_ID ui_event 段
  - `submitEnvelope` 里对 `target.model_id != 0` 的业务 `pin.in` 直达写入分支
  - imported egress `forward_imported_*` 宿主 forward func 生成、触发与恢复逻辑
- Verification:
  - Step 1 `mailbox_not_written_by_ui_event` + `direct_pin_write_path_removed` + `imported_egress_reaches_matrix_via_pin_bus_out_bridge` + `legacy_imported_egress_branches_absent` PASS
  - `rg -n "forward_imported_|model0_egress_label|model0_egress_func" packages/ui-model-demo-server/server.mjs packages/worker-base/system-models` 返回 0
  - `rg -n "ui_event(_|\\b)|ui_event_error|ui_event_last_op_id" packages/ui-model-demo-server/server.mjs packages/ui-model-demo-frontend/src` 返回 0
- Acceptance: 无 UI 业务事件或状态反馈走 Model -1 mailbox；无 imported egress 双路径
- Rollback: revert commit

## Step 7 — 回归 + docs + runlog

- Commands:
  - `bash scripts/ops/ensure_runtime_baseline.sh`
  - `for t in scripts/tests/test_0321_*.mjs scripts/tests/test_0322_*.mjs scripts/tests/test_0324_*.mjs scripts/tests/test_0325_*.mjs scripts/tests/test_0326_*.mjs scripts/tests/test_bus_in_out.mjs; do node $t || exit 1; done`
  - `node scripts/tests/test_0326_ui_event_busin_playwright.mjs --base-url http://127.0.0.1:30900`
  - `node scripts/ops/obsidian_docs_audit.mjs --root docs`
  - `rg -n "forward_imported_|model0_egress_label|model0_egress_func" packages/ui-model-demo-server/server.mjs packages/worker-base/system-models`
  - `rg -n "ui_event(_|\\b)|ui_event_error|ui_event_last_op_id" packages/ui-model-demo-server/server.mjs packages/ui-model-demo-frontend/src`
  - `rg -n "ui_event(_|\\b)|ui_event_error|ui_event_last_op_id|forward_imported_|model0_egress_label|model0_egress_func" docs/ssot/runtime_semantics_modeltable_driven.md docs/ssot/imported_slide_app_host_ingress_semantics_v1.md docs/ssot/mt_v0_patch_ops.md docs/user-guide/slide_delivery_and_runtime_overview_v1.md`
- Files:
  - `docs/ssot/runtime_semantics_modeltable_driven.md` — living docs 对齐 `Model 0 pin.bus.in` ingress 与 mailbox 退役口径
  - `docs/ssot/imported_slide_app_host_ingress_semantics_v1.md` — 更新 §3-§9 反映统一 ingress/egress 链
  - `docs/ssot/mt_v0_patch_ops.md` — 退役 `ui_event*` family 的 current-truth 口径
  - `docs/user-guide/slide_delivery_and_runtime_overview_v1.md` — §3 改写为 "Model 0 pin.bus.in → 父子 → 子模型 mt_bus_receive"
  - `docs/iterations/0326-*/runlog.md` — 填实
  - 0319 Superseded merge 同窗口：`git checkout dev && git merge --no-ff dev_0319-slide-overview-gap-closure`（与本迭代 merge 同批）
- Acceptance:
  - 全量测试与 Playwright smoke 通过
  - 实现面 `legacy forbidden symbol set` grep 清零
  - doc inventory = `runtime_semantics` / `imported_slide_app_host_ingress_semantics_v1` / `mt_v0_patch_ops` / `slide_delivery_and_runtime_overview_v1`
  - 上述 doc inventory 不再把该 symbol set 写成 current truth；如需保留历史注记，必须显式标为 `Historical` / `Retired (pre-0326)`，且同节给出 0326 后正式替代路径
  - 上述 docs grep 命中若非 0，必须全部出现在显式 `Historical` / `Retired (pre-0326)` 标题下，并逐条登记到 `runlog.md` allowlist；否则 FAIL
  - supported entrypoints = HTTP `/ui_event`、remote_store、local_bus_adapter、generated imported host adapters、`processEventsSnapshot` egress recovery/bridge、Model 0 `pin.bus.in`/MQTT ingress；旧路径对这些入口必须全部不可达
  - alias/transitive import/generated fallback/config-driven fallback 若可重开旧路径，则本 Step 直接 FAIL
  - 历史例外 allowlist 默认空；若确需保留，必须在 `runlog.md` 逐条登记且证明不影响“旧路径不可达”
  - `runlog.md` 必须记录 proof artifact：测试命令、grep 命令、关键输出、doc inventory 审计结论
  - 0319 historical record 入 dev
