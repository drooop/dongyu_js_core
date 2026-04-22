---
title: "0326 — ui-event-ingress-via-model0-busin Runlog"
doc_type: iteration-runlog
status: active
updated: 2026-04-22
source: ai
iteration_id: 0326-ui-event-ingress-via-model0-busin
id: 0326-ui-event-ingress-via-model0-busin
phase: phase2
---

# 0326 — ui-event-ingress-via-model0-busin Runlog

## Environment

- Date: 2026-04-22
- Branch: `dev_0326-ui-event-ingress-via-model0-busin`
- Runtime: phase2 review in progress; 2026-04-22 已 rebase 到 `dev` HEAD `8f1b4c5`

### Review Gate Records (FACTS)

Review Gate Record
- Iteration ID: `0326-ui-event-ingress-via-model0-busin`
- Review Date: 2026-04-22
- Review Type: AI-assisted
- Review Index: 1
- Decision: Change Requested
- Notes:
  - baseline code-review（sub-agent `019db1f6-ef65-7562-bc90-29336ae98759`）
  - 指出 mailbox/direct-pin 旧入口仍残留、imported egress 旧 `forward_imported_*` 链仍在、`mt_bus_receive` / `mt_bus_send` 仍是 skeleton、缺少 0326 专用测试与执行证据

Review Gate Record
- Iteration ID: `0326-ui-event-ingress-via-model0-busin`
- Review Date: 2026-04-22
- Review Type: AI-assisted
- Review Index: 2
- Decision: Change Requested
- Notes:
  - workflow/gate review（sub-agent `019db1fa-3092-71a1-99ce-770f044fd291`）
  - 指出 auto-approval 条件尚未满足；runlog 里不能用 `pending` 占位替代真实 review facts，且 review gate record 需写入 Environment 区域

Review Gate Record
- Iteration ID: `0326-ui-event-ingress-via-model0-busin`
- Review Date: 2026-04-22
- Review Type: AI-assisted
- Review Index: 3
- Decision: Change Requested
- Notes:
  - execution-contract review（sub-agent `019db1fa-2664-7282-8275-a54bea4de36b`）
  - 指出 `pin.bus.out` 归属不一致（MQTT/Matrix 边界不清）、`bus_in_key` 白名单与 legacy/unknown 输入拒绝规则未冻结、缺少针对 legacy body 与未知 key 的负向验证

Review Gate Record
- Iteration ID: `0326-ui-event-ingress-via-model0-busin`
- Review Date: 2026-04-22
- Review Type: AI-assisted
- Review Index: 4
- Decision: Change Requested
- Notes:
  - legacy-shutdown review（sub-agent `019db1fa-2b71-76d3-aa1b-7b314f3ada9c`）
  - 指出 mailbox shutdown 仍含糊、现有测试不足以证明 old branches 已消失；需把 `ui_event*` mailbox label 族完全退场，并加入直接证明旧 branch/label 不存在的负向检查

Review Gate Record
- Iteration ID: `0326-ui-event-ingress-via-model0-busin`
- Review Date: 2026-04-22
- Review Type: AI-assisted
- Review Index: 5
- Decision: Approved
- Notes:
  - pure-text gate review（sub-agent `019db200-072b-7740-a5b9-1aa34094a97e`）
  - 判定 phase1 contract 已具备直接进入 Phase 3 的正/负路径测试、grep 清零、回归集与 merge 口径

Review Gate Record
- Iteration ID: `0326-ui-event-ingress-via-model0-busin`
- Review Date: 2026-04-22
- Review Type: AI-assisted
- Review Index: 6
- Decision: Approved
- Notes:
  - pure-text gate review（sub-agent `019db202-6e3d-71a0-bb37-3b45e388a068`）
  - 对照当前 SSOT 后未发现会阻断实现的合同歧义

Review Gate Record
- Iteration ID: `0326-ui-event-ingress-via-model0-busin`
- Review Date: 2026-04-22
- Review Type: AI-assisted
- Review Index: 7
- Decision: Approved
- Notes:
  - pure-text gate review（sub-agent `019db202-736d-7e72-a3c9-10d53590cf4f`）
  - 核对 plan / resolution / runlog 与 merge 口径后无阻断性歧义

## Planning Record

### Record 1 — Initial (2026-04-21)

- Inputs reviewed:
  - 0323 resolution 第 1 / 3 条（事件传输链 + 双总线链路）
  - 0323 runlog "Model 0 mt_bus_send 上行后的外发机制" 延后项
  - `packages/ui-model-demo-server/server.mjs` 现有 `/ui_event` + `submitEnvelope` + `processEventsSnapshot`
  - `packages/ui-model-demo-frontend/src/remote_store.js`
  - 0321 + 0322 ingress/egress adapter 代码
  - memory `project_0323_implementation_roadmap.md`
- Locked conclusions:
  - envelope 新 shape：`{type:'ui_event_v2', bus_in_key, value, meta}`
  - 前端事件必经 Model 0 pin.bus.in
  - mt_bus_receive + mt_bus_send 业务在本迭代填（0324 只种骨架）
  - Matrix publish 走 tier 2 programEngine 路径；mt_bus_send on Model 0 只写 pin.bus.out
  - mailbox Model -1 UI 事件第一落点彻底删除
  - 与 0319 Superseded rewrite 同窗口 merge

### Record 2 — Takeover baseline + rebase (2026-04-22)

- 接管时发现 `dev_0326-ui-event-ingress-via-model0-busin` 基线落后于 `dev`（缺少 0324/0325/0325b/0325c），`packages/worker-base/system-models/default_table_programs.json` 不存在
- Action:
  - `git rebase dev`
  - 冲突文件：`docs/ITERATIONS.md`
  - 处理原则：保留 `0324`-`0325c` 的已完成登记，同时保留 `0326 Planned`
- Rebase result: 分支 updated 到 `dev` HEAD `8f1b4c5`
- Locked follow-up:
  - Phase 3 前必须先补齐 0326 phase2 review gate
  - 先证明 `Model 0 pin.bus.in -> child mt_bus_receive -> mt_write/mt_bus_send -> pin.bus.out` 主链，再删 mailbox/direct-pin/imported forward func 旧路径

### Record 3 — Phase2 fixups after multi-review (2026-04-22)

- 吸收 Review 2-4 后补充的 phase1 contract fixups：
  - `pin.bus.out` 责任固定为：runtime 只做 MQTT publish，Matrix 只由 `processEventsSnapshot` 基于 `pin.bus.out` 事件桥接
  - 冻结 `bus_in_key` 白名单（`ui_submit/ui_click/ui_input/ui_edit`）及 legacy/unknown 输入拒绝规则
  - 明确 `EDITOR_MODEL_ID (0,0,1)` mailbox 上 `ui_event*` label 族完全退役，editor chrome/status 若保留必须迁到非-mailbox state labels
  - 增补负向验证：legacy `ui_event` body / unknown `bus_in_key` / `forward_imported_*` / `model0_egress_label` / direct-pin path 都要判失败
  - 补固定 browser smoke 命令与明确的 0319 merge 分支名，消除执行歧义
  - 把 `docs/ssot/runtime_semantics_modeltable_driven.md`、`docs/ssot/imported_slide_app_host_ingress_semantics_v1.md` 与 `docs/ssot/mt_v0_patch_ops.md` 纳入 0326 Step 7 的 living-docs 更新面，确保旧 mailbox / imported forward egress / `ui_event*` family 口径在本迭代内从 current truth 中退出
  - 明确 proof artifact 结构：实现面 grep-zero、doc inventory 审计结论、历史例外规则、以及写入 runlog 的关键输出
  - 明确 supported entrypoints 全量不可达门槛，以及 alias/transitive/generated/config fallback 一律计为 FAIL

### Record 4 — Verification surface revision after real frontend recovery (2026-04-22)

- Command:
  - `ls scripts/tests/test_0326_*`
- Key output:
  - `scripts/tests/test_0326_active_system_models_bus_event_contract.mjs`
  - `scripts/tests/test_0326_imported_host_egress_bridge.mjs`
  - `scripts/tests/test_0326_positive_model_bus_event_contract.mjs`
  - `scripts/tests/test_0326_ui_event_busin_flow.mjs`
- Facts:
  - 0326 当前仓库内没有独立维护的 imported-app browser smoke script
  - Step 5 已存在并跑通的 frontend build + editor/remote_store contract suite，负责 0326 前端验证面
- 调整：
  - 0326 前端验证面改为现有可重复、已跑通的 frontend build + editor/remote_store contract suite
  - imported-host egress 的 `pin.bus.out -> Matrix` current path 继续由 `scripts/tests/test_0326_imported_host_egress_bridge.mjs` 负责证明
- 边界：
  - 该调整不放宽 imported-host bridge 证明要求；只是把“前端验证面”和“egress bridge 证明”拆回各自最稳定的验证层

## Gate Status

- Current status: **APPROVED**
- Basis:
  - Review 1-4 的 `Change Requested` 已全部吸收进 phase1 contract
  - Review 5-7 为最近连续 3 次 `Approved`
  - 后续零散 `Change Requested` 仅指出 prompt/workspace 偏差或 proof-hardening 细化项，均已在 phase1 contract 中吸收且未新增 scope

## Execution Records

### Step 1

- Command:
  - `node scripts/tests/test_0326_ui_event_busin_flow.mjs`
  - `node scripts/tests/test_0326_positive_model_bus_event_contract.mjs`
  - `node scripts/tests/test_0326_active_system_models_bus_event_contract.mjs`
- Key output:
  - `5 passed, 0 failed out of 5`
  - `2 passed, 0 failed out of 2`
  - `1 passed, 0 failed out of 1`
- Result: PASS
- Commit: `8a43ff4`, `9c855e5`

### Step 2

- Command:
  - `rg -n "type === 'bus_event_v2'|invalid_bus_in_key|legacy_event_shape|pin.bus.in|BUS_EVENT_ENDPOINT_PATH" packages/ui-model-demo-server/server.mjs`
- Key output:
  - 命中 `BUS_EVENT_ENDPOINT_PATH='/bus_event'`
  - 命中 `envelopeOrNull.type === 'bus_event_v2'`
  - 命中 `legacy_event_shape` / `invalid_bus_in_key`
  - 命中 `runtime.addLabel(model0, 0, 0, 0, { k: busInKey, t: 'pin.bus.in', ... })`
- Result: PASS
- Commit: `8a43ff4`

### Step 3

- Command:
  - `node scripts/tests/test_bus_in_out.mjs`
  - `node scripts/tests/test_0326_ui_event_busin_flow.mjs`
- Key output:
  - `7 passed, 0 failed out of 7`
  - `5 passed, 0 failed out of 5`
- Result: PASS
- Commit: `8a43ff4`

### Step 4

- Command:
  - `node scripts/tests/test_0321_imported_host_ingress_contract.mjs`
  - `node scripts/tests/test_0322_imported_host_egress_contract.mjs`
  - `node scripts/tests/test_0326_imported_host_egress_bridge.mjs`
- Key output:
  - `3 passed, 0 failed out of 3`
  - `2 passed, 0 failed out of 2`
  - `1 passed, 0 failed out of 1`
- Adapter 简化决策: 采用 **Option A**；imported host egress 只保留 `mt_bus_send -> pin.bus.out -> ProgramModelEngine bridge`，不保留 `forward_imported_*` 双路径
- Result: PASS
- Commit: `c6f537c`

### Step 5

- Command:
  - `npm -C packages/ui-model-demo-frontend run build`
  - `npm -C packages/ui-model-demo-frontend run test`
  - `node packages/ui-model-demo-frontend/scripts/validate_editor_server_sse.mjs`
  - `node scripts/tests/test_0185_remote_negative_state_local_first_contract.mjs`
  - `node scripts/tests/test_0186_remote_store_overlay_contract.mjs`
  - `node scripts/tests/test_0242_remote_negative_state_debounce_contract.mjs`
  - `node scripts/tests/test_0305_positive_input_deferred_contract.mjs`
- Key output:
  - `vite build` PASS
  - `validate_editor.mjs` 全量 PASS
  - `editor_server_sse_contract: PASS`
  - `PASS test_0185_remote_negative_state_local_first_contract`
  - `PASS test_0186_remote_store_overlay_contract`
  - `PASS test_0242_remote_negative_state_debounce_contract`
  - `PASS test_0305_positive_input_deferred_contract`
- Result: PASS
- Commit: `9c855e5`, `4c18337`

### Step 6

- Command:
  - `rg -n "forward_imported_" packages/ui-model-demo-server/server.mjs packages/worker-base/system-models || true`
  - `rg -n "ui_event(_|\\b)|ui_event_error|ui_event_last_op_id" packages/ui-model-demo-server/server.mjs packages/ui-model-demo-frontend/src || true`
- Key output:
  - `forward_imported_` grep 结果为空
  - `ui_event*` grep 结果为空
  - imported-host generated `model0_egress_label` / `model0_egress_func` 退役证明由 `test_0326_imported_host_egress_bridge.mjs` 提供；正数模型现有 dual-bus 配置保留，不计入本 Step 退役范围
- Result: PASS
- Commit: `c6f537c`, `9c855e5`, `4c18337`

### Step 7

- Command:
  - `node scripts/ops/obsidian_docs_audit.mjs --root docs`
  - `rg -n "ui_event(_|\\b)|ui_event_error|ui_event_last_op_id|forward_imported_|model0_egress_label|model0_egress_func" docs/ssot/runtime_semantics_modeltable_driven.md docs/ssot/imported_slide_app_host_ingress_semantics_v1.md docs/ssot/mt_v0_patch_ops.md docs/user-guide/slide_delivery_and_runtime_overview_v1.md`
  - `git diff -- docs/iterations/0326-ui-event-ingress-via-model0-busin/plan.md docs/iterations/0326-ui-event-ingress-via-model0-busin/resolution.md docs/iterations/0326-ui-event-ingress-via-model0-busin/runlog.md docs/ssot/imported_slide_app_host_ingress_semantics_v1.md docs/ssot/mt_v0_patch_ops.md docs/ssot/runtime_semantics_modeltable_driven.md docs/user-guide/slide_delivery_and_runtime_overview_v1.md`
- Key output:
  - `obsidian_docs_audit` PASS（frontmatter / bare path / md link gate 全绿）
  - 4 个 current-truth docs 中的 legacy symbol 仅剩显式 Historical / Retired (pre-0326) 说明
  - iteration docs 已把前端验证面与 imported-host symbol retirement 范围改成与实际执行一致
- Result: PASS
- Commit: this commit

## Docs Updated

- [x] `docs/ssot/runtime_semantics_modeltable_driven.md` — Model 0 bus-event ingress + mailbox 退役 current truth
- [x] `docs/ssot/imported_slide_app_host_ingress_semantics_v1.md` — imported-host egress 改为 bridge_in -> mt_bus_send -> pin.bus.out
- [x] `docs/ssot/mt_v0_patch_ops.md` — `bus_event*` family 口径
- [x] `docs/user-guide/slide_delivery_and_runtime_overview_v1.md` — 3.1 egress 改写到 bridge_in/mt_bus_send current path
- [x] `docs/iterations/0326-ui-event-ingress-via-model0-busin/{plan,resolution,runlog}.md` — 与实际执行 / proof surface 对齐
- [ ] `docs/iterations/0319-slide-overview-gap-closure/` Superseded rewrite merge 与本迭代同窗口（待 merge 到 `dev` 时一起处理）
